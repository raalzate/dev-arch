// Structured events and time metrics of an analysis (011-quality-delivery, contracts/job-events.md). Run: npm test -w web
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { JobEventLog } from './job-events.ts';

function setup(append?: (file: string, text: string) => Promise<void>) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'devarch-events-'));
  const clock = { t: 1_000_000 };
  const lines: string[] = [];
  const log = new JobEventLog('11111111-1111-4111-8111-111111111111', path.join(dir, 'events.jsonl'), {
    now: () => clock.t, appendEvent: append, log: (l) => lines.push(l),
  });
  return { dir, clock, lines, log, file: path.join(dir, 'events.jsonl') };
}

const read = (file: string) => readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l));

test('records queued, started, phases with durations and completed with the total', async () => {
  const s = setup();
  s.log.queued();
  s.log.started();
  s.log.phase('detection');
  s.clock.t += 1500;
  s.log.phase('extraction');
  s.clock.t += 500;
  const metrics = await s.log.finish({ status: 'completed' }, 250);
  const ev = read(s.file);
  assert.deepEqual(ev.map((e) => e.event), ['queued', 'started', 'phase-start', 'phase-end', 'phase-start', 'phase-end', 'completed']);
  assert.deepEqual(ev.filter((e) => e.event === 'phase-end').map((e) => [e.phase, e.durationMs]), [['detection', 1500], ['extraction', 500]]);
  assert.equal(ev.at(-1).durationMs, 2000);
  assert.deepEqual(metrics, { queueMs: 250, totalMs: 2000, phases: { detection: 1500, extraction: 500 } });
  assert.equal(JSON.parse(s.lines[0]).status, 'completed');
});

test('a failure records the code and the last phase; the console line is a warning', async () => {
  const s = setup();
  s.log.started();
  s.log.phase('detection');
  s.clock.t += 100;
  await s.log.finish({ status: 'failed', code: 'ENGINE_ERROR' }, 0);
  const last = read(s.file).at(-1);
  assert.deepEqual([last.event, last.status, last.code, last.phase], ['failed', 'failed', 'ENGINE_ERROR', 'detection']);
  const line = JSON.parse(s.lines[0]);
  assert.deepEqual([line.level, line.msg, line.code, line.totalMs], ['warn', 'analysis finished', 'ENGINE_ERROR', 100]);
});

test('a clock going backwards never yields negative durations', async () => {
  const s = setup();
  s.log.started();
  s.log.phase('detection');
  s.clock.t -= 5000;
  const m = await s.log.finish({ status: 'completed' }, -3);
  assert.deepEqual(m, { queueMs: 0, totalMs: 0, phases: { detection: 0 } });
});

test('a failing writer never throws and still returns the metrics', async () => {
  const s = setup(async () => { throw new Error('ENOSPC'); });
  s.log.started();
  s.log.phase('detection');
  s.clock.t += 10;
  const m = await s.log.finish({ status: 'completed' }, 1);
  assert.equal(m.totalMs, 10);
});
