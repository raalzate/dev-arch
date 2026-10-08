// Job runner: queue, semaphore, pipeline and failure mapping (007, research D2, D7, D14). Run: npm test -w web
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipWithEntries } from '../../../../tests/acceptance/support/zip-catalog.ts';
import { loadConfig } from '../config.ts';
import { JobStore, type Job } from './job-store.ts';
import { JobRunner, type Engine } from './job-runner.ts';
import { EngineToolError } from '../engine/engine-client.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.resolve(here, '../../../../schema/fixtures/valid/java-standar');

type Behaviour = { delayMs?: number; fail?: Error; badGraph?: boolean; warnings?: string[] };

function stubEngine(b: Behaviour = {}) {
  const calls: { projectPath: string; start: number; end: number }[] = [];
  let active = 0;
  let maxActive = 0;
  const engine: Engine = {
    async analyze(req, hooks) {
      const start = Date.now();
      active++;
      maxActive = Math.max(maxActive, active);
      try {
        for (const p of ['detection', 'extraction', 'inference', 'writing'] as const) {
          hooks.onPhase(p);
          await new Promise((r) => setTimeout(r, (b.delayMs ?? 0) / 4));
        }
        if (b.fail) throw b.fail;
        mkdirSync(req.outputDir, { recursive: true });
        for (const f of ['output.json', 'output_architecture.json', 'output_entrypoints.json']) {
          let text = readFileSync(path.join(fixtures, f), 'utf8');
          if (b.badGraph && f === 'output.json') text = text.replace('"schema_version"', '"schema_versionX"');
          writeFileSync(path.join(req.outputDir, f), text);
        }
        return { summary: { componentCount: 27, edgeCount: 44, proposalCount: 2, endpointCount: 15 }, warnings: b.warnings ?? [] };
      } finally {
        active--;
        calls.push({ projectPath: req.projectPath, start, end: Date.now() });
      }
    },
  };
  return { engine, calls, maxActive: () => maxActive };
}

function setup(b: Behaviour = {}, env: Record<string, string> = {}) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'devarch-runner-'));
  const config = loadConfig({ ARCHVIEW_DATA_DIR: dir, ...env }, dir);
  const store = new JobStore(config.dataDir);
  const stub = stubEngine(b);
  const runner = new JobRunner(store, stub.engine, config);
  return { dir, config, store, runner, ...stub };
}

async function zipJob(s: ReturnType<typeof setup>, names = ['demo/pom.xml', 'demo/src/App.java']): Promise<Job> {
  const job = await s.store.create({ origin: 'zip', language: 'auto' });
  writeFileSync(s.store.paths(job.id).upload, zipWithEntries(names));
  return job;
}

async function until(s: ReturnType<typeof setup>, id: string, pred: (j: Job) => boolean, ms = 10_000): Promise<Job> {
  const deadline = Date.now() + ms;
  for (;;) {
    const j = await s.store.get(id);
    if (j && pred(j)) return j;
    if (Date.now() > deadline) throw new Error(`timeout waiting for job ${id}: ${JSON.stringify(j)}`);
    await new Promise((r) => setTimeout(r, 20));
  }
}
const done = (j: Job) => j.status === 'completed' || j.status === 'failed';

test('submit returns immediately; the job is extracted, analyzed, validated and completed', async () => {
  const s = setup({ delayMs: 200, warnings: ['w1'] });
  const job = await zipJob(s);
  const t0 = Date.now();
  const state = s.runner.submit(job.id);
  assert.ok(Date.now() - t0 < 100);
  assert.equal(state, 'running');
  const final = await until(s, job.id, done);
  assert.equal(final.status, 'completed', JSON.stringify(final.error));
  assert.equal(final.phase, 'writing');
  assert.deepEqual(final.warnings, ['w1']);
  assert.equal(final.summary?.componentCount, 27);
  const p = s.store.paths(job.id);
  assert.equal(final.projectRoot, path.join(p.source, 'demo'));
  assert.equal(s.calls[0].projectPath, path.join(p.source, 'demo'));
  assert.ok(existsSync(path.join(p.out, 'output_architecture.json')));
  assert.equal(existsSync(p.upload), false, 'the upload is removed after extraction');
});

test('a document that violates the contract fails the job with ENGINE_ERROR', async () => {
  const s = setup({ badGraph: true });
  const job = await zipJob(s);
  s.runner.submit(job.id);
  const final = await until(s, job.id, done);
  assert.equal(final.status, 'failed');
  assert.equal(final.error?.code, 'ENGINE_ERROR');
  assert.match(final.error?.message ?? '', /contract 1\.0\.0/);
});

test('engine errors are mapped to codes with summarized messages', async () => {
  const cases: [Error, string][] = [
    [new EngineToolError("Ambiguous project type: found both Java and .NET markers. Use language=java|dotnet"), 'AMBIGUOUS_PROJECT'],
    [new EngineToolError('Analysis failed: java.lang.IllegalStateException: boom'), 'ENGINE_ERROR'],
    [new EngineToolError('Analysis failed: No space left on device'), 'STORAGE_FULL'],
  ];
  for (const [err, code] of cases) {
    const s = setup({ fail: err });
    const job = await zipJob(s);
    s.runner.submit(job.id);
    const final = await until(s, job.id, done);
    assert.equal(final.error?.code, code);
    assert.doesNotMatch(final.error?.message ?? '', /java\.lang\./);
    if (code === 'STORAGE_FULL') {
      assert.equal(existsSync(s.store.paths(job.id).source), false);
      assert.equal(existsSync(s.store.paths(job.id).out), false);
    }
  }
});

test('at most maxConcurrent analyses run; the rest wait in FIFO order and the quota covers both', async () => {
  const s = setup({ delayMs: 300 }, { MAX_CONCURRENT_ANALYSES: '1', MAX_QUEUED_ANALYSES: '1' });
  const a = await zipJob(s);
  const b = await zipJob(s);
  assert.ok(s.runner.reserve());
  assert.equal(s.runner.submit(a.id), 'running');
  assert.ok(s.runner.reserve());
  assert.equal(s.runner.submit(b.id), 'queued');
  assert.equal(s.runner.reserve(), false, 'running and queue are full');
  await until(s, b.id, done);
  assert.equal(s.maxActive(), 1);
  assert.ok(s.calls[1].start >= s.calls[0].end);
  assert.ok(s.runner.reserve());
  s.runner.release();
});
