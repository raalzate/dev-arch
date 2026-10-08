// US7 — Resilient engine service in the web (007 TS-066..TS-072).
// TS-072 reuses the 006 steps "the environment has ..." and "the web working directory is {string}".
import { Given, Then, When } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { layout } from '../support/layout.ts';
import type { DevArchWorld } from '../support/world.ts';
import { harness, jobId, smallZip, startHarness, status, submitZip, waitForJob } from './native-runtime-common.steps.ts';

const launches = (world: DevArchWorld) => readFileSync(harness(world).launchCounter, 'utf8').split('\n').filter(Boolean).length;

async function killEngine(world: DevArchWorld): Promise<void> {
  const rt = await harness(world).runtime();
  const pid = rt.engine.pid();
  assert.ok(pid, 'the engine process is not running');
  process.kill(pid, 'SIGKILL');
}

Given('the web server is running with a stub engine that counts its launches', async function (this: DevArchWorld) {
  await startHarness(this);
});

When('three analyses are submitted one after another and all complete', async function (this: DevArchWorld) {
  for (let i = 0; i < 3; i++) {
    const r = await submitZip(this, smallZip());
    assert.equal(r.status, 202, r.text);
    assert.equal((await waitForJob(this, jobId(this))).status, 'completed');
  }
});

Then('the engine was launched exactly once', function (this: DevArchWorld) {
  assert.equal(launches(this), 1);
});

Given('an analysis is running', async function (this: DevArchWorld) {
  await submitZip(this, smallZip());
  await waitForJob(this, jobId(this), (s) => s.status === 'running' && s.phase !== null, 20_000);
});

When('the engine process is killed', async function (this: DevArchWorld) {
  this.data.killedAt = Date.now();
  await killEngine(this);
});

Then('within {int} seconds that analysis has status {string} with error code {string}', async function (this: DevArchWorld, s: number, st: string, code: string) {
  const final = await waitForJob(this, jobId(this), (x) => x.status === st, s * 1000);
  assert.equal(final.error?.code, code, JSON.stringify(final));
  assert.ok(Date.now() - (this.data.killedAt as number) < s * 1000);
  this.data.webRuntime = await harness(this).runtime();
});

When('another analysis is submitted with a stub engine that answers immediately', async function (this: DevArchWorld) {
  harness(this).setControl({});
  const r = await submitZip(this, smallZip());
  assert.equal(r.status, 202, r.text);
});

Then('that analysis completes without restarting the web server', async function (this: DevArchWorld) {
  assert.equal((await waitForJob(this, jobId(this), undefined, 30_000)).status, 'completed');
  assert.equal(await harness(this).runtime(), this.data.webRuntime, 'the web runtime was recreated');
  assert.equal(launches(this), 2, 'the engine was relaunched once');
});

Given('the web server is running with a stub engine that crashes on every analysis', async function (this: DevArchWorld) {
  await startHarness(this, { control: { crash: true } });
});

When('four analyses are submitted one after another within {int} seconds', async function (this: DevArchWorld, s: number) {
  const started = Date.now();
  const finals = [];
  for (let i = 0; i < 4; i++) {
    const r = await submitZip(this, smallZip());
    assert.equal(r.status, 202, r.text);
    finals.push(await waitForJob(this, jobId(this), undefined, 30_000));
  }
  assert.ok(Date.now() - started < s * 1000, `took ${Date.now() - started} ms`);
  this.data.finals = finals;
});

Then('the first three fail with error code {string}', function (this: DevArchWorld, code: string) {
  for (const f of (this.data.finals as Record<string, any>[]).slice(0, 3)) {
    assert.equal(f.status, 'failed');
    assert.equal(f.error?.code, code, JSON.stringify(f));
  }
});

Then('the fourth fails with error code {string}', function (this: DevArchWorld, code: string) {
  const f = (this.data.finals as Record<string, any>[])[3];
  assert.equal(f.status, 'failed');
  assert.equal(f.error?.code, code, JSON.stringify(f));
});

Given('the engine process has just been killed', async function (this: DevArchWorld) {
  await submitZip(this, smallZip());
  assert.equal((await waitForJob(this, jobId(this))).status, 'completed');
  await killEngine(this);
});

Given('the web server is running with an analysis time limit of {int} seconds and a stub engine that takes {int} seconds per analysis', async function (this: DevArchWorld, limit: number, s: number) {
  await startHarness(this, { env: { ANALYSIS_TIMEOUT_MS: String(limit * 1000) }, control: { delayMs: s * 1000 } });
});

Given('the web server is running with a stub engine that writes {string} to its error output and then fails', async function (this: DevArchWorld, line: string) {
  await startHarness(this, { control: { stderr: [line], fail: `Analysis failed: ${line}` } });
});

Then('the server log contains the line {string}', async function (this: DevArchWorld, line: string) {
  await waitForJob(this, jobId(this));
  assert.ok(harness(this).logs.includes(line), harness(this).logs.join('\n'));
});

Then('the engine log of that analysis contains {string}', function (this: DevArchWorld, text: string) {
  const log = path.join(harness(this).dataDir, 'jobs', jobId(this), 'engine.log');
  assert.ok(existsSync(log), 'no engine.log');
  assert.ok(readFileSync(log, 'utf8').includes(text));
});

Then('the failure message shown in the analysis status does not contain {string}', async function (this: DevArchWorld, text: string) {
  const s = await status(this, jobId(this));
  assert.equal(s.status, 'failed');
  assert.ok(s.error?.message, JSON.stringify(s));
  assert.ok(!String(s.error.message).includes(text), s.error.message);
});

// --- TS-072 ---------------------------------------------------------------------------------------------

Given('the environment has ENGINE_JAVA_OPTS {string}', function (this: DevArchWorld, opts: string) {
  this.data.resolveEnv = { ENGINE_JAVA_OPTS: opts };
});

When('the engine launch command is resolved', async function (this: DevArchWorld) {
  const { locateEngine } = (await import(path.join(layout.webDir, 'src', 'server', 'engine', 'engine-locator.ts'))) as
    typeof import('../../../web/src/server/engine/engine-locator.ts');
  this.data.launch = locateEngine(this.data.resolveEnv as NodeJS.ProcessEnv, this.data.resolveCwd as string, () => true);
});

Then('the command is {string} with arguments {string}', function (this: DevArchWorld, command: string, args: string) {
  const l = this.data.launch as { kind: string; command: string; args: string[] };
  assert.equal(l.kind, 'resolved');
  assert.equal(l.command, command);
  assert.deepEqual(l.args, args.split(' '));
});

Then('that analysis ends with status {string} and error code {string}', async function (this: DevArchWorld, st: string, code: string) {
  const s = await waitForJob(this, jobId(this), undefined, 30_000);
  assert.equal(s.status, st, JSON.stringify(s));
  assert.equal(s.error?.code, code, JSON.stringify(s));
  assert.doesNotMatch(String(s.error?.message), /Exception|\n\s+at /);
});
