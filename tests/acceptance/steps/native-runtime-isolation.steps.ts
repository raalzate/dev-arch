// US2 — Concurrent analyses are isolated and survive reloads (007 TS-017, TS-018, TS-020, TS-021, TS-022).
// Browser scenarios TS-016 and TS-019 live in native-runtime-browser.steps.ts.
import { Given, Then, When } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { layout } from '../support/layout.ts';
import type { DevArchWorld } from '../support/world.ts';
import {
  api, demoProjectZip, harness, jobId, smallZip, startHarness, status, submitZip, waitForJob,
} from './native-runtime-common.steps.ts';

// --- TS-017 ---------------------------------------------------------------------------------------------

When('the ZIPs of {string} and {string} are submitted at the same time', async function (this: DevArchWorld, a: string, b: string) {
  const [ra, rb] = await Promise.all([a, b].map((p) => api(this).call('POST', '/api/analyses', {
    body: demoProjectZip(p), headers: { 'content-type': 'application/zip' },
  })));
  for (const r of [ra, rb]) assert.equal(r.status, 202, r.text);
  this.data.jobIds = [ra.json.jobId, rb.json.jobId];
  this.data.projects = [a, b];
});

Then('no component of one analysis references a file of the other analysis', async function (this: DevArchWorld) {
  const ids = this.data.jobIds as string[];
  const files = [];
  for (const id of ids) {
    const res = await api(this).call('GET', `/api/analyses/${id}/graph`);
    assert.equal(res.status, 200, res.text);
    const set = new Set<string>((res.json.components ?? []).flatMap((c: { files?: string[] }) => c.files ?? []));
    assert.ok(set.size > 0, `analysis ${id} has no component files`);
    files.push(set);
  }
  const [a, b] = files;
  const shared = [...a].filter((f) => b.has(f));
  assert.deepEqual(shared, [], 'the two analyses share component files');
  // Java components are .java files, .NET components .cs files: each graph only holds its own project.
  const projects = this.data.projects as string[];
  const ext = (p: string) => (p === 'dotnet-ecommerce' ? '.cs' : '.java');
  files.forEach((set, i) => {
    for (const f of set) assert.ok(f.endsWith(ext(projects[i])), `${projects[i]} references ${f}`);
  });
});

// --- TS-018 ---------------------------------------------------------------------------------------------

When('two analyses are submitted at the same time and both complete', async function (this: DevArchWorld) {
  const res = await Promise.all([submitZip(this, smallZip()), submitZip(this, smallZip())]);
  for (const r of res) assert.equal(r.status, 202, r.text);
  const ids = res.map((r) => r.json.jobId as string);
  this.data.jobIds = ids;
  for (const id of ids) assert.equal((await waitForJob(this, id)).status, 'completed');
});

Then('the server working directory contains no {string}, {string} or {string}', function (this: DevArchWorld, a: string, b: string, c: string) {
  const cwd = harness(this).webCwd;
  for (const f of [a, b, c]) assert.equal(existsSync(path.join(cwd, f)), false, `${f} in the server working directory`);
});

Then('each analysis area contains its own three result documents', function (this: DevArchWorld) {
  const h = harness(this);
  const ids = this.data.jobIds as string[];
  const graphs = ids.map((id) => {
    const out = path.join(h.dataDir, 'jobs', id, 'out');
    assert.deepEqual(readdirSync(out).sort(), ['output.json', 'output_architecture.json', 'output_entrypoints.json']);
    return readFileSync(path.join(out, 'output.json'), 'utf8');
  });
  // Each engine call received its own project folder (the stub rebases component files under it).
  ids.forEach((id, i) => assert.ok(graphs[i].includes(path.join(h.dataDir, 'jobs', id, 'source')), `graph of ${id}`));
});

// --- TS-020 ---------------------------------------------------------------------------------------------

