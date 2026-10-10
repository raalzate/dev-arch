// GET /api/inference/defaults — panel parameters read from the stub engine (010 FR-022; contracts/web-api.md).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { GET } from './route.ts';
import { DEV_ARCH, setupRouteEnv, type RouteEnv } from '../../../../server/testing/route-harness.test.ts';

let env: RouteEnv;
before(async () => {
  env = await setupRouteEnv();
});
after(async () => {
  await env.restore();
});

const get = (headers: Record<string, string> = {}) => GET(new Request('http://localhost/api/inference/defaults', { headers }));

test('answers 200 with the engine defaults and the panel parameters with their contract ranges', async () => {
  const res = await get();
  assert.equal(res.status, 200, await res.clone().text());
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const body = await res.json();
  const expected = JSON.parse(readFileSync(path.join(DEV_ARCH, 'tests/acceptance/fixtures/inference-defaults.json'), 'utf8'));
  assert.deepEqual(body.defaults, expected);
  const high = body.parameters.find((p: { path: string }) => p.path === 'viability.thresholds.high');
  assert.equal(high.default, expected.viability.thresholds.high);
  assert.equal(high.label, 'Umbral de viabilidad alta');
  assert.equal(body.parameters.length, 7);
  for (const p of body.parameters) assert.ok(p.min <= p.default && p.default <= p.max, JSON.stringify(p));
});

test('a defaults resource that is not JSON answers 503 ENGINE_UNAVAILABLE', async () => {
  const engine = env.rt().engine;
  const original = engine.readResource;
  engine.readResource = async () => 'not json';
  try {
    const res = await get();
    assert.equal(res.status, 503);
    assert.equal((await res.json()).error.code, 'ENGINE_UNAVAILABLE');
  } finally {
    engine.readResource = original;
  }
});

test('with an API token configured the request needs it (401)', async () => {
  env.rt().config.apiToken = 'tok';
  try {
    const res = await get();
    assert.equal(res.status, 401);
  } finally {
    env.rt().config.apiToken = null;
  }
});
