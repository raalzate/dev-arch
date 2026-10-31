// 027-large-project-ux (FR-001/FR-002): lexical index over every datum of an analysis and a deterministic search.
// Pure functions: the index is built once per analysis in the client; the search matches every word of the query
// (case- and accent-insensitive) against a haystack, ranks title matches first, then by kind, then by title.
import type { AnalysisView } from './sections';
import type { StepId } from './sections';

export type SearchKind = 'component' | 'proposal' | 'support' | 'issue' | 'table' | 'procedure' | 'endpoint' | 'warning';

export interface SearchTarget {
  step: StepId;
  componentId: string | null;
}

export interface SearchEntry {
  kind: SearchKind;
  title: string;
  subtitle: string;
  /** Normalized text searched (title + related data). */
  haystack: string;
  /** Normalized title (ranking). */
  titleNorm: string;
  target: SearchTarget;
}

export interface SearchResult extends SearchEntry {
  titleMatch: boolean;
}

export const KIND_LABELS: Record<SearchKind, string> = {
  component: 'Componentes',
  proposal: 'Propuestas',
  support: 'Librerías de soporte',
  issue: 'Problemas de código',
  table: 'Tablas',
  procedure: 'Procedimientos',
  endpoint: 'Puntos de entrada',
  warning: 'Advertencias',
};

const KIND_ORDER: SearchKind[] = ['component', 'proposal', 'support', 'issue', 'procedure', 'table', 'endpoint', 'warning'];

export const DEFAULT_LIMIT = 50;

/** Lower case without diacritics; whitespace collapsed. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function entry(kind: SearchKind, title: string, subtitle: string, parts: string[], target: SearchTarget): SearchEntry {
  const titleNorm = normalize(title);
  return { kind, title, subtitle, haystack: normalize([title, ...parts].join(' ')), titleNorm, target };
}

export function buildSearchIndex(view: AnalysisView): SearchEntry[] {
  const out: SearchEntry[] = [];
  const { graph, architecture } = view;
  const resources = new Map<string, string[]>();
  for (const c of [...graph.components].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    out.push(entry('component', c.id, [c.layer, c.domain].filter(Boolean).join(' · '),
      [c.layer ?? '', c.domain ?? '', ...c.annotations, ...c.tables_used, ...c.external_dependencies, ...c.files, ...c.code_issues.map((i) => i.pattern)],
      { step: 'map', componentId: c.id }));
    for (const i of c.code_issues) {
      out.push(entry('issue', `${i.pattern} en ${c.id}`, `${i.severity} · línea ${i.line}`, [i.message, i.severity, c.id], { step: 'findings', componentId: c.id }));
    }
    for (const t of c.tables_used) {
      const users = resources.get(t) ?? [];
      users.push(c.id);
      resources.set(t, users);
    }
  }
  for (const p of architecture.proposals) {
    // Proposals and support libraries are found by their own text (name, viability, rationale), not by member ids:
    // a search for a class name must lead to the component, not to every group that contains it.
    out.push(entry('proposal', p.name, `${p.viability} · ${p.components.length} componentes`, [p.viability, ...(p.rationale ?? [])],
      { step: 'proposals', componentId: null }));
  }
  for (const s of architecture.support_libraries ?? []) {
    out.push(entry('support', s.name, `${s.components.length} componentes`, [], { step: 'proposals', componentId: null }));
  }
  for (const [resource, users] of [...resources.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const sorted = [...users].sort();
    out.push(entry(resource.startsWith('sp:') ? 'procedure' : 'table', resource, `${sorted.length} componentes`, sorted, { step: 'map', componentId: sorted[0] ?? null }));
  }
  for (const e of graph.api_contracts?.endpoints ?? []) {
    out.push(entry('endpoint', `${e.method} ${e.path}`, e.component_id, [e.component_id], { step: 'findings', componentId: e.component_id }));
  }
  for (const w of view.warnings) {
    out.push(entry('warning', w, 'Advertencia del análisis', [], { step: 'summary', componentId: null }));
  }
  return out;
}

export function search(index: readonly SearchEntry[], query: string, limit = DEFAULT_LIMIT): SearchResult[] {
  const words = normalize(query).split(' ').filter(Boolean);
  if (words.length === 0) return [];
  const hits: SearchResult[] = [];
  for (const e of index) {
    if (!words.every((w) => e.haystack.includes(w))) continue;
    hits.push({ ...e, titleMatch: words.every((w) => e.titleNorm.includes(w)) });
  }
  hits.sort((a, b) => {
    if (a.titleMatch !== b.titleMatch) return a.titleMatch ? -1 : 1;
    const k = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
    if (k !== 0) return k;
    return a.titleNorm < b.titleNorm ? -1 : a.titleNorm > b.titleNorm ? 1 : 0;
  });
  return hits.slice(0, Math.max(0, limit));
}

/** Results grouped by kind in display order, with the total per kind over the whole match set. */
export function groupResults(results: readonly SearchResult[]): { kind: SearchKind; label: string; items: SearchResult[] }[] {
  return KIND_ORDER
    .map((kind) => ({ kind, label: KIND_LABELS[kind], items: results.filter((r) => r.kind === kind) }))
    .filter((g) => g.items.length > 0);
}

/** Totals per kind of every match (not limited), for the group headers. */
export function countByKind(index: readonly SearchEntry[], query: string): Partial<Record<SearchKind, number>> {
  const all = search(index, query, Number.MAX_SAFE_INTEGER);
  const counts: Partial<Record<SearchKind, number>> = {};
  for (const r of all) counts[r.kind] = (counts[r.kind] ?? 0) + 1;
  return counts;
}
