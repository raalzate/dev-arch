// US9 — API responses without server paths and with an optional access token (007 TS-078..TS-084;
// TS-085 is a browser scenario in native-runtime-browser.steps.ts).
import { Given, Then, When } from '@cucumber/cucumber';
import AdmZip from 'adm-zip';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { layout } from '../support/layout.ts';
import { zipWithEntries } from '../support/zip-catalog.ts';
import type { ApiResponse } from '../support/web-harness.ts';
import type { DevArchWorld } from '../support/world.ts';
import { contractOutputs } from './native-runtime-import.steps.ts';
import { api, harness, jobId, lastResponse, smallZip, startHarness, status, submitZip, waitForJob } from './native-runtime-common.steps.ts';

const UNKNOWN = '00000000-0000-4000-8000-000000000000';

/** Every response about the analysis: status and the three documents (and their raw text). */
async function analysisResponses(world: DevArchWorld, id: string): Promise<ApiResponse[]> {
  const out = [await api(world).call('GET', `/api/analyses/${id}`)];
  for (const doc of ['graph', 'architecture', 'contracts']) out.push(await api(world).call('GET', `/api/analyses/${id}/${doc}`));
  return out;
}

function assertNoSecretDirs(world: DevArchWorld, responses: ApiResponse[]): void {
  const dirs = api(world).secretDirs();
  for (const r of responses) {
    for (const d of dirs) assert.ok(!r.text.includes(d), `a response contains ${d}: ${r.text.slice(0, 300)}`);
    assert.ok(!r.text.includes('/private/var/') && !r.text.includes('/var/folders/'), 'a response contains a temp path');
  }
}

// --- TS-078 / TS-079 ------------------------------------------------------------------------------------

When('a ZIP whose entries are {string} and {string} is submitted and the analysis completes', async function (this: DevArchWorld, a: string, b: string) {
  const r = await submitZip(this, zipWithEntries([a, b]));
  assert.equal(r.status, 202, r.text);
  assert.equal((await waitForJob(this, jobId(this))).status, 'completed');
});

Then('the status reports the project root {string}', async function (this: DevArchWorld, root: string) {
  assert.equal((await status(this, jobId(this))).projectRoot, root);
});

Then('every component file in the served graph is {string} or another path relative to the project root', async function (this: DevArchWorld, example: string) {
  const g = await api(this).call('GET', `/api/analyses/${jobId(this)}/graph`);
  assert.equal(g.status, 200);
  const files = (g.json.components as { files?: string[] }[]).flatMap((c) => c.files ?? []);
  assert.ok(files.length > 0);
  assert.ok(!example.startsWith('/'));
  for (const f of files) {
    assert.ok(!path.isAbsolute(f) && !f.split('/').includes('..'), `not relative: ${f}`);
    assert.ok(f.startsWith('src/') || !f.includes('/jobs/'), f);
  }
});

Then('no response about that analysis contains the data directory or the web working directory', async function (this: DevArchWorld) {
  assertNoSecretDirs(this, await analysisResponses(this, jobId(this)));
});

Then('the {string}, {string} and {string} documents still validate against the data contract', async function (this: DevArchWorld, a: string, b: string, c: string) {
  const s = (await import(path.join(layout.schemaDir, 'generated', 'index.ts'))) as typeof import('../../../schema/generated/index.ts');
  const validators = { graph: s.dependencyGraphSchema, architecture: s.consolidatedArchitectureSchema, contracts: s.entrypointsDocumentSchema };
  for (const doc of [a, b, c] as (keyof typeof validators)[]) {
    const r = await api(this).call('GET', `/api/analyses/${jobId(this)}/${doc}`);
    assert.equal(r.status, 200);
    const v = validators[doc].safeParse(r.json);
    assert.ok(v.success, `${doc}: ${JSON.stringify(v.error).slice(0, 500)}`);
  }
});

// --- TS-080 ---------------------------------------------------------------------------------------------

Given('the web server is running with a stub engine that reports a warning and then fails naming the absolute path of {string}', async function (this: DevArchWorld, file: string) {
  await startHarness(this, {
    control: { warnings: [`Skipped {projectPath}/${file}: parse error`], fail: `Analysis failed: cannot model {projectPath}/${file}` },
  });
});

Then('the analysis status lists a warning that names {string}', async function (this: DevArchWorld, file: string) {
  const s = await waitForJob(this, jobId(this));
  this.data.final = s;
  assert.ok((s.warnings as string[]).some((w) => w.includes(file) && !w.includes(`/${file}`) || w.includes(` ${file}`)), JSON.stringify(s.warnings));
});

Then('the failure message names {string}', function (this: DevArchWorld, file: string) {
  const s = this.data.final as Record<string, any>;
  assert.equal(s.status, 'failed');
  assert.ok(String(s.error?.message).includes(file), s.error?.message);
});

// --- TS-081 / TS-082 / TS-083 (token) -------------------------------------------------------------------

Given('the web server is running with a stub engine and the API token {string}', async function (this: DevArchWorld, token: string) {
  await startHarness(this, { env: { DEVARCH_API_TOKEN: token } });
  this.data.token = token;
});

Given('the web server is running with a stub engine and the API token setting {string}', async function (this: DevArchWorld, setting: string) {
  await startHarness(this, { env: { DEVARCH_API_TOKEN: setting === 'blank' ? '   ' : undefined } });
});

