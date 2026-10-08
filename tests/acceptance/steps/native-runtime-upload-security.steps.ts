// US3 — Safe and bounded project uploads (007 TS-023..TS-033, TS-086, TS-087).
import { Given, Then, When } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { Writable } from 'node:stream';
import { lyingZip, zipOfBytes, zipWithEntries, zipWithSize } from '../support/zip-catalog.ts';
import type { DevArchWorld } from '../support/world.ts';
import {
  api, harness, jobId, lastResponse, smallZip, startHarness, status, submitZip,
} from './native-runtime-common.steps.ts';

const enospc = () => Object.assign(new Error('ENOSPC: no space left on device, write'), { code: 'ENOSPC' });

function jobDirs(world: DevArchWorld): string[] {
  const dir = path.join(harness(world).dataDir, 'jobs');
  return existsSync(dir) ? readdirSync(dir) : [];
}

function findFiles(dir: string, name: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...findFiles(p, name));
    else if (e.name === name) out.push(p);
  }
  return out;
}

// --- setups ---------------------------------------------------------------------------------------------

Given('the web server is running with an upload limit of {int} MB', async function (this: DevArchWorld, mb: number) {
  await startHarness(this, { env: { MAX_UPLOAD_BYTES: String(mb * 1024 * 1024) } });
});

Given('the web server is running with an uncompressed limit of {int} MB and an entry limit of {int}', async function (this: DevArchWorld, mb: number, entries: number) {
  await startHarness(this, { env: { MAX_UNCOMPRESSED_BYTES: String(mb * 1024 * 1024), MAX_ZIP_ENTRIES: String(entries) } });
  this.data.limits = { bytes: mb * 1024 * 1024, entries };
});

Given('the web server is running with {int} concurrent analysis, a queue of {int} and a stub engine that takes {int} seconds per analysis', async function (this: DevArchWorld, running: number, queue: number, s: number) {
  await startHarness(this, {
    env: { MAX_CONCURRENT_ANALYSES: String(running), MAX_QUEUED_ANALYSES: String(queue) },
    control: { delayMs: s * 1000 },
  });
});

Given('the web server is running with a stub engine and a disk that fills up while storing the upload', async function (this: DevArchWorld) {
  await startHarness(this, {
    overrides: { deps: { createWriteStream: () => new Writable({ write(_c, _e, cb) { cb(enospc()); } }) } },
  });
});

Given('the web server is running with a stub engine and a disk that fills up while extracting the project', async function (this: DevArchWorld) {
  await startHarness(this, { overrides: { deps: { writeFile: async () => { throw enospc(); } } } });
});

Given('the web server is running with a stub engine and a disk that fills up while writing the results', async function (this: DevArchWorld) {
  await startHarness(this, { control: { noSpace: true } });
});

// --- submissions ----------------------------------------------------------------------------------------

When('a ZIP of {int} MB is submitted for analysis', async function (this: DevArchWorld, mb: number) {
  this.data.startedAt = Date.now();
  await submitZip(this, zipOfBytes(mb));
});

When('a ZIP whose entries are {string} and {string} is submitted for analysis', async function (this: DevArchWorld, a: string, b: string) {
  this.data.startedAt = Date.now();
  await submitZip(this, zipWithEntries([a, b]));
});

When('a ZIP with {int} entries and {int} MB uncompressed is submitted for analysis', async function (this: DevArchWorld, entries: number, mb: number) {
  await submitZip(this, zipWithSize(entries, mb));
});

When('a ZIP that declares {int} MB but expands to {int} MB is submitted for analysis', async function (this: DevArchWorld, declared: number, real: number) {
  const r = await submitZip(this, lyingZip(declared, real));
  assert.equal(r.status, 202, r.text);
});

When('a plain text file is submitted for analysis', async function (this: DevArchWorld) {
  await submitZip(this, Buffer.from('this is not a zip archive\n'));
});

// --- outcomes -------------------------------------------------------------------------------------------

Then('the error reports the limit in bytes', function (this: DevArchWorld) {
  assert.equal(lastResponse(this).json.error?.limitBytes, 1024 * 1024);
});

