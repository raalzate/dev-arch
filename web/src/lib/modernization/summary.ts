// Executive summary figures (010 FR-009).
import type { Component, Proposal } from '@static-inference/schema';
import { orderByRisk, orderProposals, severityCounts } from './ordering';
import type { AnalysisView } from './sections';
import type { Severity } from './severity';
import type { TechnologyProfile } from './technology';

export interface Summary {
  profile: TechnologyProfile;
  components: number;
  loc: number;
  edges: number;
  externalDependencies: number;
  endpoints: number;
  severity: Record<Severity, number>;
  componentsWithSecrets: number;
  sensitiveProposals: number;
  tables: number;
  proposals: number;
  candidates: Proposal[];
  risky: Component[];
}

export function summarize(view: AnalysisView, profile: TechnologyProfile): Summary {
  const comps = view.graph.components;
  const tables = new Set<string>();
  for (const c of comps) for (const t of c.tables_used) tables.add(t);
  return {
    profile,
    components: comps.length,
    loc: comps.reduce((n, c) => n + c.loc, 0),
    edges: view.graph.edges.length,
    externalDependencies: Object.keys(view.architecture.project_metadata.external_dependencies ?? {}).length,
    endpoints: view.graph.api_contracts.endpoints.length,
    severity: severityCounts(comps),
    componentsWithSecrets: comps.filter((c) => c.secrets_references.length > 0).length,
    sensitiveProposals: view.architecture.proposals.filter((p) => p.metrics.sensitive).length,
    tables: tables.size,
    proposals: view.architecture.proposals.length,
    candidates: orderProposals(view.architecture.proposals).slice(0, 3),
    risky: orderByRisk(comps).slice(0, 8),
  };
}