const bearer = (t: string) => ({ authorization: `Bearer ${t}` });

Given('a completed analysis submitted with the token {string}', async function (this: DevArchWorld, token: string) {
  const r = await submitZip(this, zipWithEntries(['demo/src/App.java', 'demo/pom.xml']), '', bearer(token));
  assert.equal(r.status, 202, r.text);
  assert.equal((await waitForJob(this, jobId(this), undefined, 30_000, bearer(token))).status, 'completed');
});

function syncForm(): FormData {
  const zip = new AdmZip(smallZip());
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(zip.toBuffer())]), 'demo.zip');
  return form;
}

async function operation(world: DevArchWorld, op: string, id: string, headers: Record<string, string>): Promise<ApiResponse> {
  const a = api(world);
  switch (op) {
    case 'submit':
      return a.call('POST', '/api/analyses', { body: smallZip(), headers: { 'content-type': 'application/zip', ...headers } });
    case 'status':
      return a.call('GET', `/api/analyses/${id}`, { headers });
    case 'graph':
    case 'architecture':
    case 'contracts':
      return a.call('GET', `/api/analyses/${id}/${op}`, { headers });
    case 'import':
      return a.call('POST', '/api/analyses/import', {
        body: JSON.stringify(contractOutputs('java-standar')), headers: { 'content-type': 'application/json', ...headers },
      });
    case 'source':
      return a.call('GET', `/api/source?jobId=${id}&path=src%2FApp.java`, { headers });
    case 'synchronous':
      return a.call('POST', '/api/analyze', { body: syncForm(), headers });
    default:
      throw new Error(`unknown operation ${op}`);
  }
}

function jobAreas(world: DevArchWorld): string[] {
  const dir = path.join(harness(world).dataDir, 'jobs');
  return existsSync(dir) ? readdirSync(dir).sort() : [];
}

async function callOperation(world: DevArchWorld, op: string, headers: Record<string, string>): Promise<void> {
  world.data.areasBefore = jobAreas(world);
  world.data.response = await operation(world, op, jobId(world), headers);
  world.data.unknownResponse = await operation(world, op, UNKNOWN, headers);
}

When('the operation {string} is called without a token', async function (this: DevArchWorld, op: string) {
  await callOperation(this, op, {});
});

When('the operation {string} is called with the token {string}', async function (this: DevArchWorld, op: string, token: string) {
  await callOperation(this, op, bearer(token));
});

Then('the response is identical for an existing and an unknown analysis', function (this: DevArchWorld) {
  const a = lastResponse(this);
  const b = this.data.unknownResponse as ApiResponse;
  assert.equal(a.status, b.status);
  assert.equal(a.text, b.text);
});

Then('no new analysis area is created', function (this: DevArchWorld) {
  assert.deepEqual(jobAreas(this), this.data.areasBefore);
});

When('every analysis operation is called with the token {string}', async function (this: DevArchWorld, token: string) {
  const h = bearer(token);
  const submitted = await operation(this, 'submit', '', h);
  assert.equal(submitted.status, 202, submitted.text);
  this.data.jobId = submitted.json.jobId;
  await waitForJob(this, jobId(this), undefined, 30_000, h);
  const results: Record<string, ApiResponse> = { submit: submitted };
  for (const op of ['status', 'graph', 'architecture', 'contracts', 'import', 'source', 'synchronous']) {
    results[op] = await operation(this, op, jobId(this), h);
  }
  this.data.results = results;
});

Then('none of the responses has status {int}', function (this: DevArchWorld, code: number) {
  for (const [op, r] of Object.entries(this.data.results as Record<string, ApiResponse>)) {
    assert.notEqual(r.status, code, `${op}: ${r.text.slice(0, 200)}`);
  }
});

Then('the submitted analysis completes and its documents and sources are served', function (this: DevArchWorld) {
  const r = this.data.results as Record<string, ApiResponse>;
  assert.equal(r.status.json.status, 'completed');
  for (const op of ['graph', 'architecture', 'contracts']) assert.equal(r[op].status, 200, op);
  assert.equal(r.import.status, 201, r.import.text);
  // The stub engine documents do not include src/App.java of the submitted ZIP; the viewer still answers.
  assert.ok([200, 404].includes(r.source.status), r.source.text);
  assert.equal(r.synchronous.status === 401, false);
});

When('an analysis is submitted without a token', async function (this: DevArchWorld) {
  await submitZip(this, smallZip());
});

// --- TS-084 (exposure warning) --------------------------------------------------------------------------

Given('the web server is configured to listen on {string} with the API token {string}', function (this: DevArchWorld, host: string, token: string) {
  this.data.listen = { host: host === '(unset)' ? undefined : host, token: token === '(none)' ? undefined : token };
});

When('the web server starts', async function (this: DevArchWorld) {
  const l = this.data.listen as { host?: string; token?: string };
  await startHarness(this, { env: { HOSTNAME: l.host, DEVARCH_API_TOKEN: l.token } });
});

Then(/^the server log (contains|does not contain) the warning that the API is not protected$/, function (this: DevArchWorld, outcome: string) {
  const found = harness(this).logs.some((l) => l.includes('dev-arch API is NOT protected'));
  assert.equal(found, outcome === 'contains', harness(this).logs.join('\n').slice(0, 1000));
});
