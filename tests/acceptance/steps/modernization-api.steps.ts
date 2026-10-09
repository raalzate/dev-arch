// API acceptance steps of 010-modernization-ux with the in-process web harness and the stub engine
// (fake-mcp-server.mjs): history, inference defaults, re-inference, scoring, token and contract validation.
import { Given, Then, When } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { consolidatedArchitectureSchema } from '@static-inference/schema';
import { scoreProposalResponseSchema } from '@static-inference/schema/extensions';
import { layout } from '../support/layout.ts';
import type { WebHarness } from '../support/web-harness.ts';
import type { DevArchWorld } from '../support/world.ts';
import { api, harness, jobId, lastResponse, smallZip, startHarness, submitZip, waitForJob } from './native-runtime-common.steps.ts';

const PANEL = [
  'viability.thresholds.high', 'viability.thresholds.medium', 'viability.weights.cohesion', 'viability.weights.coupling',
  'viability.weights.data', 'evidence.evidenceThreshold', 'clustering.largeClusterRatio',
];

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

function schemaNode(schema: Record<string, any>, dotted: string): Record<string, any> {
  return dotted.split('.').reduce<Record<string, any>>((n, k) => n.properties[k], schema);
}

// --- setup ----------------------------------------------------------------------------------------------

Given('the web runs with the stub engine', async function (this: DevArchWorld) {
  const h = await startHarness(this);
  h.updateControl({ callsLog: callsLog(h) });
});

Given('the web runs with the stub engine and the API token {string}', async function (this: DevArchWorld, token: string) {
  const h = await startHarness(this, { env: { DEVARCH_API_TOKEN: token } });
  h.updateControl({ callsLog: callsLog(h) });
  this.data.token = token;
});

async function completedAnalysis(world: DevArchWorld): Promise<string> {
  const headers: Record<string, string> = world.data.token ? { authorization: `Bearer ${world.data.token}` } : {};
  const res = await submitZip(world, smallZip(), '', headers);
  assert.equal(res.status, 202, res.text);
  const s = await waitForJob(world, res.json.jobId, undefined, 60_000, headers);
  assert.equal(s.status, 'completed', JSON.stringify(s));
  return res.json.jobId as string;
}

Given('a completed analysis of the stub engine', async function (this: DevArchWorld) {
  this.data.analysisId = await completedAnalysis(this);
  const arch = await api(this).call('GET', `/api/analyses/${this.data.analysisId}/architecture`);
  assert.equal(arch.status, 200, arch.text);
  this.data.storedArchitecture = arch.text;
});

Given('two completed analyses of the stub engine created one after the other', async function (this: DevArchWorld) {
  const first = await completedAnalysis(this);
  await new Promise((r) => setTimeout(r, 20));
  const second = await completedAnalysis(this);
  this.data.pairIds = [first, second];
});

Given('the stub engine rejects configurations with {string}', function (this: DevArchWorld, message: string) {
  harness(this).updateControl({ reinferFail: message });
});

Given('the stub engine rejects components with {string}', function (this: DevArchWorld, message: string) {
  harness(this).updateControl({ scoreFail: message });
});

Given('the stub engine answers score_proposal with a body that violates the contract', function (this: DevArchWorld) {
  harness(this).updateControl({ scoreInvalid: true });
});

// --- calls ----------------------------------------------------------------------------------------------

When('the client requests the inference defaults', async function (this: DevArchWorld) {
  this.data.response = await api(this).call('GET', '/api/inference/defaults');
});