Then('no file of that submission remains on disk', function (this: DevArchWorld) {
  assert.deepEqual(jobDirs(this), []);
});

Then('the error names the entry {string}', function (this: DevArchWorld, entry: string) {
  const expected = entry.replace(/ \(symlink\)$/, '');
  assert.equal(lastResponse(this).json.error?.entry, expected);
});

Then('no file was written outside the analysis area', function (this: DevArchWorld) {
  const h = harness(this);
  assert.deepEqual(findFiles(h.root, 'evil.txt'), []);
  const started = this.data.startedAt as number;
  for (const f of ['/tmp/evil.txt', path.join(path.dirname(h.root), 'evil.txt')]) {
    assert.ok(!existsSync(f) || statSync(f).mtimeMs < started, `${f} was written`);
  }
});

Then('no analysis area remains for that submission', function (this: DevArchWorld) {
  assert.deepEqual(jobDirs(this), []);
});

Then('the error reports the exceeded limit', function (this: DevArchWorld) {
  const e = lastResponse(this).json.error;
  const limits = this.data.limits as { bytes: number; entries: number };
  if (e.code === 'UNCOMPRESSED_TOO_LARGE') assert.equal(e.limitBytes, limits.bytes);
  else assert.equal(e.limit, limits.entries);
});

Then('its analysis area no longer contains extracted files', function (this: DevArchWorld) {
  const dir = path.join(harness(this).dataDir, 'jobs', jobId(this));
  assert.equal(existsSync(path.join(dir, 'source')), false);
  assert.equal(existsSync(path.join(dir, 'upload.zip')), false);
});

Then('the server log records the rejection with the reason {string} and the entry {string}', function (this: DevArchWorld, reason: string, entry: string) {
  const line = harness(this).logs.find((l) => l.includes('[security]') && l.includes(reason));
  assert.ok(line, `no security log line: ${harness(this).logs.join('\n')}`);
  assert.ok(line.includes(entry), line);
});

Then('the server log does not contain the contents of any entry', function (this: DevArchWorld) {
  const logs = harness(this).logs.join('\n');
  // zip-catalog writes "evil" into unknown entries and a Java class body into .java entries.
  assert.ok(!logs.includes('public class App'), logs);
  assert.ok(!/(^|\s)evil\n/.test(logs), logs);
});

Then('the failure message mentions {string} without a stack trace', function (this: DevArchWorld, words: string) {
  const message = String((this.data.final as Record<string, any>).error?.message ?? '');
  assert.ok(message.toLowerCase().includes(words), message);
  assert.doesNotMatch(message, /\n\s+at |Exception|ENOSPC: /);
});

Then('its analysis area contains no extracted sources and no partial result documents', function (this: DevArchWorld) {
  const dir = path.join(harness(this).dataDir, 'jobs', jobId(this));
  assert.equal(existsSync(path.join(dir, 'source')), false);
  assert.equal(existsSync(path.join(dir, 'upload.zip')), false);
  const out = path.join(dir, 'out');
  assert.deepEqual(existsSync(out) ? readdirSync(out) : [], []);
});

// --- TS-030 / TS-031 (quota) ----------------------------------------------------------------------------

When('three analyses are submitted one after another', async function (this: DevArchWorld) {
  const responses = [];
  for (let i = 0; i < 2; i++) responses.push(await submitZip(this, smallZip()));
  // The third body is a stream that records whether the server read it.
  let pulled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(c) {
      pulled = true;
      c.enqueue(new Uint8Array(smallZip()));
      c.close();
    },
  }, { highWaterMark: 0 });
  const before = jobDirs(this);
  const third = await api(this).call('POST', '/api/analyses', { body, headers: { 'content-type': 'application/zip' } });
  responses.push(third);
  this.data.response = third;
  this.data.responses = responses;
  this.data.thirdPulled = () => pulled;
  this.data.dirsBeforeThird = before;
});

