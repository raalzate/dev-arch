"use client";

// Step 1 — Summary (010 FR-009, FR-007): technology, size, legacy health, top-3 candidates, top-8 risky components
// and analysis warnings. Keeps the 007 hooks proposal-card, component-node and component-open-source.
import React from 'react';
import { AlertTriangle, FileCode } from 'lucide-react';
import type { Component } from '@static-inference/schema';
import { layerLabel } from '@/lib/modernization/layers';
import { resolveSections, type AnalysisView } from '@/lib/modernization/sections';
import { SEVERITIES } from '@/lib/modernization/severity';
import { summarize } from '@/lib/modernization/summary';
import type { TechnologyProfile } from '@/lib/modernization/technology';
import { SeverityBadge, TechBadge, ViabilityBadge, num, severityColor } from '../badges';
import { NoFindings, Section } from '../section';
import { describeExtractionConfig } from '@/lib/extraction-options';

const fmt = (n: number) => n.toLocaleString('es');

function Metric({ id, label, value }: { id: string; label: string; value: number }) {
  return (
    <div data-testid="summary-metric" data-metric={id} data-value={value} className="min-w-[7rem]">
      <div className="text-xl font-semibold tabular-nums">{fmt(value)}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export function RiskyComponentRow({
  c, profile, canOpenSource, onOpenSource, onDetails,
}: {
  c: Component;
  profile: TechnologyProfile;
  canOpenSource: boolean;
  onOpenSource: (file: string, id: string) => void;
  onDetails: (id: string) => void;
}) {
  const counts = SEVERITIES.map((s) => [s, c.code_issues.filter((i) => i.severity === s).length] as const).filter(([, n]) => n > 0);
  return (
    <li data-testid="component-node" data-component-id={c.id} data-file={c.files[0] ?? ''} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
      <button type="button" onClick={() => onDetails(c.id)} className="min-w-0 truncate text-left font-mono text-sm hover:underline" title={c.id}>
        {c.id}
      </button>
      <span className="text-xs text-muted-foreground">{layerLabel(c.layer, profile)}</span>
      <span className="flex flex-wrap gap-1">
        {counts.map(([s, n]) => <SeverityBadge key={s} severity={s} count={n} />)}
        {c.secrets_references.length > 0 && (
          <span className="rounded px-1.5 py-0.5 text-xs font-medium" style={{ color: 'var(--sev-critical)', background: 'color-mix(in srgb, var(--sev-critical) 12%, transparent)' }}>
            Secretos {c.secrets_references.length}
          </span>
        )}
      </span>
      {canOpenSource && c.files.length > 0 && (
        <button
          type="button"
          data-testid="component-open-source"
          onClick={() => onOpenSource(c.files[0], c.id)}
          className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <FileCode className="h-3.5 w-3.5" aria-hidden /> Ver código
        </button>
      )}
    </li>
  );
}

export default function SummaryStep({
  view, profile, canOpenSource, onOpenSource, onDetails, onGoProposals, extraction,
}: {
  view: AnalysisView;
  profile: TechnologyProfile;
  /** 026: extraction configuration the analysis was submitted with. */
  extraction?: Record<string, unknown> | null;
  canOpenSource: boolean;
  onOpenSource: (file: string, id: string) => void;
  onDetails: (id: string) => void;
  onGoProposals: () => void;
}) {
  const s = summarize(view, profile);
  const { visible, empty } = resolveSections('summary', profile, view);
  const shown = (id: string) => visible.find((v) => v.def.id === id);
  const totalIssues = SEVERITIES.reduce((n, k) => n + s.severity[k], 0);
  const warnings = shown('summary-warnings');
  const candidates = shown('summary-candidates');
  const risky = shown('summary-risky');
  return (
    <div className="space-y-5">
      <div className="rounded-md border border-border bg-card p-5">
        <div className="flex flex-wrap items-center gap-3">
          <TechBadge profile={profile} />
          <span className="text-sm text-muted-foreground">
            Origen del análisis: <span className="font-mono">{profile.source}</span>
          </span>
          {describeExtractionConfig(extraction).length > 0 && (
            <span data-testid="extraction-summary" className="text-sm text-muted-foreground">
              Opciones de extracción: {describeExtractionConfig(extraction).join(', ')}
            </span>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-x-10 gap-y-4">
          <Metric id="components" label="Componentes" value={s.components} />
          <Metric id="loc" label="Líneas de código" value={s.loc} />
          <Metric id="edges" label="Dependencias internas" value={s.edges} />
          <Metric id="endpoints" label="Endpoints expuestos" value={s.endpoints} />
          <Metric id="proposals" label="Propuestas de extracción" value={s.proposals} />
        </div>
        <div className="mt-5 border-t border-border pt-4">
          <h3 className="text-sm font-medium">Salud del legacy</h3>
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            {SEVERITIES.map((k) => (
              <span key={k} data-testid="summary-severity" data-severity={k} data-value={s.severity[k]} className="inline-flex items-center gap-2">
                <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: severityColor(k) }} />
                <span className="tabular-nums font-medium">{fmt(s.severity[k])}</span>
                <span className="text-muted-foreground">{k === 'INFO' ? 'informativos' : ({ CRITICAL: 'críticos', ERROR: 'errores', WARNING: 'advertencias' } as const)[k]}</span>
              </span>
            ))}
            <span className="text-muted-foreground">
              · {fmt(s.componentsWithSecrets)} componentes con secretos · {fmt(s.tables)} tablas · {fmt(s.externalDependencies)} dependencias externas
            </span>
          </div>
          {totalIssues > 0 && (
            <div aria-hidden className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-muted">
              {SEVERITIES.map((k) => <div key={k} style={{ width: `${(100 * s.severity[k]) / totalIssues}%`, background: severityColor(k) }} />)}
            </div>
          )}
        </div>
      </div>

      {profile.reducedFidelity && (
        <div data-testid="reduced-fidelity-warning" role="note" className="flex gap-3 rounded-md border px-4 py-3 text-sm" style={{ borderColor: 'color-mix(in srgb, var(--sev-warning) 45%, transparent)', background: 'color-mix(in srgb, var(--sev-warning) 8%, transparent)' }}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--sev-warning)' }} aria-hidden />
          <p>
            <span className="font-medium">Fidelidad reducida.</span> El proyecto no pudo compilarse con su SDK, así que el motor usó un
            análisis sintáctico: algunas dependencias y métricas pueden faltar. Tómalo como una primera lectura.
          </p>
        </div>
      )}

      {warnings && (
        <Section id="summary-warnings" title={warnings.def.title} count={warnings.items.length}>
          <div data-testid="analysis-warnings">
            <ul className="space-y-1 font-mono text-xs">
              {(warnings.items as string[]).map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        </Section>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        {candidates && (
          <Section
            id="summary-candidates"
            title={candidates.def.title}
            count={candidates.items.length}
            actions={<button type="button" onClick={onGoProposals} className="text-sm text-primary hover:underline">Ver todas las propuestas</button>}
          >
            <ol className="space-y-2">
              {(candidates.items as AnalysisView['architecture']['proposals']).map((p) => (
                <li key={p.id} data-testid="proposal-card" data-proposal-id={p.id} data-viability={p.viability} className="rounded-md border border-border px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{p.name}</span>
                    <ViabilityBadge viability={p.viability} />
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                    {p.components.length} componentes · cohesión {p.metrics.cohesion_avg.toFixed(2)} · acoplamiento externo {num(p.metrics.external_coupling)}
                    {p.metrics.tables.length > 0 && ` · ${p.metrics.tables.length} tablas`}
                  </div>
                </li>
              ))}
            </ol>
          </Section>
        )}
        {risky && (
          <Section id="summary-risky" title={risky.def.title} count={risky.items.length} description="Ordenados por severidad de sus problemas, secretos y datos sensibles.">
            <ul className="divide-y divide-border">
              {(risky.items as Component[]).map((c) => (
                <RiskyComponentRow key={c.id} c={c} profile={profile} canOpenSource={canOpenSource} onOpenSource={onOpenSource} onDetails={onDetails} />
              ))}
            </ul>
          </Section>
        )}
      </div>
      <NoFindings step="summary" empty={empty} />
    </div>
  );
}
