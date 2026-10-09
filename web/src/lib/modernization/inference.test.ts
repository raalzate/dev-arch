import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clampToRange, isDefault, toInferenceConfig, type PanelParameter } from './inference';

const P: PanelParameter[] = [
  { path: 'viability.thresholds.high', label: 'a', min: 0, max: 1, step: 0.01, default: 0.7 },
  { path: 'viability.thresholds.medium', label: 'b', min: 0, max: 1, step: 0.01, default: 0.5 },
  { path: 'evidence.evidenceThreshold', label: 'c', min: 0, max: 1, step: 0.01, default: 0.65 },
];

test('only changed values, nested, clamped', () => {
  assert.deepEqual(toInferenceConfig({ 'viability.thresholds.high': 1.7, 'viability.thresholds.medium': 0.5, 'evidence.evidenceThreshold': 0.65 }, P), { viability: { thresholds: { high: 1 } } });
  assert.deepEqual(toInferenceConfig({ 'viability.thresholds.medium': -3, 'evidence.evidenceThreshold': 0.4 }, P), { viability: { thresholds: { medium: 0 } }, evidence: { evidenceThreshold: 0.4 } });
  assert.deepEqual(toInferenceConfig({}, P), {});
});

test('clamp and default detection', () => {
  assert.equal(clampToRange(Number.NaN, P[0]), 0.7);
  assert.equal(clampToRange(0.123456, P[0]), 0.12);
  assert.equal(isDefault({ 'viability.thresholds.high': 0.7 }, P), true);
  assert.equal(isDefault({ 'viability.thresholds.high': 0.8 }, P), false);
});