Then('the first analysis is {string} and the second is {string}', async function (this: DevArchWorld, a: string, b: string) {
  const [r1, r2] = this.data.responses as { json: { jobId: string } }[];
  assert.equal((await status(this, r1.json.jobId)).status, a);
  assert.equal((await status(this, r2.json.jobId)).status, b);
});

Then('the third submission is rejected with status {int}, error code {string} and a retry delay', function (this: DevArchWorld, code: number, error: string) {
  const r = lastResponse(this);
  assert.equal(r.status, code, r.text);
  assert.equal(r.json.error?.code, error);
  assert.ok(Number(r.headers.get('retry-after')) > 0, `Retry-After: ${r.headers.get('retry-after')}`);
});

Then('the body of the third submission was not stored', function (this: DevArchWorld) {
  assert.equal((this.data.thirdPulled as () => boolean)(), false, 'the server read the body');
  assert.deepEqual(jobDirs(this), this.data.dirsBeforeThird);
});

When('two analyses are submitted one after another', async function (this: DevArchWorld) {
  for (let i = 0; i < 2; i++) assert.equal((await submitZip(this, smallZip())).status, 202);
});

Then('the second analysis is {string} while the first runs', async function (this: DevArchWorld, st: string) {
  const [first, second] = this.data.jobIds as string[];
  const s1 = await status(this, first);
  assert.ok(['queued', 'running'].includes(s1.status), JSON.stringify(s1));
  assert.equal((await status(this, second)).status, st);
});

// --- TS-032 / TS-033 / TS-046 (retention) ---------------------------------------------------------------

Given('the web server is running with a retention of {int} hour and a controllable clock', async function (this: DevArchWorld, hours: number) {
  const clock = { now: Date.now() };
  this.data.clock = clock;
  await startHarness(this, { env: { ARCHVIEW_JOB_TTL_HOURS: String(hours) }, overrides: { now: () => new Date(clock.now) } });
});

async function storedJob(world: DevArchWorld, init: Record<string, unknown>): Promise<string> {
  const rt = await harness(world).runtime();
  const job = await rt.store.create(init as never);
  const ids = ((world.data.agedJobs as string[]) ??= []);
  ids.push(job.id);
  return job.id;
}

const hoursAgo = (world: DevArchWorld, h: number) => new Date((world.data.clock as { now: number }).now - h * 3600_000).toISOString();

Given('a completed analysis that finished {int} hours ago', async function (this: DevArchWorld, h: number) {
  await storedJob(this, { origin: 'zip', language: 'auto', status: 'completed', finishedAt: hoursAgo(this, h) });
});

Given('a failed analysis that finished {int} hours ago', async function (this: DevArchWorld, h: number) {
  await storedJob(this, { origin: 'zip', language: 'auto', status: 'failed', finishedAt: hoursAgo(this, h),
    error: { code: 'ENGINE_ERROR', message: 'failed' } });
});

Given('an analysis that has been running for {int} hours', async function (this: DevArchWorld, h: number) {
  await storedJob(this, { origin: 'zip', language: 'auto', status: 'running', startedAt: hoursAgo(this, h) });
});

When('the periodic cleanup runs', async function (this: DevArchWorld) {
  const rt = await harness(this).runtime();
  this.data.removed = await rt.runCleanup();
});

Then('the areas of both analyses no longer exist on disk', function (this: DevArchWorld) {
  for (const id of this.data.agedJobs as string[]) {
    assert.equal(existsSync(path.join(harness(this).dataDir, 'jobs', id)), false, id);
  }
});

Then('requesting their status answers {int} with error code {string}', async function (this: DevArchWorld, code: number, error: string) {
  for (const id of this.data.agedJobs as string[]) {
    const r = await api(this).call('GET', `/api/analyses/${id}`);
    assert.equal(r.status, code);
    assert.equal(r.json.error?.code, error);
  }
});

Then('that analysis and its area still exist', async function (this: DevArchWorld) {
  for (const id of this.data.agedJobs as string[]) {
    assert.ok(existsSync(path.join(harness(this).dataDir, 'jobs', id)), id);
    assert.equal((await status(this, id)).status, 'running');
  }
});

