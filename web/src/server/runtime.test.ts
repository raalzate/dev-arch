// Per-process runtime of the analyses API (007): configuration read at first use, shared instance, test overrides,
// engine location, server start (recovery, cleanup, exposure warning) and reset.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { EngineNotBuiltError } from './engine/engine-client.ts';
import { engineLaunchOrError, getRuntime, resetRuntime, setRuntimeOverrides, startRuntime } from './runtime.ts';
import { setupRouteEnv, type RouteEnv } from './testing/route-harness.test.ts';

let env: RouteEnv;
afterEach(async () => {
  await env.restore();
});

const HOUR = 3600_000;

test('the configuration is read from the environment at first use and the instance is shared until reset', async () => {
  env = await setupRouteEnv({ noEngine: true, env: { DEVARCH_API_TOKEN: ' tok ', MAX_CONCURRENT_ANALYSES: '3' } });
  const rt = getRuntime();
  assert.equal(rt.cwd, process.cwd());
  assert.equal(rt.config.dataDir, env.dataDir);
  assert.equal(rt.config.apiToken, 'tok');
  assert.equal(rt.config.maxConcurrent, 3);
  assert.equal(rt.store.dataDir, env.dataDir);
  process.env.DEVARCH_API_TOKEN = 'other';
  assert.equal(getRuntime(), rt, 'same instance: the environment is not read again');
  assert.equal(getRuntime().config.apiToken, 'tok');
  await resetRuntime();
  const next = getRuntime();
  assert.notEqual(next, rt);
  assert.equal(next.config.apiToken, 'other');
});

test('resetRuntime without a runtime does nothing', async () => {
  env = await setupRouteEnv({ noEngine: true });
  await resetRuntime();
  await resetRuntime();
  assert.equal(getRuntime().config.dataDir, env.dataDir);
});

test('overrides give the next runtime its clock and log; the store stamps jobs with that clock', async () => {
  env = await setupRouteEnv({ noEngine: true });
  const fixed = new Date('2030-01-02T03:04:05.000Z');
  const lines: string[] = [];
  setRuntimeOverrides({ now: () => fixed, log: (l) => lines.push(l) });
  await resetRuntime();
  const rt = getRuntime();
  assert.equal(rt.now().toISOString(), fixed.toISOString());
  assert.deepEqual(rt.deps, {});
  const job = await rt.store.create({ origin: 'zip', language: 'auto' });
  assert.equal(job.createdAt, '2030-01-02T03:04:05.000Z');
});

test('engineLaunchOrError reports a missing engine and resolves a configured one in MCP mode', async () => {
  env = await setupRouteEnv({ noEngine: true });
  const missing = engineLaunchOrError(process.cwd());
  assert.equal(missing.kind, 'not-built');
  assert.match(missing.kind === 'not-built' ? missing.message : '', /Engine not built/);
  await env.restore();

  env = await setupRouteEnv();
  const launch = engineLaunchOrError(process.cwd(), env.dataDir);
  assert.equal(launch.kind, 'resolved');
  if (launch.kind !== 'resolved') return;
  assert.equal(launch.command, path.join(process.env.JAVA_HOME!, 'bin', 'java'));
  assert.deepEqual(launch.args, ['-jar', process.env.ENGINE_JAR_PATH, '--mcp']);
  assert.equal(launch.env.STATIC_INFERENCE_JOBS_DIR, path.join(env.dataDir, 'jobs'));
  assert.equal(launch.env.STATIC_INFERENCE_INFERENCE_TOOLS, 'true');
  const withoutDataDir = engineLaunchOrError(process.cwd());
  assert.equal(withoutDataDir.kind === 'resolved' ? withoutDataDir.env.STATIC_INFERENCE_JOBS_DIR : 'not-built', undefined);
});

test('the runtime engine fails with EngineNotBuiltError when the engine is not built', async () => {
  env = await setupRouteEnv({ noEngine: true });
  await assert.rejects(getRuntime().engine.readResource('static-inference://configuration/defaults'), EngineNotBuiltError);
});

test('the runtime engine starts the configured engine and reads its resources', async () => {
  env = await setupRouteEnv();
  const text = await getRuntime().engine.readResource('static-inference://configuration/defaults');
  assert.equal(typeof JSON.parse(text).viability.thresholds.high, 'number');
  assert.ok(getRuntime().engine.pid());
});

test('startRuntime interrupts analyses left active, removes expired ones and warns about an unprotected API', async () => {
  env = await setupRouteEnv({ noEngine: true, env: { ARCHVIEW_JOB_TTL_HOURS: '1' } });
  let now = new Date('2030-01-01T00:00:00.000Z');
  setRuntimeOverrides({ now: () => now, log: () => undefined });
  await resetRuntime();
  const store = getRuntime().store;
  const queued = await store.create({ origin: 'zip', language: 'auto' });
  const running = await store.create({ origin: 'zip', language: 'auto', status: 'running' });
  const expired = await store.create({ origin: 'zip', language: 'auto', status: 'completed', finishedAt: new Date(now.getTime() - 2 * HOUR).toISOString() });
  const fresh = await store.create({ origin: 'zip', language: 'auto', status: 'completed' });

  const rt = await startRuntime();
  assert.equal(rt, getRuntime());
  for (const id of [queued.id, running.id]) {
    const j = await store.get(id);
    assert.equal(j?.status, 'failed');
    assert.equal(j?.error?.code, 'INTERRUPTED');
  }
  assert.equal(await store.get(expired.id), null);
  assert.equal((await store.get(fresh.id))?.status, 'completed');
  assert.equal(rt.timers.length, 1);
  assert.ok(env.logs.some((l) => l.includes('dev-arch API is NOT protected: listening on all network interfaces')), env.logs.join('\n'));

  now = new Date(now.getTime() + 3 * HOUR);
  // the interrupted analyses finished (failed) at the start, so they expire with the fresh one
  assert.deepEqual((await rt.runCleanup()).sort(), [fresh.id, queued.id, running.id].sort());
  assert.equal(existsSync(store.paths(fresh.id).dir), false);
});

test('the periodic cleanup removes analyses that expire after the start', async () => {
  env = await setupRouteEnv({ noEngine: true, env: { ARCHVIEW_JOB_TTL_HOURS: '1', ARCHVIEW_CLEANUP_INTERVAL_MS: '30', HOSTNAME: '127.0.0.1' } });
  let now = new Date('2030-01-01T00:00:00.000Z');
  setRuntimeOverrides({ now: () => now, log: () => undefined });
  await resetRuntime();
  const rt = await startRuntime();
  assert.ok(!env.logs.some((l) => l.includes('NOT protected')), 'no warning when bound to the loopback interface');
  const job = await rt.store.create({ origin: 'zip', language: 'auto', status: 'completed' });
  now = new Date(now.getTime() + 2 * HOUR);
  const deadline = Date.now() + 5000;
  while (existsSync(rt.store.paths(job.id).dir) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 20));
  assert.equal(existsSync(rt.store.paths(job.id).dir), false);
});

test('no warning is printed when an API token protects the server', async () => {
  env = await setupRouteEnv({ noEngine: true, env: { DEVARCH_API_TOKEN: 'tok' } });
  await startRuntime();
  assert.ok(!env.logs.some((l) => l.includes('NOT protected')), env.logs.join('\n'));
});
