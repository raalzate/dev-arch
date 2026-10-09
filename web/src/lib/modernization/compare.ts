// Comparison of two analyses (010 FR-038; data-model.md Comparison).
import type { AnalysisView } from './sections';
import { SEVERITIES, type Severity } from './severity';
import { VIABILITY_ORDER, severityCounts, type Viability } from './ordering';

export interface Totals {
  components: number;
  loc: number;
  edges: number;
  proposals: Record<Viability, number>;
  issues: Record<Severity, number>;
}

export interface Comparison {
  a: Totals;
  b: Totals;
  delta: Totals;
  onlyInA: string[];
  onlyInB: string[];
}

type Pair = Pick<AnalysisView, 'graph' | 'architecture'>;

export function totals(v: Pair): Totals {
  const proposals = { Alta: 0, Media: 0, Baja: 0 };
  for (const p of v.architecture.proposals) proposals[p.viability]++;
  return {
    components: v.graph.components.length,
    loc: v.graph.components.reduce((n, c) => n + c.loc, 0),
    edges: v.graph.edges.length,
    proposals,
    issues: severityCounts(v.graph.components),
  };
}

export function compareAnalyses(a: Pair, b: Pair): Comparison {
  const ta = totals(a);
  const tb = totals(b);
  const delta: Totals = {
    components: tb.components - ta.components,
    loc: tb.loc - ta.loc,
    edges: tb.edges - ta.edges,
    proposals: Object.fromEntries(VIABILITY_ORDER.map((v) => [v, tb.proposals[v] - ta.proposals[v]])) as Record<Viability, number>,
    issues: Object.fromEntries(SEVERITIES.map((s) => [s, tb.issues[s] - ta.issues[s]])) as Record<Severity, number>,
  };
  const ia = new Set(a.graph.components.map((c) => c.id));
  const ib = new Set(b.graph.components.map((c) => c.id));
  const sort = (x: string[]) => x.sort((p, q) => (p < q ? -1 : p > q ? 1 : 0));
  return { a: ta, b: tb, delta, onlyInA: sort([...ia].filter((x) => !ib.has(x))), onlyInB: sort([...ib].filter((x) => !ia.has(x))) };
}

export function isComparable(entry: { status: string }): boolean {
  return entry.status === 'completed';
}
