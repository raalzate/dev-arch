// US1 — Asynchronous analysis of an uploaded project (007 TS-001..TS-012).
// TS-011 reuses the 006 steps "the staged engine archive does not exist" and "no engine path override is configured".
import { Given, Then, When } from '@cucumber/cucumber';
import AdmZip from 'adm-zip';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { layout } from '../support/layout.ts';
import type { DevArchWorld } from '../support/world.ts';
import {
  api, demoProjectZip, harness, jobId, lastResponse, smallZip, startHarness, status, submitZip, UUID_RE, waitForJob,
} from './native-runtime-common.steps.ts';

type Schema = typeof import('../../../schema/generated/index.ts');
const schema = async () => (await import(path.join(layout.schemaDir, 'generated', 'index.ts'))) as Schema;

// --- TS-001 ---------------------------------------------------------------------------------------------

Then('the response arrives within {int} seconds with status {int}', function (this: DevArchWorld, s: number, code: number) {
  const r = lastResponse(this);
  assert.equal(r.status, code, r.text);
  assert.ok(r.elapsedMs < s * 1000, `the registration took ${r.elapsedMs} ms`);
});

Then('the response contains a job identifier in UUID format', function (this: DevArchWorld) {
  assert.match(String(lastResponse(this).json.jobId), UUID_RE);
});

Then('the status of that analysis is {string} or {string}', async function (this: DevArchWorld, a: string, b: string) {
  const s = await status(this, jobId(this));
  assert.ok([a, b].includes(s.status), JSON.stringify(s));
});

// --- TS-002 ---------------------------------------------------------------------------------------------

Given('the web server is running with a stub engine that reports the phases {string}', async function (this: DevArchWorld, phases: string) {
  assert.equal(phases, 'detection, extraction, inference, writing');
  const warnings = ['Skipped src/Legacy.java: parse error'];
  this.data.expectedWarnings = warnings;
  await startHarness(this, { control: { delayMs: 1200, phases: true, warnings } });
});

When('an analysis is submitted and its status is polled until it finishes', async function (this: DevArchWorld) {
  const res = await submitZip(this, smallZip());
  assert.equal(res.status, 202, res.text);
  this.data.final = await waitForJob(this, jobId(this));
});

Then('every observed phase belongs to {string} and the phases never go backwards', function (this: DevArchWorld, list: string) {
  const allowed = list.split(',').map((p) => p.trim());
  const seen = (this.data.observed as Record<string, Record<string, any>[]>)[jobId(this)].map((s) => s.phase).filter((p) => p !== null);
  assert.ok(seen.length > 0, 'no phase was observed');
  let last = -1;
  for (const p of seen) {
    const i = allowed.indexOf(p);
    assert.ok(i >= 0, `unexpected phase ${p}`);
    assert.ok(i >= last, `phase went backwards: ${seen.join(' -> ')}`);
    last = i;
  }
  assert.ok(new Set(seen).size >= 2, `only ${[...new Set(seen)]} observed`);
});

Then('the final status is {string} with creation, start and finish timestamps', function (this: DevArchWorld, st: string) {
  const s = this.data.final as Record<string, any>;
  assert.equal(s.status, st, JSON.stringify(s));
  for (const k of ['createdAt', 'startedAt', 'finishedAt']) assert.ok(!Number.isNaN(Date.parse(s[k])), `${k}: ${s[k]}`);
  assert.ok(Date.parse(s.createdAt) <= Date.parse(s.startedAt) && Date.parse(s.startedAt) <= Date.parse(s.finishedAt));
});

Then('the final status lists the warnings reported by the engine', function (this: DevArchWorld) {
  assert.deepEqual((this.data.final as Record<string, any>).warnings, this.data.expectedWarnings);
});

// --- TS-003 / TS-004 ------------------------------------------------------------------------------------

