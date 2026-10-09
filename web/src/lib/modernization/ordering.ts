// Shared orderings (010 FR-009, FR-033): proposals by viability, external coupling and name; components by risk.
import type { Component, Proposal } from '@static-inference/schema';
import { SEVERITIES, severityRank } from './severity';

export const VIABILITY_ORDER = ['Alta', 'Media', 'Baja'] as const;
export type Viability = (typeof VIABILITY_ORDER)[number];

export function compareProposals(a: Proposal, b: Proposal): number {
  const v = VIABILITY_ORDER.indexOf(a.viability) - VIABILITY_ORDER.indexOf(b.viability);
  if (v !== 0) return v;
  const c = a.metrics.external_coupling - b.metrics.external_coupling;
  if (c !== 0) return c;
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}

export function orderProposals(proposals: readonly Proposal[]): Proposal[] {
  return [...proposals].sort(compareProposals);
}

/** Risk score: weighted issue severities, secrets and sensitive data; ties broken by coupling (cbo), size, id. */
export function riskScore(c: Component): number {
  let s = 0;
  for (const i of c.code_issues) s += 10 ** (severityRank(i.severity) - 1);
  s += c.secrets_references.length * 100;
  if (c.sensitive_data) s += 10;
  return s;
}

export function orderByRisk(components: readonly Component[]): Component[] {
  return [...components].sort((a, b) => {
    const d = riskScore(b) - riskScore(a);
    if (d !== 0) return d;
    const cbo = (b.cbo ?? 0) - (a.cbo ?? 0);
    if (cbo !== 0) return cbo;
    const loc = b.loc - a.loc;
    if (loc !== 0) return loc;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export function severityCounts(components: readonly Component[]): Record<(typeof SEVERITIES)[number], number> {
  const out = { CRITICAL: 0, ERROR: 0, WARNING: 0, INFO: 0 };
  for (const c of components) for (const i of c.code_issues) out[i.severity]++;
  return out;
}
