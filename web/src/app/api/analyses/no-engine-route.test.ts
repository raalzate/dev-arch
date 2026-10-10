// POST /api/analyses when the engine is not built (007 FR-032): ENGINE_NOT_BUILT is reported at submission.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { POST } from './route.ts';
import { setupRouteEnv, type RouteEnv } from '../../../server/testing/route-harness.test.ts';

let env: RouteEnv;
before(async () => {
  env = await setupRouteEnv({ noEngine: true });
});
after(async () => {
  await env.restore();
});

test('without a built engine a submission answers 500 ENGINE_NOT_BUILT and stores nothing', async () => {
  const res = await POST(new Request('http://localhost/api/analyses', {
    method: 'POST', headers: { 'content-type': 'application/zip' }, body: 'PK',
  }));
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.equal(body.error.code, 'ENGINE_NOT_BUILT');
  assert.match(body.error.message, /Engine not built/);
  assert.match(body.error.message, /make build/);
  const jobs = path.join(env.dataDir, 'jobs');
  assert.equal(existsSync(jobs) ? readdirSync(jobs).length : 0, 0);
});
