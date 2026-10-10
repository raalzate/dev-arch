// GET /api/inference/defaults when the engine is not built: the request fails with 503 and the build hint.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { GET } from './route.ts';
import { setupRouteEnv, type RouteEnv } from '../../../../server/testing/route-harness.test.ts';

let env: RouteEnv;
before(async () => {
  env = await setupRouteEnv({ noEngine: true });
});
after(async () => {
  await env.restore();
});

test('without a built engine the defaults answer 503 with the "Engine not built" message', async () => {
  const res = await GET(new Request('http://localhost/api/inference/defaults'));
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.match(body.error.message, /Engine not built/);
  assert.equal(res.headers.get('cache-control'), 'no-store');
});