async function document(world: DevArchWorld, doc: string): Promise<Record<string, any>> {
  const res = await api(world).call('GET', `/api/analyses/${jobId(world)}/${doc}`);
  assert.equal(res.status, 200, `${doc}: ${res.text.slice(0, 500)}`);
  assert.match(res.headers.get('content-type') ?? '', /application\/json/);
  return res.json;
}

Then('the {string}, {string} and {string} documents are each retrievable on their own', async function (this: DevArchWorld, a: string, b: string, c: string) {
  const docs: Record<string, Record<string, any>> = {};
  for (const d of [a, b, c]) docs[d] = await document(this, d);
  assert.deepEqual(Object.keys(docs), [a, b, c]);
  assert.notDeepEqual(docs[a], docs[b], 'each document is served on its own');
  this.data.docs = docs;
});

Then('each document declares the contract version {string} and validates against the data contract', async function (this: DevArchWorld, version: string) {
  const s = await schema();
  const docs = this.data.docs as Record<string, Record<string, any>>;
  const validators: Record<string, { safeParse: (x: unknown) => { success: boolean; error?: unknown } }> = {
    graph: s.dependencyGraphSchema, architecture: s.consolidatedArchitectureSchema, contracts: s.entrypointsDocumentSchema,
  };
  for (const [name, doc] of Object.entries(docs)) {
    assert.equal(doc.meta?.schema_version, version, `${name} meta.schema_version`);
    const r = validators[name].safeParse(doc);
    assert.ok(r.success, `${name}: ${JSON.stringify(r.error).slice(0, 1000)}`);
  }
});

Then('the graph has at least one component and the architecture at least one proposal', function (this: DevArchWorld) {
  const docs = this.data.docs as Record<string, Record<string, any>>;
  assert.ok((docs.graph.components ?? []).length >= 1);
  assert.ok((docs.architecture.proposals ?? []).length >= 1);
});

Then('the graph declares a .NET source', async function (this: DevArchWorld) {
  const g = await document(this, 'graph');
  assert.ok(['roslyn', 'roslyn-fallback'].includes(g.meta?.source), `meta.source ${g.meta?.source}`);
});

Then('the architecture has at least one proposal', async function (this: DevArchWorld) {
  const a = await document(this, 'architecture');
  assert.ok((a.proposals ?? []).length >= 1);
});

// --- TS-005 / TS-006 / TS-007 ---------------------------------------------------------------------------

Given('an analysis that is still running', async function (this: DevArchWorld) {
  await startHarness(this, { control: { delayMs: 30_000 } });
  await submitZip(this, smallZip());
  await waitForJob(this, jobId(this), (s) => s.status === 'running' && s.phase !== null, 20_000);
});

When('its {string} document is requested', async function (this: DevArchWorld, doc: string) {
  this.data.response = await api(this).call('GET', `/api/analyses/${jobId(this)}/${doc}`);
});

Then('the response reports the current status and phase', function (this: DevArchWorld) {
  const e = lastResponse(this).json.error;
  assert.equal(e.status, 'running');
  assert.ok(['detection', 'extraction', 'inference', 'writing'].includes(e.phase), JSON.stringify(e));
});

Given('an analysis that failed with error code {string}', async function (this: DevArchWorld, code: string) {
  assert.equal(code, 'ENGINE_ERROR');
  await startHarness(this, { control: { fail: 'Analysis failed: the model could not be built' } });
  await submitZip(this, smallZip());
  const s = await waitForJob(this, jobId(this));
  assert.equal(s.error?.code, code, JSON.stringify(s));
});

Then('the response includes the failure reason', function (this: DevArchWorld) {
  const e = lastResponse(this).json.error;
  assert.equal(e.error?.code, 'ENGINE_ERROR', JSON.stringify(e));
  assert.match(e.error?.message ?? '', /model could not be built/);
});

When('the {string} of the analysis {string} is requested', async function (this: DevArchWorld, resource: string, id: string) {
  if (!this.data.api) await startHarness(this);
  const suffix = resource === 'status' ? '' : `/${resource}`;
  this.data.response = await api(this).call('GET', `/api/analyses/${id}${suffix}`);
});

