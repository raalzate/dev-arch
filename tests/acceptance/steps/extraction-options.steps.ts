// 026-web-extraction-options: extraction configuration submitted with the ZIP, kept with the analysis, forwarded to
// analyze_project (stub engine records the call) and rejected when malformed. In-process web harness.
import { Given, Then, When } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { WebHarness } from '../support/web-harness.ts';
import type { DevArchWorld } from '../support/world.ts';
import { harness, jobId, lastResponse, smallZip, status, submitZip, waitForJob } from './native-runtime-common.steps.ts';
import { DEFAULT_EXTRACTION, toExtractionConfig } from '../../../web/src/lib/extraction-options.ts';

function callsLog(h: WebHarness): string {
  return path.join(h.root, 'tool-calls.jsonl');
}
function toolCalls(h: WebHarness): { name: string; args: Record<string, unknown> }[] {
  const f = callsLog(h);
  if (!existsSync(f)) return [];
  return readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}
const get = (obj: unknown, dotted: string): unknown =>
  dotted.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj);

Given('the stub engine rejects the configuration with {string}', function (this: DevArchWorld, message: string) {
  const h = harness(this);
  h.updateControl({ callsLog: callsLog(h), rejectConfig: message });
});

When('a ZIP is submitted with the extraction config:', async function (this: DevArchWorld, json: string) {
  const h = harness(this);
  h.updateControl({ callsLog: callsLog(h) });
  await submitZip(this, smallZip(), `?language=auto&config=${encodeURIComponent(JSON.stringify(JSON.parse(json)))}`);
});

When('a ZIP is submitted without extraction config', async function (this: DevArchWorld) {
  const h = harness(this);
  h.updateControl({ callsLog: callsLog(h) });
  await submitZip(this, smallZip(), '?language=auto');
});

When(/^a ZIP is submitted with the raw config query "(.*)"$/, async function (this: DevArchWorld, raw: string) {
  await submitZip(this, smallZip(), `?language=auto&config=${encodeURIComponent(raw)}`);
});

When('a ZIP is submitted with an extraction config of {int} characters', async function (this: DevArchWorld, n: number) {
  const padding = 'x'.repeat(Math.max(0, n - 20));
  await submitZip(this, smallZip(), `?language=auto&config=${encodeURIComponent(JSON.stringify({ note: padding }))}`);
});

Then('the analysis fails with code {string} and a message containing {string}', async function (this: DevArchWorld, code: string, text: string) {
  assert.equal(lastResponse(this).status, 202, JSON.stringify(lastResponse(this).json));
  const job = await waitForJob(this, jobId(this));
  assert.equal(job.status, 'failed', JSON.stringify(job));
  assert.equal(job.error?.code, code, JSON.stringify(job.error));
  assert.ok(String(job.error?.message).includes(text), JSON.stringify(job.error));
});

Then('the analysis status exposes the extraction config with {string} equal to {int}', async function (this: DevArchWorld, dotted: string, value: number) {
  const s = await status(this, jobId(this));
  assert.equal(get(s.extractionConfig, dotted), value, JSON.stringify(s.extractionConfig));
});

Then('the analysis status exposes no extraction config', async function (this: DevArchWorld) {
  const s = await status(this, jobId(this));
  assert.equal(s.extractionConfig, null, JSON.stringify(s.extractionConfig));
});

Then('the engine received analyze_project with {string} equal to {string}', function (this: DevArchWorld, dotted: string, value: string) {
  const calls = toolCalls(harness(this)).filter((c) => c.name === 'analyze_project');
  assert.ok(calls.length > 0, 'no analyze_project call recorded');
  assert.equal(get(calls[calls.length - 1].args, dotted), value, JSON.stringify(calls));
});

Then('the engine received analyze_project without {string}', function (this: DevArchWorld, key: string) {
  const calls = toolCalls(harness(this)).filter((c) => c.name === 'analyze_project');
  assert.ok(calls.length > 0, 'no analyze_project call recorded');
  assert.equal(key in calls[calls.length - 1].args, false, JSON.stringify(calls));
});

Then('the response is {int} with code {string}', function (this: DevArchWorld, statusCode: number, code: string) {
  const res = lastResponse(this);
  assert.equal(res.status, statusCode, JSON.stringify(res.json));
  assert.equal(res.json.error?.code ?? res.json.code, code, JSON.stringify(res.json));
});

When('the extraction options are extended {word}, max depth {int} and reference assemblies {string}', function (this: DevArchWorld, extended: string, depth: number, refs: string) {
  this.data.extractionConfig = toExtractionConfig({ ...DEFAULT_EXTRACTION, extended: extended === 'true', maxDepth: depth, referenceAssemblies: refs });
});

Then('the extraction config sent is {}', function (this: DevArchWorld, json: string) {
  assert.deepEqual(this.data.extractionConfig, JSON.parse(json));
});
