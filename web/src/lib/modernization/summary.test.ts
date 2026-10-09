import assert from 'node:assert/strict';
import { test } from 'node:test';
import { summarize } from './summary';
import { technologyProfile } from './technology';
import { fixture } from './test-fixtures';

test('summary figures of the VB fixture', () => {
  const v = fixture('vb-synthetic');
  const s = summarize(v, technologyProfile(v.graph));
  assert.equal(s.components, v.graph.components.length);
  assert.equal(s.loc, v.graph.components.reduce((n, c) => n + c.loc, 0));
  assert.equal(s.edges, v.graph.edges.length);
  assert.equal(s.severity.CRITICAL, 4);
  assert.equal(s.componentsWithSecrets, v.graph.components.filter((c) => c.secrets_references.length > 0).length);
  assert.ok(s.tables >= 5);
  assert.ok(s.candidates.length >= 1 && s.candidates.length <= 3);
  assert.ok(s.risky.length >= 1 && s.risky.length <= 8);
  assert.equal(s.risky[0].code_issues.some((i) => i.severity === 'CRITICAL'), true);
});
