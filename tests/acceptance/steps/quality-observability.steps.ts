// 011-quality-delivery — US6: structured events and time metrics of the web job runner, exercised in process with
// a simulated engine (real JobStore/JobRunner/publicJob of web/src) and a controllable clock.
import { Given, Then, When } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig, type AppConfig } from '../../../web/src/server/config.ts';
import { EngineToolError, type AnalyzeHooks, type AnalyzeRequest } from '../../../web/src/server/engine/engine-client.ts';
import { JobRunner } from '../../../web/src/server/jobs/job-runner.ts';
import { JobStore, type Job, type Phase } from '../../../web/src/server/jobs/job-store.ts';
import { publicJob } from '../../../web/src/server/jobs/job-view.ts';
import { layout } from '../support/layout.ts';
import type { DevArchWorld } from '../support/world.ts';

const FIXTURE = path.join(layout.productRoot, 'tests', 'acceptance', 'fixtures', 'vb-synthetic');
const TOKEN = 'tok-011-observability-secret';

type Metrics = { queueMs: number; totalMs: number; phases: Partial<Record<Phase, number>> };
type Ctx = {
  dir: string;
  clock: { t: number };
  store: JobStore;
  config: AppConfig;
  console: string[];
  appendFails: boolean;
  errorMessage?: string;
  job?: Job;
  view?: Record<string, unknown>;
};

const ctx = (w: DevArchWorld) => w.data.obs as Ctx;

Given('a web job runner with a simulated engine and a controllable clock', function (this: DevArchWorld) {
  const dir = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'devarch-011-obs-')));
  this.cleanup.push(dir);
  const clock = { t: Date.parse('2026-10-10T10:00:00.000Z') };
  const config = loadConfig({ ARCHVIEW_DATA_DIR: dir, DEVARCH_API_TOKEN: TOKEN }, dir);
  const store = new JobStore(config.dataDir, () => new Date(clock.t));
  this.data.obs = { dir, clock, store, config, console: [], appendFails: false } satisfies Ctx;
});

Given('writing the structured log fails', function (this: DevArchWorld) {
  ctx(this).appendFails = true;
});

Given('the engine error message contains the analysis folder path and the API token', function (this: DevArchWorld) {
  ctx(this).errorMessage = `__PROJECT__/Module1.vb could not be parsed (token ${TOKEN})`;
});

