// 026-web-extraction-options: translation of the form options to the engine configuration and its description.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_EXTRACTION, describeExtractionConfig, toExtractionConfig } from './extraction-options.ts';

test('defaults produce no configuration', () => {
  assert.equal(toExtractionConfig(DEFAULT_EXTRACTION), null);
  assert.equal(toExtractionConfig({ ...DEFAULT_EXTRACTION, referenceAssemblies: '   ' }), null);
});

test('only the non-default values travel, depth clamped to 0..5', () => {
  assert.deepEqual(toExtractionConfig({ ...DEFAULT_EXTRACTION, extended: true }), { analysis: { extended: 'on' } });
  assert.deepEqual(toExtractionConfig({ ...DEFAULT_EXTRACTION, maxDepth: 9 }), { detection: { maxDepth: 5 } });
  assert.deepEqual(
    toExtractionConfig({ extended: true, maxDepth: 2, referenceAssemblies: ' /refs/v4.8 ' }),
    { detection: { maxDepth: 2 }, analysis: { extended: 'on', referenceAssemblies: '/refs/v4.8' } },
  );
});

test('a stored configuration is described in Spanish, unknown sections named', () => {
  assert.deepEqual(describeExtractionConfig(null), []);
  assert.deepEqual(
    describeExtractionConfig({ detection: { maxDepth: 3 }, analysis: { extended: 'on', referenceAssemblies: '/r' }, viability: {} }),
    ['búsqueda de proyectos hasta 3 niveles', 'análisis extendido', 'ensamblados de referencia .NET Framework', 'sección viability'],
  );
});