// --- TS-008 / TS-009 ------------------------------------------------------------------------------------

function ambiguousZip(a: string, b: string): Buffer {
  const zip = new AdmZip(demoProjectZip('java-standar'));
  for (const marker of [a, b]) {
    if (!zip.getEntry(`java-standar/${marker}`)) {
      zip.addFile(`java-standar/${marker}`, Buffer.from(marker.endsWith('.csproj')
        ? '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>\n'
        : '<project><modelVersion>4.0.0</modelVersion></project>\n'));
    }
  }
  return zip.toBuffer();
}

When('a ZIP containing both {string} and {string} markers is submitted without a language', async function (this: DevArchWorld, a: string, b: string) {
  const res = await submitZip(this, ambiguousZip(a, b));
  assert.equal(res.status, 202, res.text);
});

When('a ZIP containing both {string} and {string} markers is submitted with the language {string}', async function (this: DevArchWorld, a: string, b: string, language: string) {
  const res = await submitZip(this, ambiguousZip(a, b), `?language=${language}`);
  assert.equal(res.status, 202, res.text);
});

Then('the failure message mentions {string}', function (this: DevArchWorld, word: string) {
  const s = this.data.final as Record<string, any>;
  assert.ok(String(s.error?.message).includes(word), JSON.stringify(s.error));
});

Then('the graph declares a {string} source', async function (this: DevArchWorld, source: string) {
  const g = await document(this, 'graph');
  const expected = source === 'Java' ? ['spoon'] : ['roslyn', 'roslyn-fallback'];
  assert.ok(expected.includes(g.meta?.source), `meta.source ${g.meta?.source} for ${source}`);
});

// --- TS-010 ---------------------------------------------------------------------------------------------

When('a ZIP is submitted with the language {string}', async function (this: DevArchWorld, language: string) {
  await submitZip(this, smallZip(), `?language=${encodeURIComponent(language)}`);
});

Then('no analysis area is created', function (this: DevArchWorld) {
  const jobs = path.join(harness(this).dataDir, 'jobs');
  assert.deepEqual(existsSync(jobs) ? readdirSync(jobs) : [], []);
});

// --- TS-011 (reuses the 006 Given steps) ----------------------------------------------------------------

When('a ZIP is submitted for analysis', async function (this: DevArchWorld) {
  const cwd = this.data.webCwd as string;
  assert.ok(cwd, 'the 006 step "the staged engine archive does not exist" sets the web working directory');
  await startHarness(this, { cwd, noEngine: true });
  await submitZip(this, smallZip());
});

Then('the error message names {string}, the engine path that was tried and {string}', function (this: DevArchWorld, first: string, second: string) {
  const message = String(lastResponse(this).json.error?.message ?? '');
  assert.ok(message.includes(first), message);
  assert.ok(message.includes(path.join(this.data.webCwd as string, 'engine-dist', 'engine.jar')), message);
  assert.ok(message.includes(second), message);
});

// --- TS-012 ---------------------------------------------------------------------------------------------

Given('the web server runs with local folder analysis {string}', async function (this: DevArchWorld, mode: string) {
  await startHarness(this, { env: { DEVARCH_ALLOW_LOCAL_PATH: mode === 'enabled' ? 'true' : 'false' } });
});

When('an analysis of the local folder of the demo project {string} is requested', async function (this: DevArchWorld, project: string) {
  const folder = path.join(layout.engineRoot, 'test-for-demo', project);
  this.data.localFolder = folder;
  this.data.response = await api(this).call('POST', '/api/analyses', {
    body: JSON.stringify({ localPath: folder }),
    headers: { 'content-type': 'application/json' },
  });
  if (this.data.response && (this.data.response as { status: number }).status === 202) {
    this.data.jobId = (this.data.response as { json: { jobId: string } }).json.jobId;
  }
});
