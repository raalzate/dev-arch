// US4 — Source viewer restricted to the analysis project (007 TS-034..TS-038; TS-039 is a browser scenario).
import { Given, Then, When } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { zipWithEntries } from '../support/zip-catalog.ts';
import type { DevArchWorld } from '../support/world.ts';
import { api, harness, jobId, lastResponse, submitZip, waitForJob } from './native-runtime-common.steps.ts';

async function completedZip(world: DevArchWorld, entries: string[]): Promise<{ id: string; root: string; zip: Buffer }> {
  const zip = zipWithEntries(entries);
  const r = await submitZip(world, zip);
  assert.equal(r.status, 202, r.text);
  const id = r.json.jobId as string;
  assert.equal((await waitForJob(world, id)).status, 'completed');
  const job = await (await harness(world).runtime()).store.get(id);
  assert.ok(job?.projectRoot);
  return { id, root: job.projectRoot, zip };
}

Given('a completed analysis of a ZIP whose entries are {string} and {string}', async function (this: DevArchWorld, a: string, b: string) {
  const { id, root } = await completedZip(this, [a, b]);
  this.data.firstJob = id;
  this.data.projectRoot = root;
  this.data.entries = { [a]: a, [b]: b };
});

function sourceUrl(id: string, p: string): string {
  return `/api/source?jobId=${id}&path=${encodeURIComponent(p)}`;
}

When('the source {string} of that analysis is requested', async function (this: DevArchWorld, p: string) {
  this.data.response = await api(this).call('GET', sourceUrl(jobId(this), p));
});

When('the source {string} of the first analysis is requested', async function (this: DevArchWorld, p: string) {
  this.data.response = await api(this).call('GET', sourceUrl(this.data.firstJob as string, p));
});

Then('the content equals the content of the entry {string}', async function (this: DevArchWorld, entry: string) {
  const { default: AdmZip } = await import('adm-zip');
  const expected = new AdmZip(zipWithEntries([entry])).getEntry(entry)!.getData().toString('utf8');
  assert.equal(lastResponse(this).json.content, expected);
});

Given('the project of that analysis contains a symbolic link {string} pointing outside the project', function (this: DevArchWorld, link: string) {
  const root = this.data.projectRoot as string;
  const outside = path.join(harness(this).root, 'outside-secret.java');
  writeFileSync(outside, 'class OutsideSecret { String secret = "TOP-SECRET"; }\n');
  symlinkSync(outside, path.join(root, link));
});

Then('the response contains no file content', function (this: DevArchWorld) {
  const r = lastResponse(this);
  assert.equal(r.json.content, undefined);
  assert.ok(!r.text.includes('TOP-SECRET') && !r.text.includes('root:'), r.text);
});

Given('another completed analysis whose project contains {string}', async function (this: DevArchWorld, file: string) {
  const first = this.data.firstJob as string;
  await completedZip(this, [`other/${file}`, 'other/pom.xml']);
  this.data.jobId = first;
});

Given('the web server source view limit is {int} KB', async function (this: DevArchWorld, kb: number) {
  harness(this).setEnv('MAX_SOURCE_VIEW_BYTES', String(kb * 1024));
  await harness(this).restart();
});

Given(/^the project of that analysis contains "(.*)"$/, function (this: DevArchWorld, fixture: string) {
  const root = this.data.projectRoot as string;
  const name = /"([^"]+)"/.exec(fixture)?.[1];
  if (fixture.startsWith('a directory')) mkdirSync(path.join(root, name!), { recursive: true });
  else if (fixture.startsWith('a file')) {
    mkdirSync(path.dirname(path.join(root, name!)), { recursive: true });
    writeFileSync(path.join(root, name!), 'content\n');
  } else if (/^a (\d+) KB file/.test(fixture)) {
    const kb = Number(/^a (\d+) KB/.exec(fixture)![1]);
    writeFileSync(path.join(root, name!), `// ${'x'.repeat(kb * 1024)}\n`);
  } else assert.equal(fixture, 'nothing else');
});

When('the source viewer is called with only the path {string} and no analysis identifier', async function (this: DevArchWorld, p: string) {
  this.data.response = await api(this).call('GET', `/api/source?path=${encodeURIComponent(p)}`);
});
