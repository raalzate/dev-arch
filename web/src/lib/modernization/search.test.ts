import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchIndex, countByKind, groupResults, normalize, search } from './search.ts';
import { paginate, hoverDimmingEnabled } from './paging.ts';
import type { AnalysisView } from './sections.ts';

const component = (id: string, extra: Record<string, unknown> = {}) => ({
  id, files: [`${id}.vb`], loc: 10, tables_used: [], sensitive_data: false, domain: null, layer: 'Datos', calls_out: [], calls_in: [],
  ejb_type: null, uses_jndi: false, annotations: [], is_interface: false, secrets_references: [], external_dependencies: [],
  package_dependencies: [], code_issues: [], extends: null, implements: [], messaging_type: null, messaging_role: null,
  web_type: null, web_role: null, cbo: null, lcom: null, complexity_max: null, complexity_avg: null, ...extra,
});

export const view = {
  graph: {
    meta: { schema_version: '1.0.0', source: 'roslyn-fallback' },
    components: [
      component('Acme.Ventas.ClienteAdapter', { tables_used: ['sp:usp_Cliente_Read'], code_issues: [{ type: 'BUG_PATTERN', severity: 'WARNING', message: 'Late-bound call', line: 12, pattern: 'LATE_BINDING' }] }),
      component('Acme.Pagos.PolíticaPagoAdapter', { tables_used: ['sp:usp_Politica_PagoRead'] }),
    ],
    edges: [],
    api_contracts: { endpoints: [] },
  },
  architecture: {
    meta: { schema_version: '1.0.0' },
    project_metadata: {},
    proposals: [{ id: 0, name: 'Componente de Ventas', viability: 'Media', clusters: [0], components: ['Acme.Ventas.ClienteAdapter'], metrics: {}, signals: {}, rationale: ['Deuda técnica: 0.100'], recommended_actions: [], tables: [] }],
    support_libraries: [],
    summary: '',
  },
  warnings: ["VB project 'X.vbproj' analyzed with reduced fidelity"],
} as unknown as AnalysisView;

test('normalize drops case and accents', () => {
  assert.equal(normalize('  Política  PAGO '), 'politica pago');
});

test('every word must match; title matches rank first, then kind, then title', () => {
  const index = buildSearchIndex(view);
  assert.deepEqual(search(index, 'adapter').map((r) => r.title), [
    'Acme.Pagos.PolíticaPagoAdapter', 'Acme.Ventas.ClienteAdapter', 'LATE_BINDING en Acme.Ventas.ClienteAdapter', 'sp:usp_Cliente_Read', 'sp:usp_Politica_PagoRead',
  ]);
  assert.deepEqual(search(index, 'adapter inexistente'), []);
  assert.deepEqual(search(index, '   '), []);
  assert.equal(search(index, 'a', 2).length, 2);
});

test('targets and grouping', () => {
  const index = buildSearchIndex(view);
  const first = search(index, 'usp_Cliente_Read')[0];
  assert.equal(first.kind, 'procedure');
  assert.deepEqual(first.target, { step: 'map', componentId: 'Acme.Ventas.ClienteAdapter' });
  assert.equal(search(index, 'reduced fidelity')[0].target.step, 'summary');
  assert.deepEqual(groupResults(search(index, 'pago politica')).map((g) => `${g.kind} ${g.items.length}`), ['component 1', 'procedure 1']);
  assert.deepEqual(countByKind(index, 'adapter'), { component: 2, issue: 1, procedure: 2 });
});

test('pagination and hover threshold', () => {
  const rows = Array.from({ length: 4984 }, (_, i) => i);
  assert.deepEqual([paginate(rows, 1).shown.length, paginate(rows, 1).remaining], [150, 4834]);
  assert.deepEqual([paginate(rows, 34).shown.length, paginate(rows, 34).remaining], [4984, 0]);
  assert.equal(hoverDimmingEnabled(300), true);
  assert.equal(hoverDimmingEnabled(301), false);
});