async function runAnalysis(w: DevArchWorld, phasesText: string, opts: { fail?: boolean; backwards?: boolean }): Promise<void> {
  const c = ctx(w);
  const phases = phasesText.split(',').map((p) => p.trim()) as Phase[];
  const project = path.join(c.dir, 'project');
  mkdirSync(project, { recursive: true });
  const engine = {
    async analyze(req: AnalyzeRequest, hooks: AnalyzeHooks) {
      for (const [i, phase] of phases.entries()) {
        hooks.onPhase?.(phase);
        c.clock.t += opts.backwards ? -1000 : 1000 * (i + 1);
        await new Promise((r) => setImmediate(r));
      }
      if (opts.fail) {
        throw new EngineToolError((c.errorMessage ?? 'analysis failed: tool error').replace('__PROJECT__', req.projectPath));
      }
      for (const f of ['output.json', 'output_architecture.json', 'output_entrypoints.json']) {
        copyFileSync(path.join(FIXTURE, f), path.join(req.outputDir, f));
      }
      return { summary: { componentCount: 1, edgeCount: 0, proposalCount: 0, endpointCount: 0 }, warnings: [] };
    },
  };
  const runner = new JobRunner(c.store, engine, c.config, {
    now: () => c.clock.t,
    log: (line: string) => c.console.push(line),
    appendEvent: c.appendFails ? async () => { throw Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' }); } : undefined,
  });
  const job = await c.store.create({ origin: 'localPath', language: 'auto', projectRoot: project });
  c.clock.t += 500;
  runner.submit(job.id, project);
  const deadline = Date.now() + 20000;
  for (;;) {
    const current = await c.store.get(job.id);
    if (current && (current.status === 'completed' || current.status === 'failed')) {
      await runner.dispose(1000);
      c.job = (await c.store.get(job.id))!;
      return;
    }
    assert.ok(Date.now() < deadline, 'the analysis did not finish');
    await new Promise((r) => setTimeout(r, 10));
  }
}

When('an analysis runs through the phases {string} and completes', async function (this: DevArchWorld, phases: string) {
  await runAnalysis(this, phases, {});
});

When('an analysis runs through the phases {string} while the clock goes backwards and completes', async function (this: DevArchWorld, phases: string) {
  await runAnalysis(this, phases, { backwards: true });
});

When('an analysis runs through the phases {string} and the engine fails with a tool error', async function (this: DevArchWorld, phases: string) {
  await runAnalysis(this, phases, { fail: true });
});

When('its status is read through the analyses API view', function (this: DevArchWorld) {
  const c = ctx(this);
  c.view = publicJob(c.job!, c.store, c.config) as unknown as Record<string, unknown>;
});

type Event = { ts: string; jobId: string; event: string; phase?: Phase; durationMs?: number; status?: string; code?: string };

function eventsText(c: Ctx): string {
  const file = path.join(c.store.paths(c.job!.id).dir, 'events.jsonl');
  assert.ok(existsSync(file), 'no events.jsonl in the analysis folder');
  return readFileSync(file, 'utf8');
}

function events(c: Ctx): Event[] {
  return eventsText(c).split('\n').filter(Boolean).map((l) => JSON.parse(l) as Event);
}

Then('its structured log has one JSON event per line', function (this: DevArchWorld) {
  const c = ctx(this);
  const lines = eventsText(c).split('\n').filter(Boolean);
  assert.ok(lines.length > 0);
  for (const l of lines) {
    const e = JSON.parse(l) as Event;
    assert.equal(e.jobId, c.job!.id);
    assert.ok(!Number.isNaN(Date.parse(e.ts)), `bad ts ${e.ts}`);
  }
});

Then('the events are {string} in this order', function (this: DevArchWorld, list: string) {
  assert.deepEqual(events(ctx(this)).map((e) => e.event), list.split(',').map((s) => s.trim()));
});

Then('every phase-end event names its phase and a duration in milliseconds', function (this: DevArchWorld) {
  const ends = events(ctx(this)).filter((e) => e.event === 'phase-end');
  assert.deepEqual(ends.map((e) => e.phase), ['detection', 'extraction', 'inference', 'writing']);
  // The simulated engine spends 1, 2, 3 and 4 seconds in the four phases.
  assert.deepEqual(ends.map((e) => e.durationMs), [1000, 2000, 3000, 4000]);
});

Then('the completed event has the status {string} and the total duration', function (this: DevArchWorld, status: string) {
  const c = ctx(this);
  const last = events(c).at(-1)!;
  assert.equal(last.event, 'completed');
  assert.equal(last.status, status);
  assert.equal(last.durationMs, (c.job as Job & { metrics: Metrics }).metrics.totalMs);
  assert.ok((last.durationMs ?? -1) >= 10000, `total ${last.durationMs}`);
});

function metricsOf(c: Ctx): Metrics {
  const m = (c.view ? c.view.metrics : (c.job as unknown as { metrics?: Metrics }).metrics) as Metrics | undefined;
  assert.ok(m, 'no metrics');
  return m;
}

Then('the metrics contain the duration of each of the {int} phases, the queue time and the total duration', function (this: DevArchWorld, n: number) {
  const m = metricsOf(ctx(this));
  assert.equal(Object.keys(m.phases).length, n, JSON.stringify(m));
  assert.equal(typeof m.queueMs, 'number');
  assert.equal(typeof m.totalMs, 'number');
  assert.equal(m.queueMs, 500, 'queue time of the simulated submission');
});

Then('no duration is negative and the sum of the phases does not exceed the total', function (this: DevArchWorld) {
  const m = metricsOf(ctx(this));
  const values = [m.queueMs, m.totalMs, ...Object.values(m.phases)] as number[];
  assert.ok(values.every((v) => Number.isInteger(v) && v >= 0), JSON.stringify(m));
  const sum = (Object.values(m.phases) as number[]).reduce((a, b) => a + b, 0);
  assert.ok(sum <= m.totalMs, `phases ${sum} > total ${m.totalMs}`);
});

Then('the last structured event is {string} with the code {string} and the phase {string}', function (this: DevArchWorld, event: string, code: string, phase: string) {
  const last = events(ctx(this)).at(-1)!;
  assert.equal(last.event, event);
  assert.equal(last.status, 'failed');
  assert.equal(last.code, code);
  assert.equal(last.phase, phase);
  assert.equal(typeof last.durationMs, 'number');
});

Then('no structured event contains an absolute path of the server or the API token', function (this: DevArchWorld) {
  const c = ctx(this);
  const text = eventsText(c);
  assert.equal(c.job!.status, 'failed');
  for (const forbidden of [c.dir, c.config.dataDir, TOKEN, os.tmpdir()]) {
    assert.ok(!text.includes(forbidden), `events contain ${forbidden}`);
  }
  assert.doesNotMatch(text, /"\/(?:Users|home|private|tmp|var)\//, 'events contain an absolute path');
});

Then('the analysis status is {string}', function (this: DevArchWorld, status: string) {
  assert.equal(ctx(this).job!.status, status);
});

Then('the server console received one JSON line with the analysis id, the status {string}, the code {string} and the total duration', function (this: DevArchWorld, status: string, code: string) {
  const c = ctx(this);
  const lines = c.console.map((l) => { try { return JSON.parse(l) as Record<string, unknown>; } catch { return null; } })
    .filter((o): o is Record<string, unknown> => !!o && o.jobId === c.job!.id);
  assert.equal(lines.length, 1, c.console.join('\n'));
  assert.equal(lines[0].status, status);
  assert.equal(lines[0].code, code);
  assert.equal(typeof lines[0].totalMs, 'number');
});
