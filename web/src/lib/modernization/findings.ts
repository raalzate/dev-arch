// Code issues grouping and filtering (010 FR-029).
import type { DependencyGraph } from '@static-inference/schema';
import { meetsSeverity } from './graph-model';
import { SEVERITIES, type Severity } from './severity';
import type { IssueRow } from './sections';

export type IssueGroupMode = 'severity' | 'pattern';

export function allIssues(graph: Pick<DependencyGraph, 'components'>): IssueRow[] {
  return graph.components.flatMap((c) => c.code_issues.map((i) => ({ ...i, componentId: c.id })));
}

export interface IssueGroup {
  key: string;
  count: number;
  issues: IssueRow[];
}

export function groupIssues(issues: readonly IssueRow[], mode: IssueGroupMode, min: Severity | null): IssueGroup[] {
  const filtered = min ? issues.filter((i) => meetsSeverity(i.severity, min)) : [...issues];
  const map = new Map<string, IssueRow[]>();
  for (const i of filtered) {
    const k = mode === 'severity' ? i.severity : i.pattern;
    const list = map.get(k) ?? [];
    list.push(i);
    map.set(k, list);
  }
  const groups = [...map.entries()].map(([key, list]) => ({
    key,
    count: list.length,
    issues: list.sort((a, b) => (a.componentId < b.componentId ? -1 : a.componentId > b.componentId ? 1 : a.line - b.line)),
  }));
  if (mode === 'severity') return groups.sort((a, b) => SEVERITIES.indexOf(a.key as Severity) - SEVERITIES.indexOf(b.key as Severity));
  return groups.sort((a, b) => b.count - a.count || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}
