import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NO_PROPOSAL, edgeKey, edgeTypes, groupComponents, highlightedComponents, legend, strokeWidth, visibleEdges } from './graph-model';
import { technologyProfile } from './technology';
import { layerLabel } from './layers';
import { fixture } from './test-fixtures';

const E = [
  { from: 'A', to: 'B', type: 'call,use', weight: 1 },
  { from: 'B', to: 'C', type: 'use', weight: 2 },
  { from: 'C', to: 'A', type: ' call , injection ', weight: 4 },
];

test('edge types split and trim', () => {
  assert.deepEqual(edgeTypes(E[2]), ['call', 'injection']);
  assert.equal(edgeKey(E[0]), 'A->B');
});

test('legend counts compound types, sorted by name', () => {
  assert.deepEqual(legend(E), [{ type: 'call', count: 2 }, { type: 'injection', count: 1 }, { type: 'use', count: 2 }]);
});

test('visible edges', () => {
  assert.deepEqual(visibleEdges(E, new Set(['use'])).map(edgeKey), ['A->B', 'C->A']);
  assert.deepEqual(visibleEdges(E, new Set(['use', 'call'])).map(edgeKey), ['C->A']);
  assert.deepEqual(visibleEdges(E, new Set()).length, 3);
});

test('stroke width grows with weight within 1..6', () => {
  assert.equal(strokeWidth(4, 4), 6);
  assert.ok(strokeWidth(1, 4) < strokeWidth(2, 4));
  assert.equal(strokeWidth(0, 0), 1);
});

test('grouping by proposal and by layer', () => {
  const v = fixture('dotnet-ecommerce');
  const p = technologyProfile(v.graph);
  const byProp = groupComponents(v.graph.components, 'proposal', v.architecture.proposals, p);
  for (const c of v.graph.components) {
    const prop = v.architecture.proposals.find((x) => x.components.includes(c.id));
    assert.equal(byProp.get(c.id), prop ? prop.name : NO_PROPOSAL);
  }
  const byLayer = groupComponents(v.graph.components, 'layer', v.architecture.proposals, p);
  for (const c of v.graph.components) assert.equal(byLayer.get(c.id), layerLabel(c.layer, p));
});

test('highlight by minimum severity', () => {
  const v = fixture('dotnet-ecommerce');
  const h = highlightedComponents(v.graph.components, 'ERROR');
  const exp = v.graph.components.filter((c) => c.code_issues.some((i) => i.severity === 'ERROR' || i.severity === 'CRITICAL')).map((c) => c.id);
  assert.deepEqual([...h].sort(), exp.sort());
  assert.equal(highlightedComponents(v.graph.components, null).size, 0);
});
