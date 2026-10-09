import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareAnalyses, isComparable, totals } from './compare';
import { fixture } from './test-fixtures';

test('totals, deltas and exclusive components', () => {
  const a = fixture('java-standar');
  const b = fixture('dotnet-ecommerce');
  const c = compareAnalyses(a, b);
  assert.deepEqual(c.a, totals(a));
  assert.equal(c.delta.components, b.graph.components.length - a.graph.components.length);
  assert.equal(c.delta.issues.WARNING, c.b.issues.WARNING - c.a.issues.WARNING);
  assert.deepEqual(c.onlyInA, [...c.onlyInA].sort());
  assert.equal(c.onlyInA.length, a.graph.components.length);
  const same = compareAnalyses(a, a);
  assert.deepEqual(same.onlyInA, []);
  assert.equal(same.delta.loc, 0);
});

test('comparable only when completed', () => {
  assert.equal(isComparable({ status: 'completed' }), true);
  for (const s of ['failed', 'running', 'queued']) assert.equal(isComparable({ status: s }), false);
});
