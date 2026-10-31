// 026-web-extraction-options: shape check of the submitted extraction configuration (FR-001).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_CONFIG_CHARS, parseExtractionConfig } from './extraction-config.ts';

test('absent or empty means no configuration', () => {
  assert.equal(parseExtractionConfig(null), null);
  assert.equal(parseExtractionConfig(undefined), null);
  assert.equal(parseExtractionConfig('  '), null);
});

test('a JSON object text or an object value is accepted as is', () => {
  assert.deepEqual(parseExtractionConfig('{"analysis":{"extended":"on"}}'), { analysis: { extended: 'on' } });
  assert.deepEqual(parseExtractionConfig({ detection: { maxDepth: 2 } }), { detection: { maxDepth: 2 } });
});

test('non-objects, invalid JSON and oversized texts are rejected with a reason', () => {
  assert.throws(() => parseExtractionConfig('not-json'), /not valid JSON/);
  assert.throws(() => parseExtractionConfig('["a"]'), /must be a JSON object/);
  assert.throws(() => parseExtractionConfig('42'), /must be a JSON object/);
  assert.throws(() => parseExtractionConfig(['a']), /must be a JSON object/);
  assert.throws(() => parseExtractionConfig(`{"note":"${'x'.repeat(MAX_CONFIG_CHARS)}"}`), /exceeds 8192/);
});