Given('an analysis has completed', async function (this: DevArchWorld) {
  await submitZip(this, smallZip());
  assert.equal((await waitForJob(this, jobId(this))).status, 'completed');
});

When('the web server restarts with the same data directory', async function (this: DevArchWorld) {
  await harness(this).restart();
});

Then('the status of that analysis is {string}', async function (this: DevArchWorld, st: string) {
  assert.equal((await status(this, jobId(this))).status, st);
});

Then('its {string}, {string} and {string} documents are still retrievable', async function (this: DevArchWorld, a: string, b: string, c: string) {
  for (const d of [a, b, c]) {
    const res = await api(this).call('GET', `/api/analyses/${jobId(this)}/${d}`);
    assert.equal(res.status, 200, `${d}: ${res.text.slice(0, 300)}`);
    assert.equal(res.json.meta?.schema_version, '1.0.0', d);
  }
});

// --- TS-021 ---------------------------------------------------------------------------------------------

Given('one analysis is running and another is queued', async function (this: DevArchWorld) {
  const ids: string[] = [];
  let queued: string | undefined;
  for (let i = 0; i < 5 && !queued; i++) {
    const r = await submitZip(this, smallZip());
    assert.equal(r.status, 202, r.text);
    ids.push(r.json.jobId);
    if (r.json.status === 'queued') queued = r.json.jobId;
  }
  assert.ok(queued, 'no submission was queued');
  const running = ids[0];
  await waitForJob(this, running, (s) => s.status === 'running', 20_000);
  assert.equal((await status(this, queued)).status, 'queued');
  this.data.pair = [running, queued];
});

Then('both analyses have status {string} with error code {string}', async function (this: DevArchWorld, st: string, code: string) {
  for (const id of this.data.pair as string[]) {
    const s = await status(this, id);
    assert.equal(s.status, st, JSON.stringify(s));
    assert.equal(s.error?.code, code, JSON.stringify(s));
  }
});

// --- TS-022 ---------------------------------------------------------------------------------------------

Given('the web server runs with local folder analysis {string} and a stub engine that records its call intervals', async function (this: DevArchWorld, mode: string) {
  await startHarness(this, {
    env: { DEVARCH_ALLOW_LOCAL_PATH: mode === 'enabled' ? 'true' : 'false' },
    control: { delayMs: 800 },
  });
});

When('two analyses of the same local folder are requested at the same time', async function (this: DevArchWorld) {
  const folder = path.join(layout.engineRoot, 'test-for-demo', 'java-standar');
  this.data.localFolder = folder;
  const res = await Promise.all([0, 1].map(() => api(this).call('POST', '/api/analyses', {
    body: JSON.stringify({ localPath: folder }), headers: { 'content-type': 'application/json' },
  })));
  for (const r of res) assert.equal(r.status, 202, r.text);
  this.data.jobIds = res.map((r) => r.json.jobId);
  for (const id of this.data.jobIds as string[]) await waitForJob(this, id);
});

Then('the engine calls for that folder do not overlap in time', function (this: DevArchWorld) {
  const folder = this.data.localFolder as string;
  const calls = readFileSync(harness(this).intervalsLog, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    .filter((c) => c.projectPath === folder).sort((a, b) => a.start - b.start);
  assert.equal(calls.length, 2, JSON.stringify(calls));
  assert.ok(calls[1].start >= calls[0].end, `overlapping calls: ${JSON.stringify(calls)}`);
});

Then('both analyses complete with identical documents', async function (this: DevArchWorld) {
  const ids = this.data.jobIds as string[];
  for (const id of ids) assert.equal((await status(this, id)).status, 'completed');
  for (const doc of ['graph', 'architecture', 'contracts']) {
    const [a, b] = await Promise.all(ids.map((id) => api(this).call('GET', `/api/analyses/${id}/${doc}`)));
    assert.equal(a.status, 200);
    assert.equal(a.text, b.text, `${doc} differs`);
  }
});
