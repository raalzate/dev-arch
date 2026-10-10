// GET /api/source?jobId=&path= — source viewer restricted to the project of one analysis (007 FR-017, FR-018).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { GET } from './route.ts';
import { setupRouteEnv, VALID_ID, type RouteEnv } from '../../../server/testing/route-harness.test.ts';

let env: RouteEnv;
let jobId: string;
let projectRoot: string;
before(async () => {
  env = await setupRouteEnv({ noEngine: true });
  ({ job: { id: jobId }, projectRoot } = await env.completedJob());
  mkdirSync(path.join(projectRoot, 'src/a'), { recursive: true });
  writeFileSync(path.join(projectRoot, 'src/a/A.java'), 'package a;\nclass A {}\n');
  writeFileSync(path.join(projectRoot, 'secret.bin'), 'x');
  writeFileSync(path.join(env.dir, 'outside.java'), 'class Outside {}');
  symlinkSync(path.join(env.dir, 'outside.java'), path.join(projectRoot, 'link.java'));
});
after(async () => {
  await env.restore();
});

const get = (query: string, headers: Record<string, string> = {}) => GET(new Request(`http://localhost/api/source?${query}`, { headers }));
const q = (id: string, p: string) => `jobId=${encodeURIComponent(id)}&path=${encodeURIComponent(p)}`;

test('a file of the project answers 200 with its relative path and content', async () => {
  const res = await get(q(jobId, 'src/a/A.java'));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await res.json(), { path: 'src/a/A.java', content: 'package a;\nclass A {}\n' });
});

test('without jobId (legacy absolute form) answers 400 INVALID_PATH', async () => {
  const res = await get(`path=${encodeURIComponent('/etc/passwd')}`);
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, 'INVALID_PATH');
});

test('path traversal and absolute paths answer 400 INVALID_PATH', async () => {
  for (const p of ['../outside.java', '/etc/hosts', 'src/../../outside.java', '%2e%2e/outside.java']) {
    const res = await get(q(jobId, p));
    assert.equal(res.status, 400, p);
    assert.equal((await res.json()).error.code, 'INVALID_PATH');
  }
});

test('a symbolic link leaving the project and a missing file answer 404', async () => {
  const link = await get(q(jobId, 'link.java'));
  assert.equal(link.status, 404);
  const missing = await get(q(jobId, 'src/a/Missing.java'));
  assert.equal(missing.status, 404);
});

test('an extension outside the allowlist answers 400 EXTENSION_NOT_ALLOWED', async () => {
  const res = await get(q(jobId, 'secret.bin'));
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, 'EXTENSION_NOT_ALLOWED');
  assert.equal(body.error.extension, '.bin');
});

test('malformed and unknown analyses answer 404', async () => {
  assert.equal((await get(q('nope', 'src/a/A.java'))).status, 404);
  const res = await get(q(VALID_ID, 'src/a/A.java'));
  assert.equal(res.status, 404);
});

test('imported analyses and analyses without a project root answer 409 NO_SOURCES', async () => {
  const store = env.rt().store;
  const imported = await store.create({ origin: 'import', language: 'auto', status: 'completed', projectRoot: projectRoot });
  const res = await get(q(imported.id, 'src/a/A.java'));
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error.code, 'NO_SOURCES');
  const queued = await store.create({ origin: 'zip', language: 'auto' });
  assert.equal((await get(q(queued.id, 'src/a/A.java'))).status, 409);
});

test('with an API token configured the viewer needs it (401)', async () => {
  env.rt().config.apiToken = 'tok';
  try {
    const res = await get(q(jobId, 'src/a/A.java'));
    assert.equal(res.status, 401);
    assert.equal((await get(q(jobId, 'src/a/A.java'), { authorization: 'Bearer tok' })).status, 200);
  } finally {
    env.rt().config.apiToken = null;
  }
});
