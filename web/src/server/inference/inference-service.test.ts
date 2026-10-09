// Inference service of 010-modernization-ux (FR-022..FR-027, FR-042): panel parameters, request validation and
// engine error mapping. Run: npm test -w web
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { mapEngineError, PANEL, panelParameters, parseReinferBody, parseScoreBody } from './inference-service.ts';

const root = path.resolve(__dirname, '..', '..', '..', '..');
const defaults = JSON.parse(readFileSync(path.join(root, 'tests', 'acceptance', 'fixtures', 'inference-defaults.json'), 'utf8'));
const schema = JSON.parse(readFileSync(path.join(root, 'schema', '1.0.0', 'inference-config.schema.json'), 'utf8'));

test('panel parameters carry engine defaults and contract ranges in panel order', () => {
  const p = panelParameters(defaults, schema);
  assert.deepEqual(p.map((x) => x.path), PANEL.map((x) => x.path));
  const high = p.find((x) => x.path === 'viability.thresholds.high')!;
  assert.deepEqual([high.default, high.min, high.max], [0.7, 0, 1]);
  for (const x of p) assert.ok(x.label.length > 0 && x.step > 0);
});

test('reinfer body validation', () => {
  assert.deepEqual(parseReinferBody({ config: { viability: { thresholds: { high: 0.9 } } }, minViability: 'Media' }), {
    ok: true, value: { config: { viability: { thresholds: { high: 0.9 } } }, minViability: 'Media' },
  });
  assert.deepEqual(parseReinferBody({}), { ok: true, value: { config: undefined, minViability: undefined } });
  assert.equal(parseReinferBody({ config: { nope: 1 } }).ok, false);
  assert.equal(parseReinferBody({ minViability: 'Excelente' }).ok, false);
  assert.equal(parseReinferBody('x').ok, false);
});

test('score body validation', () => {
  assert.equal(parseScoreBody({ components: ['a'] }).ok, true);
  assert.equal(parseScoreBody({ components: [] }).ok, false);
  assert.equal(parseScoreBody({ components: [1] }).ok, false);
});

test('engine error mapping', () => {
  assert.deepEqual(mapEngineError('Invalid inference configuration: a: unknown parameter'), { status: 422, code: 'INFERENCE_CONFIG_INVALID' });
  assert.deepEqual(mapEngineError('Unknown components: x.A'), { status: 422, code: 'UNKNOWN_COMPONENTS' });
  assert.deepEqual(mapEngineError("Analysis 'x' has no dependency graph"), { status: 404, code: 'NOT_FOUND' });
  assert.deepEqual(mapEngineError('Tool reinfer_architecture not found'), { status: 503, code: 'INFERENCE_UNAVAILABLE' });
  assert.deepEqual(mapEngineError('boom'), { status: 502, code: 'ENGINE_ERROR' });
});
