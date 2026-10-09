import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPlan } from './plan';
import { exportPlanJson, planToMarkdown } from './markdown';
import { VIABILITY_ORDER } from './ordering';
import { technologyProfile } from './technology';
import { fixture } from './test-fixtures';

const opts = { project: 'demo', analysisId: 'id-1', finishedAt: '2026-10-09T00:00:00.000Z', parameters: null };

test('plan stages by viability, ordered by coupling then name', () => {
  const v = fixture('dotnet-ecommerce');
  const plan = buildPlan(v, technologyProfile(v.graph), opts);
  const items = plan.stages.flatMap((s) => s.proposals);
  assert.equal(items.length, v.architecture.proposals.length);
  for (const s of plan.stages) assert.ok(s.proposals.every((p) => p.viability === s.viability) && s.proposals.length > 0);
  for (let i = 1; i < items.length; i++) {
    const [a, b] = [items[i - 1], items[i]];
    const d = VIABILITY_ORDER.indexOf(a.viability) - VIABILITY_ORDER.indexOf(b.viability);
    assert.ok(d < 0 || (d === 0 && (a.coupling < b.coupling || (a.coupling === b.coupling && a.name <= b.name))));
  }
});

test('edited proposals and scores override the architecture', () => {
  const v = fixture('dotnet-ecommerce');
  const p0 = v.architecture.proposals[0];
  const plan = buildPlan(v, technologyProfile(v.graph), {
    ...opts,
    scores: { [p0.id]: { viability: 'Alta', score: 0.91, components: p0.components, rationale: ['ok'], recommended_actions: ['go'], metrics: { external_coupling: 0.01 } } },
  });
  const item = plan.stages.flatMap((s) => s.proposals).find((x) => x.id === p0.id)!;
  assert.equal(item.viability, 'Alta');
  assert.equal(item.score, 0.91);
  assert.deepEqual(item.actions, ['go']);
  assert.equal(plan.stages[0].viability, 'Alta');
});

test('markdown is deterministic and complete', () => {
  const v = fixture('vb-synthetic');
  v.warnings = ['fidelidad reducida'];
  const p = technologyProfile(v.graph);
  const a = planToMarkdown(buildPlan(v, p, opts));
  const b = planToMarkdown(buildPlan(v, p, opts));
  assert.equal(a, b);
  assert.ok(a.endsWith('\n'));
  assert.match(a, /VB\.NET/);
  assert.match(a, /^## Resumen ejecutivo$/m);
  assert.match(a, /Crítica: 4/);
  assert.match(a, /fidelidad reducida/);
  for (const prop of v.architecture.proposals) assert.ok(a.includes(prop.name));
});

test('json export', () => {
  const v = fixture('java-standar');
  const j = JSON.parse(exportPlanJson(v.architecture, { config: { a: 1 }, minViability: 'Media' }));
  assert.deepEqual(j.architecture, v.architecture);
  assert.deepEqual(j.inference, { config: { a: 1 }, minViability: 'Media' });
});
