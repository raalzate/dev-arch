// POST /api/analyses/import — import of engine results without running it (007 FR-020, FR-021).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { POST } from './route.ts';
import { JAVA_FIXTURES, jsonRequest, setupRouteEnv, type RouteEnv } from '../../../../server/testing/route-harness.test.ts';

let env: RouteEnv;
before(async () => {
  env = await setupRouteEnv({ noEngine: true });
});
after(async () => {
  await env.restore();
});

const fixture = (f: string) => JSON.parse(readFileSync(path.join(JAVA_FIXTURES, f), 'utf8'));
const post = (body: unknown, headers: Record<string, string> = {}) => POST(jsonRequest('http://localhost/api/analyses/import', body, headers));
const jobCount = () => (existsSync(path.join(env.dataDir, 'jobs')) ? readdirSync(path.join(env.dataDir, 'jobs')).length : 0);

test('valid documents are stored as a completed imported analysis (201 with Location and summary)', async () => {
  const graph = fixture('output.json');
  const architecture = fixture('output_architecture.json');
  const entrypoints = fixture('output_entrypoints.json');
  const res = await post({ graph, architecture, entrypoints });
  assert.equal(res.status, 201, await res.clone().text());
  const { jobId, status } = await res.json();
  assert.equal(status, 'completed');
  assert.equal(res.headers.get('location'), `/api/analyses/${jobId}`);
  const job = await env.rt().store.get(jobId);
  assert.equal(job?.origin, 'import');
  assert.deepEqual(job?.summary, {
    componentCount: graph.components.length,
    edgeCount: graph.edges.length,
    proposalCount: architecture.proposals.length,
    endpointCount: entrypoints.endpoints.length,
  });
  const out = env.rt().store.paths(jobId).out;
  assert.deepEqual(JSON.parse(readFileSync(path.join(out, 'output.json'), 'utf8')), graph);
  assert.deepEqual(JSON.parse(readFileSync(path.join(out, 'output_entrypoints.json'), 'utf8')), entrypoints);
});

test('the endpoints document is optional', async () => {
  const res = await post({ graph: fixture('output.json'), architecture: fixture('output_architecture.json') });
  assert.equal(res.status, 201);
  const { jobId } = await res.json();
  assert.equal((await env.rt().store.get(jobId))?.summary?.endpointCount, 0);
  assert.equal(existsSync(path.join(env.rt().store.paths(jobId).out, 'output_entrypoints.json')), false);
});

test('a body that is not JSON answers 400 INVALID_REQUEST', async () => {
  const before = jobCount();
  const res = await post('{not json');
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.message, 'The import body is not valid JSON.');
  assert.equal(jobCount(), before);
});

test('a missing required document answers 400 MISSING_DOCUMENT naming it', async () => {
  const res = await post({ graph: fixture('output.json') });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, 'MISSING_DOCUMENT');
  assert.equal(body.error.document, 'architecture');
});

test('a document that violates the contract is rejected with 422 and nothing is stored', async () => {
  const before = jobCount();
  const graph = fixture('output.json');
  graph.components = 'nope';
  const res = await post({ graph, architecture: fixture('output_architecture.json') });
  assert.equal(res.status, 422, await res.clone().text());
  assert.equal(jobCount(), before);
});

test('a body above the upload limit answers 413 UPLOAD_TOO_LARGE', async () => {
  const rt = env.rt();
  const saved = rt.config.maxUploadBytes;
  rt.config.maxUploadBytes = 16;
  try {
    const res = await post({ graph: {}, architecture: {} });
    assert.equal(res.status, 413);
    assert.equal((await res.json()).error.code, 'UPLOAD_TOO_LARGE');
  } finally {
    rt.config.maxUploadBytes = saved;
  }
});

test('with an API token configured the import needs it (401)', async () => {
  env.rt().config.apiToken = 'tok';
  try {
    const res = await post({});
    assert.equal(res.status, 401);
    const authorized = await post({}, { authorization: 'Bearer tok' });
    assert.equal(authorized.status, 400);
  } finally {
    env.rt().config.apiToken = null;
  }
});
