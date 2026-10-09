"use client";

// Extraction proposal (010 FR-026, FR-032): metrics, members, edit mode to move a component to another proposal
// (both are re-scored by the engine) and details with legacy entrypoint, signals, tables, rationale and actions.
import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, Pencil } from 'lucide-react';
import type { Component, Proposal, ScoreProposalResponse } from '@static-inference/schema';
import { layerLabel } from '@/lib/modernization/layers';
import type { TechnologyProfile } from '@/lib/modernization/technology';
import { ViabilityBadge, num } from './badges';

export type ScoreState = { status: 'pending' } | { status: 'done'; result: ScoreProposalResponse } | { status: 'error'; message: string };

const ENTRY_LABELS: Record<string, string> = { rest: 'API REST', messaging: 'Mensajería', service: 'Servicio', internal: 'Interno' };

export default function ProposalCard({
  proposal, components, edited, score, others, byId, profile, onMove,
}: {
  proposal: Proposal;
  components: string[];
  edited: boolean;
  score: ScoreState | undefined;
  others: { id: number; name: string }[];
  byId: Map<string, Component>;
  profile: TechnologyProfile;
  onMove: (componentId: string, toProposal: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const p = proposal;
  const m = p.metrics;
  return (
    <article
      data-testid="proposal-card"
      data-proposal-id={p.id}
      data-viability={p.viability}
      data-edited={edited ? 'true' : 'false'}
      className="rounded-md border border-border bg-card"
    >
      <header className="flex flex-wrap items-center gap-2 px-4 pt-3">
        <h3 className="text-md font-semibold">{p.name}</h3>
        <ViabilityBadge viability={p.viability} />
        {edited && <span className="rounded bg-accent px-1.5 py-0.5 text-xs">Editada</span>}
        <button
          type="button"
          data-testid="proposal-edit"
          aria-pressed={editing}
          onClick={() => setEditing((v) => !v)}
          className="ml-auto inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden /> {editing ? 'Terminar edición' : 'Editar'}
        </button>
      </header>
      <dl className="flex flex-wrap gap-x-6 gap-y-1 px-4 pt-2 text-xs tabular-nums">
        <div><dt className="inline text-muted-foreground">Componentes </dt><dd className="inline font-medium">{components.length}</dd></div>
        <div><dt className="inline text-muted-foreground">Cohesión </dt><dd className="inline font-medium">{m.cohesion_avg.toFixed(2)}</dd></div>
        <div><dt className="inline text-muted-foreground">Acoplamiento externo </dt><dd className="inline font-medium">{num(m.external_coupling)}</dd></div>
        {m.tables.length > 0 && <div><dt className="inline text-muted-foreground">Tablas </dt><dd className="inline font-medium">{m.tables.length}</dd></div>}
        {m.sensitive && <div><dd className="inline font-medium" style={{ color: 'var(--sev-critical)' }}>Datos sensibles</dd></div>}
      </dl>
      {score && (
        <div className="mx-4 mt-3 rounded border border-border bg-background px-3 py-2 text-xs">
          {score.status === 'pending' && <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />Puntuando la propuesta editada con el motor…</span>}
          {score.status === 'error' && <span role="alert" style={{ color: 'var(--sev-critical)' }}>{score.message}</span>}
          {score.status === 'done' && (
            <div data-testid="proposal-score" data-viability={score.result.viability} data-score={score.result.score} className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="font-medium">Puntuación del motor tras la edición</span>
              <ViabilityBadge viability={score.result.viability} />
              <span className="tabular-nums">puntuación {score.result.score.toFixed(2)}</span>
              <span className="tabular-nums text-muted-foreground">cohesión ajustada {score.result.metrics.cohesion_adjusted.toFixed(2)} · acoplamiento {num(score.result.metrics.external_coupling)}</span>
            </div>
          )}
        </div>
      )}
      <ul className="mt-3 max-h-64 divide-y divide-border overflow-auto border-t border-border">
        {components.map((id) => {
          const c = byId.get(id);
          return (
            <li key={id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5">
              <span className="min-w-0 flex-1 truncate font-mono text-xs" title={id}>{id}</span>
              {c && <span className="text-xs text-muted-foreground">{layerLabel(c.layer, profile)}</span>}
              {editing && others.length > 0 && (
                <select
                  data-testid="proposal-move-select"
                  aria-label={`Mover ${id} a otra propuesta`}
                  value=""
                  onChange={(e) => { if (e.target.value) onMove(id, Number(e.target.value)); }}
                  className="h-7 max-w-[12rem] rounded border border-input bg-background px-1.5 text-xs"
                >
                  <option value="">Mover a…</option>
                  {others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              )}
            </li>
          );
        })}
      </ul>
      <div className="border-t border-border px-4 py-2">
        <button
          type="button"
          data-testid="proposal-details-toggle"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          {open ? <ChevronDown className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
          {open ? 'Ocultar detalle' : 'Ver detalle'}
        </button>
        {open && (
          <div data-testid="proposal-details" className="mt-2 grid gap-4 text-sm md:grid-cols-2">
            <div className="space-y-2">
              {p.legacy_entrypoint && (
                <div data-testid="proposal-entrypoint" data-type={p.legacy_entrypoint.type}>
                  <h4 className="text-xs font-medium text-muted-foreground">Punto de entrada legacy</h4>
                  <p>
                    {ENTRY_LABELS[p.legacy_entrypoint.type] ?? p.legacy_entrypoint.type}
                    {p.legacy_entrypoint.primary_entry_class && <span className="font-mono text-xs"> · {p.legacy_entrypoint.primary_entry_class}</span>}
                  </p>
                  {p.legacy_entrypoint.description && <p className="text-xs text-muted-foreground">{p.legacy_entrypoint.description}</p>}
                  {(p.legacy_entrypoint.endpoints?.length ?? 0) > 0 && (
                    <ul className="mt-1 space-y-0.5 font-mono text-xs">
                      {p.legacy_entrypoint.endpoints!.slice(0, 8).map((e) => <li key={e.id}>{e.method} {e.path}</li>)}
                    </ul>
                  )}
                </div>
              )}
              <div data-testid="proposal-signals" data-cluster-count={p.signals.cluster_count}>
                <h4 className="text-xs font-medium text-muted-foreground">Señales</h4>
                <p className="tabular-nums">
                  {p.signals.cluster_count} clústeres · tamaño medio {p.signals.avg_cluster_size.toFixed(1)} · densidad interna {m.internal_edge_density.toFixed(2)}
                </p>
              </div>
              {(p.tables?.length ?? 0) > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground">Tablas</h4>
                  <ul className="font-mono text-xs">{p.tables!.map((t) => <li key={`${t.name}-${t.component}`}>{t.name} <span className="text-muted-foreground">({t.source})</span></li>)}</ul>
                </div>
              )}
            </div>
            <div className="space-y-2">
              {p.rationale.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground">Por qué</h4>
                  <ul className="list-disc space-y-0.5 pl-4">{p.rationale.map((r, i) => <li key={i}>{r}</li>)}</ul>
                </div>
              )}
              {p.recommended_actions.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground">Acciones recomendadas</h4>
                  <ul className="list-disc space-y-0.5 pl-4">{p.recommended_actions.map((r, i) => <li key={i}>{r}</li>)}</ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
