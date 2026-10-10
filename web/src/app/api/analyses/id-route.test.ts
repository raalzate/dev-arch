// GET /api/analyses/{id} — status of an analysis (007, contracts/analyses-api.md). Run: node scripts/run-tests.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { GET } from './[id]/route.ts';
import { ctxId, setupRouteEnv, VALID_ID, type RouteEnv } from '../../../server/testing/route-harness.test.ts';

let env: RouteEnv;
before(async () => {
  env = await setupRouteEnv({ noEngine: true });
});
after(async () => {
  await env.restore();
});

const get = (id: string, headers: Record<string, string> = {}) =>
  GET(new Request(`http://localhost/api/analyses/${id}`, { headers }), ctxId(id));

test('an existing analysis answers 200 with its public view, without absolute server paths', async () => {
  const { job } = await env.completedJob({ warnings: [] });
  const res = await get(job.id);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const body = await res.json();
  assert.equal(body.jobId, job.id);
  assert.equal(body.status, 'completed');
  assert.equal(body.origin, 'zip');
  assert.equal(body.projectRoot, 'demo');
  assert.equal(body.hasSources, true);
  assert.ok(!JSON.stringify(body).includes(env.dataDir), JSON.stringify(body));
});

test('a malformed identifier answers 404 NOT_FOUND', async () => {
  const res = await get('not-a-uuid');
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error.code, 'NOT_FOUND');
});

test('a well-formed but unknown identifier answers 404', async () => {
  const res = await get(VALID_ID);
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error.message, 'The analysis does not exist or has expired.');
});

test('with an API token configured, a request without it answers 401 and one with it 200', async () => {
  const { job } = await env.completedJob();
  env.rt().config.apiToken = 's3cret';
  try {
    const denied = await get(job.id);
    assert.equal(denied.status, 401);
    assert.equal(denied.headers.get('www-authenticate'), 'Bearer realm="dev-arch"');
    assert.equal((await denied.json()).error.code, 'UNAUTHORIZED');
    const wrong = await get(job.id, { authorization: 'Bearer nope' });
    assert.equal(wrong.status, 401);
    const ok = await get(job.id, { authorization: 'Bearer s3cret' });
    assert.equal(ok.status, 200);
  } finally {
    env.rt().config.apiToken = null;
  }
});
