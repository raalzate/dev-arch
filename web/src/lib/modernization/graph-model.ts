// Pure model of the system map (010 FR-017..FR-021; data-model.md GraphView; research D9).
import type { Component, DependencyGraph, Proposal } from '@static-inference/schema';
import { layerLabel } from './layers';
import { severityRank, type Severity } from './severity';
import type { TechnologyProfile } from './technology';

type EdgeLike = Pick<DependencyGraph['edges'][number], 'from' | 'to' | 'type'>;
export type GroupMode = 'layer' | 'proposal';
export const NO_PROPOSAL = 'Sin propuesta';

export function edgeTypes(e: Pick<EdgeLike, 'type'>): string[] {
  return e.type.split(',').map((t) => t.trim()).filter(Boolean);
}

export function edgeKey(e: Pick<EdgeLike, 'from' | 'to'>): string {
  return `${e.from}->${e.to}`;
}

export function legend(edges: readonly EdgeLike[]): { type: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const e of edges) for (const t of new Set(edgeTypes(e))) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([type, count]) => ({ type, count }));
}

/** An edge is visible while at least one of its types is not disabled. */
export function visibleEdges<E extends EdgeLike>(edges: readonly E[], disabled: ReadonlySet<string>): E[] {
  return edges.filter((e) => edgeTypes(e).some((t) => !disabled.has(t)));
}

/** 1–6 px, square-root scale of the weight relative to the heaviest dependency. */
export function strokeWidth(weight: number, maxWeight: number): number {
  if (!(maxWeight > 0) || !(weight > 0)) return 1;
  return 1 + 5 * Math.sqrt(Math.min(weight, maxWeight) / maxWeight);
}

export function groupComponents(
  components: readonly Component[],
  mode: GroupMode,
  proposals: readonly Proposal[],
  profile: TechnologyProfile,
): Map<string, string> {
  const out = new Map<string, string>();
  const owner = new Map<string, string>();
  for (const p of proposals) for (const id of p.components) if (!owner.has(id)) owner.set(id, p.name);
  for (const c of components) out.set(c.id, mode === 'layer' ? layerLabel(c.layer, profile) : owner.get(c.id) ?? NO_PROPOSAL);
  return out;
}

export function meetsSeverity(severity: Severity, min: Severity): boolean {
  return severityRank(severity) >= severityRank(min);
}

export function highlightedComponents(components: readonly Component[], min: Severity | null): Set<string> {
  if (!min) return new Set();
  return new Set(components.filter((c) => c.code_issues.some((i) => meetsSeverity(i.severity, min))).map((c) => c.id));
}
