// GET /api/analyses/{id}/{graph|architecture|contracts} — result documents (007, contracts/analyses-api.md; FR-003,
// FR-034). Kept outside the [id]/[doc] folders: the test runner passes file names to `node --test`, which reads
// square brackets as glob classes.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { GET } from './[id]/[doc]/route.ts';
import { JAVA_FIXTURES, setupRouteEnv, VALID_ID, type RouteEnv } from '../../../server/testing/route-harness.test.ts';

let env: RouteEnv;
before(async () => {
  env = await setupRouteEnv({ noEngine: true });
});
after(async () => {
  await env.restore();
});

const get = (id: string, doc: string, headers: Record<string, string> = {}) =>
  GET(new Request(`http://localhost/api/analyses/${id}/${doc}`, { headers }), { params: Promise.resolve({ id, doc }) });

test('the graph of a completed analysis answers 200 with the project root relativized', async () => {
  const { job, projectRoot } = await env.completedJob();
  const stored = readFileSync(path.join(env.rt().store.paths(job.id).out, 'output.json'), 'utf8');
  assert.ok(stored.includes(`${projectRoot}/src/main/java`), 'the stored document holds absolute paths');
  const res = await get(job.id, 'graph');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const text = await res.text();
  assert.ok(!text.includes(projectRoot), 'no absolute project path in the response');
  const graph = JSON.parse(text);
  assert.equal(graph.components[0].files[0], 'src/main/java/banco_hexagonal/pruebatecnica/PruebaTecnica.java');
});

test('the architecture document is returned byte for byte when it holds no project path', async () => {
  const { job } = await env.completedJob();
  const res = await get(job.id, 'architecture');
  assert.equal(res.status, 200);
  assert.equal(await res.text(), readFileSync(path.join(JAVA_FIXTURES, 'output_architecture.json'), 'utf8'));
});

test('an imported analysis is served without redaction', async () => {
  const store = env.rt().store;
  const job = await store.create({ origin: 'import', language: 'auto', status: 'completed' });
  const out = store.paths(job.id).out;
  const raw = JSON.stringify({ endpoints: [], note: '/abs/path/kept' });
  mkdirSync(out, { recursive: true });
  writeFileSync(path.join(out, 'output_entrypoints.json'), raw);
  const res = await get(job.id, 'contracts');
  assert.equal(res.status, 200);
  assert.equal(await res.text(), raw);
});

test('an unknown document name answers 404', async () => {
  const { job } = await env.completedJob();
  const res = await get(job.id, 'secrets');
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error.code, 'NOT_FOUND');
});

test('an inherited property name is not a document (404)', async () => {
  const { job } = await env.completedJob();
  const res = await get(job.id, 'toString');
  assert.equal(res.status, 404);
});

test('a malformed or unknown analysis answers 404', async () => {
  assert.equal((await get('abc', 'graph')).status, 404);
  const res = await get(VALID_ID, 'graph');
  assert.equal(res.status, 404);
});

test('a missing document file of a completed analysis answers 404', async () => {
  const { job } = await env.completedJob();
  rmSync(path.join(env.rt().store.paths(job.id).out, 'output_entrypoints.json'));
  const res = await get(job.id, 'contracts');
  assert.equal(res.status, 404);
});

test('an analysis still queued or running answers 409 NOT_READY with its status', async () => {
  const store = env.rt().store;
  const queued = await store.create({ origin: 'zip', language: 'auto' });
  const res = await get(queued.id, 'graph');
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.error.code, 'NOT_READY');
  assert.equal(body.error.status, 'queued');
  const running = await store.create({ origin: 'zip', language: 'auto', status: 'running', phase: 'extraction' });
  const r2 = await get(running.id, 'architecture');
  assert.equal(r2.status, 409);
  assert.equal((await r2.json()).error.phase, 'extraction');
});

test('a failed analysis answers 409 ANALYSIS_FAILED with the public error', async () => {
  const store = env.rt().store;
  const job = await store.create({
    origin: 'zip', language: 'auto', status: 'failed', error: { code: 'ENGINE_ERROR', message: 'Parse failure' },
  });
  const res = await get(job.id, 'graph');
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.error.code, 'ANALYSIS_FAILED');
  assert.deepEqual(body.error.error, { code: 'ENGINE_ERROR', message: 'Parse failure' });
});

test('with an API token configured the documents need it (401)', async () => {
  const { job } = await env.completedJob();
  env.rt().config.apiToken = 'tok';
  try {
    const res = await get(job.id, 'graph');
    assert.equal(res.status, 401);
    assert.equal((await get(job.id, 'graph', { authorization: 'Bearer tok' })).status, 200);
  } finally {
    env.rt().config.apiToken = null;
  }
});
