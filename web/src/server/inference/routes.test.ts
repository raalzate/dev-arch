// Shared handling of the 010 inference routes (token, job state, JSON body, error rendering; contracts/web-api.md).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '../api-error.ts';
import type { Job } from '../jobs/job-store.ts';
import type { Runtime } from '../runtime.ts';
import { MAX_BODY_BYTES, withCompletedJob } from './routes.ts';
import { setupRouteEnv, VALID_ID, type RouteEnv } from '../testing/route-harness.test.ts';

let env: RouteEnv;
before(async () => {
  env = await setupRouteEnv({ noEngine: true });
});
after(async () => {
  await env.restore();
});

type Seen = { rt: Runtime; job: Job; body: unknown };
function recorder(response: Response = new Response('handled', { status: 299 })) {
  const seen: Seen[] = [];
  const handle = async (rt: Runtime, job: Job, body: unknown) => {
    seen.push({ rt, job, body });
    return response;
  };
  return { seen, handle };
}
const req = (body?: string, headers: Record<string, string> = {}) =>
  new Request('http://localhost/x', { method: 'POST', body, headers });
const id = (v: string) => Promise.resolve({ id: v });

test('a completed analysis reaches the handler with the runtime, the job and the parsed body', async () => {
  const { job } = await env.completedJob();
  const r = recorder();
  const res = await withCompletedJob(req('{"a":[1,2]}'), id(job.id), r.handle);
  assert.equal(res.status, 299);
  assert.equal(r.seen.length, 1);
  assert.equal(r.seen[0].rt, env.rt());
  assert.equal(r.seen[0].job.id, job.id);
  assert.deepEqual(r.seen[0].body, { a: [1, 2] });
});

test('an empty or blank body reaches the handler as an empty object', async () => {
  const { job } = await env.completedJob();
  const r = recorder();
  await withCompletedJob(req(), id(job.id), r.handle);
  await withCompletedJob(req('  \n '), id(job.id), r.handle);
  assert.deepEqual(r.seen.map((s) => s.body), [{}, {}]);
});

test('invalid JSON answers 400 and a body above the limit 413, without calling the handler', async () => {
  const { job } = await env.completedJob();
  const r = recorder();
  const bad = await withCompletedJob(req('{x'), id(job.id), r.handle);
  assert.equal(bad.status, 400);
  assert.equal((await bad.json()).error.code, 'INVALID_REQUEST');
  const big = await withCompletedJob(req(' '.repeat(MAX_BODY_BYTES + 1)), id(job.id), r.handle);
  assert.equal(big.status, 413);
  assert.equal((await big.json()).error.message, `The JSON body exceeds ${MAX_BODY_BYTES} bytes.`);
  const atLimit = await withCompletedJob(req(' '.repeat(MAX_BODY_BYTES)), id(job.id), r.handle);
  assert.equal(atLimit.status, 299);
  assert.equal(r.seen.length, 1);
});

test('unknown, malformed and unfinished analyses are answered before the handler (404, 409)', async () => {
  const r = recorder();
  assert.equal((await withCompletedJob(req(), id('x'), r.handle)).status, 404);
  assert.equal((await withCompletedJob(req(), id(VALID_ID), r.handle)).status, 404);
  const queued = await env.rt().store.create({ origin: 'zip', language: 'auto' });
  const res = await withCompletedJob(req(), id(queued.id), r.handle);
  assert.equal(res.status, 409);
  assert.deepEqual((await res.json()).error, { code: 'NOT_COMPLETED', message: 'The analysis is not completed.', status: 'queued' });
  assert.equal(r.seen.length, 0);
});

test('an ApiError thrown by the handler is rendered with its status and code; other errors propagate', async () => {
  const { job } = await env.completedJob();
  const res = await withCompletedJob(req(), id(job.id), async () => {
    throw new ApiError(422, 'UNKNOWN_COMPONENTS', 'Unknown components: z', { components: ['z'] });
  });
  assert.equal(res.status, 422);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await res.json(), { error: { code: 'UNKNOWN_COMPONENTS', message: 'Unknown components: z', components: ['z'] } });
  await assert.rejects(
    withCompletedJob(req(), id(job.id), async () => {
      throw new TypeError('boom');
    }),
    /boom/,
  );
});

test('with an API token configured a request without it answers 401', async () => {
  const { job } = await env.completedJob();
  env.rt().config.apiToken = 'tok';
  try {
    const r = recorder();
    const res = await withCompletedJob(req(), id(job.id), r.handle);
    assert.equal(res.status, 401);
    assert.equal(r.seen.length, 0);
    const ok = await withCompletedJob(req(undefined, { authorization: 'Bearer tok' }), id(job.id), r.handle);
    assert.equal(ok.status, 299);
  } finally {
    env.rt().config.apiToken = null;
  }
});
