// Modernization plan (010 FR-033; data-model.md ModernizationPlan). Stages by viability (Alta → Media → Baja), each
// ordered by external coupling and name; engine scores of edited proposals override the inferred values.
import type { Component } from '@static-inference/schema';
import type { ScoreProposalResponse } from '@static-inference/schema/extensions';
import { compareProposals, severityCounts, VIABILITY_ORDER, type Viability } from './ordering';
import type { AnalysisView } from './sections';
import type { Severity } from './severity';
import type { TechnologyProfile } from './technology';
import type { InferenceParameters } from './inference';

export { VIABILITY_ORDER };

export type ScoreLike = Pick<ScoreProposalResponse, 'viability' | 'score' | 'components' | 'rationale' | 'recommended_actions'> & {
  metrics: Partial<ScoreProposalResponse['metrics']>;
};

export interface PlanItem {
  id: number;
  name: string;
  viability: Viability;
  score: number | null;
  edited: boolean;
  components: string[];
  cohesion: number;
  coupling: number;
  tables: string[];
  sensitive: boolean;
  componentsWithSecrets: string[];
  severeIssues: number;
  actions: string[];
  rationale: string[];
  entrypoint: { type: string; description: string | null } | null;
}

export interface Stage {
  index: number;
  title: string;
  viability: Viability;
  proposals: PlanItem[];
}

export interface ModernizationPlan {
  profile: TechnologyProfile;
  project: string;
  analysisId: string;
  finishedAt: string | null;
  totals: { components: number; loc: number; edges: number; endpoints: number; proposals: number };
  severityCounts: Record<Severity, number>;
  stages: Stage[];
  supportLibraries: { name: string; components: number }[];
  warnings: string[];
  parameters: InferenceParameters | null;
}

export interface PlanOptions {
  project: string;
  analysisId: string;
  finishedAt: string | null;
  parameters?: InferenceParameters | null;
  scores?: Record<number, ScoreLike>;
}

export const STAGE_TITLES: Record<Viability, string> = {
  Alta: 'Extraer primero',
  Media: 'Extraer tras preparar el terreno',
  Baja: 'Rediseñar antes de extraer',
};

export function buildPlan(view: AnalysisView, profile: TechnologyProfile, opts: PlanOptions): ModernizationPlan {
  const byId = new Map(view.graph.components.map((c) => [c.id, c]));
  const scores = opts.scores ?? {};
  const items: PlanItem[] = [...view.architecture.proposals].sort(compareProposals).map((p) => {
    const s = scores[p.id];
    const components = s ? s.components : p.components;
    const members = components.map((id) => byId.get(id)).filter((c): c is Component => c !== undefined);
    return {
      id: p.id,
      name: p.name,
      viability: s ? s.viability : p.viability,
      score: s ? s.score : null,
      edited: !!s,
      components,
      cohesion: s?.metrics.cohesion_adjusted ?? p.metrics.cohesion_avg,
      coupling: s?.metrics.external_coupling ?? p.metrics.external_coupling,
      tables: p.metrics.tables,
      sensitive: p.metrics.sensitive,
      componentsWithSecrets: members.filter((c) => c.secrets_references.length > 0).map((c) => c.id),
      severeIssues: members.reduce((n, c) => n + c.code_issues.filter((i) => i.severity === 'CRITICAL' || i.severity === 'ERROR').length, 0),
      actions: s ? s.recommended_actions : p.recommended_actions,
      rationale: s ? s.rationale : p.rationale,
      entrypoint: p.legacy_entrypoint ? { type: p.legacy_entrypoint.type, description: p.legacy_entrypoint.description ?? null } : null,
    };
  });
  items.sort((a, b) => {
    const v = VIABILITY_ORDER.indexOf(a.viability) - VIABILITY_ORDER.indexOf(b.viability);
    if (v !== 0) return v;
    if (a.coupling !== b.coupling) return a.coupling - b.coupling;
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });
  const stages: Stage[] = [];
  for (const v of VIABILITY_ORDER) {
    const list = items.filter((i) => i.viability === v);
    if (list.length) stages.push({ index: stages.length + 1, title: STAGE_TITLES[v], viability: v, proposals: list });
  }
  const comps = view.graph.components;
  return {
    profile,
    project: opts.project,
    analysisId: opts.analysisId,
    finishedAt: opts.finishedAt,
    totals: {
      components: comps.length,
      loc: comps.reduce((n, c) => n + c.loc, 0),
      edges: view.graph.edges.length,
      endpoints: view.graph.api_contracts.endpoints.length,
      proposals: items.length,
    },
    severityCounts: severityCounts(comps),
    stages,
    supportLibraries: view.architecture.support_libraries.map((l) => ({ name: l.name, components: l.components.length })),
    warnings: [...view.warnings],
    parameters: opts.parameters ?? null,
  };
}
