// US5 — Import existing results validated against the data contract (007 TS-040..TS-046; TS-047 is a browser scenario).
import { Given, Then, When } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { layout } from '../support/layout.ts';
import type { DevArchWorld } from '../support/world.ts';
import { api, harness, lastResponse, status } from './native-runtime-common.steps.ts';

const fixture = (...p: string[]) => JSON.parse(readFileSync(path.join(layout.schemaDir, 'fixtures', ...p), 'utf8'));

export function contractOutputs(name: string): Record<string, any> {
  return {
    graph: fixture('valid', name, 'output.json'),
    architecture: fixture('valid', name, 'output_architecture.json'),
    entrypoints: fixture('valid', name, 'output_entrypoints.json'),
  };
}

async function importBody(world: DevArchWorld, body: unknown): Promise<void> {
  const res = await api(world).call('POST', '/api/analyses/import', {
    body: typeof body === 'string' ? body : JSON.stringify(body), headers: { 'content-type': 'application/json' },
  });
  world.data.response = res;
  if (res.status === 201) world.data.jobId = res.json.jobId;
}

When('the outputs of the contract fixture {string} are imported with entrypoints {string}', async function (this: DevArchWorld, name: string, mode: string) {
  const body = contractOutputs(name);
  if (mode === 'omitted') delete body.entrypoints;
  this.data.imported = body;
  await importBody(this, body);
});

Then('the response status is {int} with a job identifier', function (this: DevArchWorld, code: number) {
  const r = lastResponse(this);
  assert.equal(r.status, code, r.text.slice(0, 1000));
  assert.match(String(r.json.jobId), /^[0-9a-f-]{36}$/);
});

Then('the status of that analysis is {string} with origin {string}', async function (this: DevArchWorld, st: string, origin: string) {
  const s = await status(this, this.data.jobId as string);
  assert.equal(s.status, st);
  assert.equal(s.origin, origin);
  assert.equal(s.hasSources, false);
});

Then('its {string} and {string} documents equal the imported ones', async function (this: DevArchWorld, a: string, b: string) {
  const imported = this.data.imported as Record<string, unknown>;
  for (const doc of [a, b]) {
    const r = await api(this).call('GET', `/api/analyses/${this.data.jobId}/${doc}`);
    assert.equal(r.status, 200, r.text.slice(0, 300));
    assert.deepEqual(r.json, imported[doc]);
  }
});

Then('the stub engine was not called', function (this: DevArchWorld) {
  assert.equal(readFileSync(harness(this).launchCounter, 'utf8').trim(), '', 'the engine was launched');
});

When('each document of the contract fixtures under {string} is imported in its document slot', async function (this: DevArchWorld, dir: string) {
  const files = readdirSync(path.join(layout.productRoot, dir));
  assert.ok(files.length >= 5);
  const responses = [];
  for (const f of files) {
    const slot = f.startsWith('graph-') ? 'graph' : 'architecture';
    const body = { ...contractOutputs('java-standar'), [slot]: JSON.parse(readFileSync(path.join(layout.productRoot, dir, f), 'utf8')) };
    await importBody(this, body);
    responses.push({ file: f, slot, res: lastResponse(this) });
  }
  this.data.importResponses = responses;
});

Then('every import is rejected with status {int} and error code {string}', function (this: DevArchWorld, code: number, error: string) {
  for (const { file, res } of this.data.importResponses as { file: string; res: { status: number; json: any; text: string } }[]) {
    assert.equal(res.status, code, `${file}: ${res.text.slice(0, 300)}`);
    assert.equal(res.json.error?.code, error, file);
  }
});

Then('every rejection lists at least one violation with its document, field pointer and reason', function (this: DevArchWorld) {
  for (const { file, slot, res } of this.data.importResponses as { file: string; slot: string; res: { json: any } }[]) {
    const v = res.json.error?.violations as { document: string; pointer: string; message: string }[];
    assert.ok(Array.isArray(v) && v.length >= 1, file);
    for (const x of v) {
      assert.equal(x.document, slot, file);
      assert.match(x.pointer, /^\//, file);
      assert.ok(x.message, file);
    }
  }
});

Then('no analysis was created', function (this: DevArchWorld) {
  const jobs = path.join(harness(this).dataDir, 'jobs');
  assert.deepEqual(existsSync(jobs) ? readdirSync(jobs) : [], []);
});

When('the outputs of the contract fixture {string} are imported with the graph contract version changed to {string}', async function (this: DevArchWorld, name: string, version: string) {
  const body = contractOutputs(name);
  body.graph.meta.schema_version = version;
  await importBody(this, body);
});

Then('the error reports the found version {string} and the supported version {string}', function (this: DevArchWorld, found: string, supported: string) {
  const e = lastResponse(this).json.error;
  assert.equal(e.found, found);
  assert.equal(e.supported, supported);
});

When('the outputs of the contract fixture {string} are imported without the {string}', async function (this: DevArchWorld, name: string, doc: string) {
  const body = contractOutputs(name);
  delete body[doc];
  await importBody(this, body);
});

Then('the error names the document {string}', function (this: DevArchWorld, doc: string) {
  assert.equal(lastResponse(this).json.error?.document, doc);
});

When('an import body of {int} MB is submitted', async function (this: DevArchWorld, mb: number) {
  const body = JSON.stringify({ graph: { padding: 'x'.repeat(mb * 1024 * 1024) }, architecture: {} });
  await importBody(this, body);
});

Given('an imported analysis of the contract fixture {string}', async function (this: DevArchWorld, name: string) {
  this.data.imported = contractOutputs(name);
  await importBody(this, this.data.imported);
  assert.equal(lastResponse(this).status, 201, lastResponse(this).text);
});

Given('an imported analysis created {int} hours ago', async function (this: DevArchWorld, h: number) {
  const clock = this.data.clock as { now: number };
  const realNow = clock.now;
  clock.now = realNow - h * 3600_000;
  await importBody(this, contractOutputs('java-standar'));
  clock.now = realNow;
  assert.equal(lastResponse(this).status, 201, lastResponse(this).text);
});

Then('requesting its status answers {int} with error code {string}', async function (this: DevArchWorld, code: number, error: string) {
  const r = await api(this).call('GET', `/api/analyses/${this.data.jobId}`);
  assert.equal(r.status, code, r.text);
  assert.equal(r.json.error?.code, error);
});
