// POST /api/analyses/{id}/score — scoring of an edited proposal with the stub engine (010 FR-026; contracts/
// web-api.md). Kept outside the [id] folder: `node --test` reads square brackets in file names as glob classes.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { POST } from './[id]/score/route.ts';
import { ctxId, jsonRequest, setupRouteEnv, VALID_ID, type RouteEnv } from '../../../server/testing/route-harness.test.ts';

let env: RouteEnv;
let callsLog: string;
before(async () => {
  env = await setupRouteEnv();
  callsLog = path.join(env.dir, 'calls.jsonl');
  env.setControl({ callsLog });
});
after(async () => {
  await env.restore();
});

const post = (id: string, body: unknown) => POST(jsonRequest(`http://localhost/api/analyses/${id}/score`, body), ctxId(id));

test('a valid component list is scored by the engine and answers 200 with the validated score', async () => {
  const { job } = await env.completedJob();
  const res = await post(job.id, { components: ['a.A', 'b.B'] });
  assert.equal(res.status, 200, await res.clone().text());
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const body = await res.json();
  assert.equal(body.name, 'Propuesta editada');
  assert.equal(body.viability, 'Media');
  assert.deepEqual(body.components, ['a.A', 'b.B']);
  assert.equal(body.metrics.size, 2);
  const call = readFileSync(callsLog, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).pop();
  assert.deepEqual(call, { name: 'score_proposal', args: { jobId: job.id, components: ['a.A', 'b.B'] } });
});

test('missing or empty components answer 400 INVALID_REQUEST', async () => {
  const { job } = await env.completedJob();
  for (const body of [{}, { components: [] }, { components: ['ok', ''] }, { components: 'a.A' }]) {
    const res = await post(job.id, body);
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.match((await res.json()).error.message, /"components" must be a non-empty array/);
  }
});

test('an invalid inference configuration is rejected with 400 before reaching the engine', async () => {
  const { job } = await env.completedJob();
  const res = await post(job.id, { components: ['a.A'], config: { viability: { thresholds: { high: 'x' } } } });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error.message, /^Invalid inference configuration: viability\.thresholds\.high/);
});

test('unknown components reported by the engine answer 422 UNKNOWN_COMPONENTS', async () => {
  const { job } = await env.completedJob();
  env.setControl({ callsLog, scoreFail: 'Unknown components: z.Z' });
  try {
    const res = await post(job.id, { components: ['z.Z'] });
    assert.equal(res.status, 422);
    assert.equal((await res.json()).error.code, 'UNKNOWN_COMPONENTS');
  } finally {
    env.setControl({ callsLog });
  }
});

test('an engine answer that violates the contract answers 502 ENGINE_ERROR', async () => {
  const { job } = await env.completedJob();
  env.setControl({ callsLog, scoreInvalid: true });
  try {
    const res = await post(job.id, { components: ['a.A'] });
    assert.equal(res.status, 502);
    const body = await res.json();
    assert.equal(body.error.code, 'ENGINE_ERROR');
    assert.match(body.error.message, /score_proposal response violates the contract/);
  } finally {
    env.setControl({ callsLog });
  }
});

test('a failed analysis answers 409 and an unknown one 404', async () => {
  const failed = await env.rt().store.create({ origin: 'zip', language: 'auto', status: 'failed' });
  const res = await post(failed.id, { components: ['a.A'] });
  assert.equal(res.status, 409);
  assert.equal((await post(VALID_ID, { components: ['a.A'] })).status, 404);
});
