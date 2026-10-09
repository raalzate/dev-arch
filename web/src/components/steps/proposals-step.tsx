"use client";

// Step 3 — Proposals (010 FR-022..FR-027): live inference panel next to the proposals of the active scenario
// (original or re-inferred), edited proposals re-scored by the engine, and the support libraries.
import React, { useMemo } from 'react';
import type { ScoreProposalResponse } from '@static-inference/schema/extensions';
import { orderProposals } from '@/lib/modernization/ordering';
import { resolveSections, type AnalysisView } from '@/lib/modernization/sections';
import type { TechnologyProfile } from '@/lib/modernization/technology';
import InferencePanel, { type InferenceUiState } from '../inference-panel';
import ProposalCard, { type ScoreState } from '../proposal-card';
import { NoFindings, Section } from '../section';
import type { MinViability } from '@/lib/modernization/inference';

export type { ScoreProposalResponse };

export default function ProposalsStep({
  view, profile, inference, edits, scores, onParam, onMinViability, onReset, onMove,
}: {
  view: AnalysisView;
  profile: TechnologyProfile;
  inference: InferenceUiState;
  edits: Record<number, string[]>;
  scores: Record<number, ScoreState>;
  onParam: (path: string, value: number) => void;
  onMinViability: (v: MinViability | null) => void;
  onReset: () => void;
  onMove: (fromProposal: number, componentId: string, toProposal: number) => void;
}) {
  const proposals = useMemo(() => orderProposals(view.architecture.proposals), [view.architecture.proposals]);
  const byId = useMemo(() => new Map(view.graph.components.map((c) => [c.id, c])), [view.graph.components]);
  const { visible, empty } = resolveSections('proposals', profile, view);
  const libs = visible.find((v) => v.def.id === 'support-libraries');
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="order-2 space-y-4 xl:order-1">
        {proposals.length === 0 && (
          <p className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
            Con estos parámetros no queda ninguna propuesta. Baja la viabilidad mínima o restablece los parámetros.
          </p>
        )}
        {proposals.map((p) => (
          <ProposalCard
            key={p.id}
            proposal={p}
            components={edits[p.id] ?? p.components}
            edited={edits[p.id] !== undefined}
            score={scores[p.id]}
            others={proposals.filter((o) => o.id !== p.id).map((o) => ({ id: o.id, name: o.name }))}
            byId={byId}
            profile={profile}
            onMove={(cid, to) => onMove(p.id, cid, to)}
          />
        ))}
        {libs && (
          <Section id="support-libraries" title={libs.def.title} count={libs.items.length} description="Código compartido por varias propuestas: conviene extraerlo como librería antes que como servicio.">
            <ul className="grid gap-2 md:grid-cols-2">
              {view.architecture.support_libraries.map((l) => (
                <li key={l.id} className="rounded border border-border px-3 py-2">
                  <div className="font-medium">{l.name}</div>
                  <div className="text-xs text-muted-foreground tabular-nums">{l.components.length} componentes · clústeres {l.clusters.join(', ')}</div>
                </li>
              ))}
            </ul>
          </Section>
        )}
        <NoFindings step="proposals" empty={empty} />
      </div>
      <div className="order-1 xl:order-2">
        <div className="xl:sticky xl:top-[72px]">
          <InferencePanel ui={inference} onChange={onParam} onMinViability={onMinViability} onReset={onReset} />
        </div>
      </div>
    </div>
  );
}
