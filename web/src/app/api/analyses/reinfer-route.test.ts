// POST /api/analyses/{id}/reinfer — re-inference with the stub engine (010 FR-023, FR-024; contracts/web-api.md).
// Kept outside the [id] folder: `node --test` reads square brackets in file names as glob classes.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { POST } from './[id]/reinfer/route.ts';
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

const post = (id: string, body: unknown, headers: Record<string, string> = {}) =>
  POST(jsonRequest(`http://localhost/api/analyses/${id}/reinfer`, body, headers), ctxId(id));
const lastCall = () => readFileSync(callsLog, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).pop();

test('a completed analysis is re-inferred by the engine and answers 200 with the architecture', async () => {
  const { job } = await env.completedJob();
  const res = await post(job.id, { minViability: 'Media', config: { viability: { thresholds: { high: 0.8 } } } });
  assert.equal(res.status, 200, await res.clone().text());
  assert.equal(res.headers.get('content-type'), 'application/json; charset=utf-8');
  const arch = await res.json();
  assert.ok(Array.isArray(arch.proposals) && arch.proposals.length > 0);
  assert.deepEqual(lastCall(), {
    name: 'reinfer_architecture',
    args: { jobId: job.id, minViability: 'Media', config: { viability: { thresholds: { high: 0.8 } } } },
  });
});

test('an empty body re-infers with the engine defaults (only the jobId is sent)', async () => {
  const { job } = await env.completedJob();
  const res = await POST(new Request(`http://localhost/api/analyses/${job.id}/reinfer`, { method: 'POST' }), ctxId(job.id));
  assert.equal(res.status, 200);
  assert.deepEqual(lastCall(), { name: 'reinfer_architecture', args: { jobId: job.id } });
});

test('an invalid minViability answers 400 INVALID_REQUEST without calling the engine', async () => {
  const { job } = await env.completedJob();
  const before = readFileSync(callsLog, 'utf8');
  const res = await post(job.id, { minViability: 'Excelente' });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, 'INVALID_REQUEST');
  assert.match(body.error.message, /Invalid minViability 'Excelente'/);
  assert.equal(readFileSync(callsLog, 'utf8'), before);
});

test('a body that is not JSON answers 400 and a non-object body answers 400', async () => {
  const { job } = await env.completedJob();
  const res = await post(job.id, '{nope');
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.message, 'The JSON body is not valid.');
  const arr = await post(job.id, [1, 2]);
  assert.equal(arr.status, 400);
  assert.equal((await arr.json()).error.message, 'The JSON body must be an object.');
});

test('a body above 64 KiB answers 413 BODY_TOO_LARGE', async () => {
  const { job } = await env.completedJob();
  const res = await post(job.id, { pad: 'x'.repeat(70 * 1024) });
  assert.equal(res.status, 413);
  assert.equal((await res.json()).error.code, 'BODY_TOO_LARGE');
});

test('an engine configuration error answers 422 INFERENCE_CONFIG_INVALID with the engine message', async () => {
  const { job } = await env.completedJob();
  env.setControl({ callsLog, reinferFail: 'Invalid inference configuration: viability.weights: must sum to 1' });
  try {
    const res = await post(job.id, {});
    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.error.code, 'INFERENCE_CONFIG_INVALID');
    assert.equal(body.error.message, 'Invalid inference configuration: viability.weights: must sum to 1');
  } finally {
    env.setControl({ callsLog });
  }
});

test('an analysis that is not completed answers 409 NOT_COMPLETED', async () => {
  const job = await env.rt().store.create({ origin: 'zip', language: 'auto', status: 'running' });
  const res = await post(job.id, {});
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.error.code, 'NOT_COMPLETED');
  assert.equal(body.error.status, 'running');
});

test('unknown or malformed analyses answer 404', async () => {
  assert.equal((await post(VALID_ID, {})).status, 404);
  const res = await post('../etc', {});
  assert.equal(res.status, 404);
});

test('with an API token configured a request without it answers 401', async () => {
  const { job } = await env.completedJob();
  env.rt().config.apiToken = 'tok';
  try {
    const res = await post(job.id, {});
    assert.equal(res.status, 401);
  } finally {
    env.rt().config.apiToken = null;
  }
});