async function reinfer(world: DevArchWorld, body: Record<string, unknown>) {
  world.data.reinferBody = body;
  world.data.response = await api(world).call('POST', `/api/analyses/${world.data.analysisId}/reinfer`, {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

When(
  /^the client re-infers that analysis with the configuration (\{.*\}) and the minimum viability "([^"]*)"$/,
  async function (this: DevArchWorld, json: string, min: string) {
    await reinfer(this, { config: JSON.parse(json), minViability: min });
  },
);

When(/^the client re-infers that analysis with the configuration (\{.*\})$/, async function (this: DevArchWorld, json: string) {
  await reinfer(this, { config: JSON.parse(json) });
});

async function score(world: DevArchWorld, components: string[]) {
  world.data.scored = components;
  world.data.response = await api(world).call('POST', `/api/analyses/${world.data.analysisId}/score`, {
    body: JSON.stringify({ components }),
    headers: { 'content-type': 'application/json' },
  });
}

When('the client scores the components {string} and {string} of that analysis', async function (this: DevArchWorld, a: string, b: string) {
  await score(this, [a, b]);
});

When('the client scores the components {string} of that analysis', async function (this: DevArchWorld, a: string) {
  await score(this, [a]);
});

When('the client lists the analyses', async function (this: DevArchWorld) {
  this.data.response = await api(this).call('GET', '/api/analyses');
});

When('the client calls {string} without a token', async function (this: DevArchWorld, op: string) {
  const [method, rawPath] = op.split(' ');
  const id = '11111111-1111-4111-8111-111111111111';
  this.data.response = await api(this).call(method, rawPath.replace('{id}', id), method === 'POST'
    ? { body: JSON.stringify({ components: ['a'] }), headers: { 'content-type': 'application/json' } }
    : {});
});

// --- assertions -----------------------------------------------------------------------------------------

Then(
  'the response lists the parameters {string}, {string}, {string}, {string}, {string}, {string} and {string}',
  function (this: DevArchWorld, a: string, b: string, c: string, d: string, e: string, f: string, g: string) {
    const names = [a, b, c, d, e, f, g];
    const r = lastResponse(this);
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(r.json.parameters.map((p: { path: string }) => p.path), names);
    assert.deepEqual(names, PANEL);
  },
);

Then(
  'each parameter has the default value published by the engine and the minimum and maximum of the inference configuration contract',
  function (this: DevArchWorld) {
    const r = lastResponse(this);
    const defaults = JSON.parse(readFileSync(path.join(layout.productRoot, 'tests', 'acceptance', 'fixtures', 'inference-defaults.json'), 'utf8'));
    const schema = JSON.parse(readFileSync(path.join(layout.schemaDir, '1.0.0', 'inference-config.schema.json'), 'utf8'));
    for (const p of r.json.parameters as { path: string; default: number; min: number; max: number }[]) {
      assert.equal(p.default, get(defaults, p.path), p.path);
      const node = schemaNode(schema, p.path);
      assert.equal(p.min, node.minimum, p.path);
      assert.equal(p.max, node.maximum, p.path);
    }
  },
);

Then('the response status is {int} and the body is a valid consolidated architecture', function (this: DevArchWorld, code: number) {
  const r = lastResponse(this);
  assert.equal(r.status, code, r.text);
  const check = consolidatedArchitectureSchema.safeParse(r.json);
  assert.ok(check.success, r.text.slice(0, 500));
});

Then('the response status is {int} and the body is a valid proposal score', function (this: DevArchWorld, code: number) {
  const r = lastResponse(this);
  assert.equal(r.status, code, r.text);
  assert.ok(scoreProposalResponseSchema.safeParse(r.json).success, r.text.slice(0, 500));
});

Then(
  'the engine received {string} with the analysis identifier, that configuration and that minimum viability',
  function (this: DevArchWorld, tool: string) {
    const body = this.data.reinferBody as { config: unknown; minViability: string };
    const call = toolCalls(harness(this)).filter((c) => c.name === tool).pop();
    assert.ok(call, `${tool} was not called`);
    assert.equal(call.args.jobId, this.data.analysisId);
    assert.deepEqual(call.args.config, body.config);
    assert.equal(call.args.minViability, body.minViability);
    assert.ok(!('graphPath' in call.args), 'a server path was sent instead of the analysis identifier');
  },
);

Then('the engine received {string} with the analysis identifier and those components', function (this: DevArchWorld, tool: string) {
  const call = toolCalls(harness(this)).filter((c) => c.name === tool).pop();
  assert.ok(call, `${tool} was not called`);
  assert.equal(call.args.jobId, this.data.analysisId);
  assert.deepEqual(call.args.components, this.data.scored);
});

Then('the stored architecture document of the analysis is unchanged', async function (this: DevArchWorld) {
  const id = (this.data.analysisId as string | undefined) ?? jobId(this);
  const now = await api(this).call('GET', `/api/analyses/${id}/architecture`);
  assert.equal(now.status, 200);
  assert.equal(now.text, this.data.storedArchitecture);
});

Then(
  'the response status is {int} with the error code {string} and the engine message',
  function (this: DevArchWorld, code: number, err: string) {
    const r = lastResponse(this);
    assert.equal(r.status, code, r.text);
    assert.equal(r.json.error?.code, err, r.text);
    const ctl = JSON.parse(readFileSync(harness(this).controlFile, 'utf8'));
    const message = (ctl.reinferFail ?? ctl.scoreFail) as string;
    assert.equal(r.json.error?.message, message);
  },
);

Then('the response status is {int} with the error code {string}', function (this: DevArchWorld, code: number, err: string) {
  const r = lastResponse(this);
  assert.equal(r.status, code, r.text);
  assert.equal(r.json.error?.code, err, r.text);
});

Then('the response lists both analyses, the most recent first', function (this: DevArchWorld) {
  const r = lastResponse(this);
  assert.equal(r.status, 200, r.text);
  const ids = (r.json.analyses as { jobId: string }[]).map((a) => a.jobId);
  const [first, second] = this.data.pairIds as string[];
  assert.ok(ids.indexOf(second) >= 0 && ids.indexOf(first) > ids.indexOf(second), JSON.stringify(ids));
});

Then('each completed analysis declares its technology', function (this: DevArchWorld) {
  for (const a of lastResponse(this).json.analyses as { status: string; technology: string | null; technologyLabel: string | null }[]) {
    if (a.status === 'completed') {
      assert.equal(a.technology, 'java');
      assert.equal(a.technologyLabel, 'Java');
    }
  }
});

Then('the response contains no absolute server path', function (this: DevArchWorld) {
  const text = lastResponse(this).text;
  for (const d of api(this).secretDirs()) assert.ok(!text.includes(d), `response leaks ${d}`);
});
