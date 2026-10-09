import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SEVERITIES, SEVERITY_STYLES, SURFACES, TECH_ACCENTS, contrastRatio, severityRank } from './severity';

test('contrast ratio', () => {
  assert.equal(Math.round(contrastRatio('#000000', '#ffffff')), 21);
  assert.equal(contrastRatio('#777777', '#777777'), 1);
});

test('every color reaches AA on its surface', () => {
  for (const c of [...Object.values(SEVERITY_STYLES), ...Object.values(TECH_ACCENTS)]) {
    assert.ok(contrastRatio(c.light, SURFACES.light) >= 4.5, c.light);
    assert.ok(contrastRatio(c.dark, SURFACES.dark) >= 4.5, c.dark);
  }
});

test('severity order', () => {
  assert.deepEqual([...SEVERITIES], ['CRITICAL', 'ERROR', 'WARNING', 'INFO']);
  assert.ok(severityRank('CRITICAL') > severityRank('ERROR'));
  assert.ok(severityRank('WARNING') > severityRank('INFO'));
});
