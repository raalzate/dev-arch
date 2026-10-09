"use client";

// Step 5 — Plan (010 FR-033..FR-035, FR-039, FR-040): stages ordered by viability, exports (JSON, Markdown, print to
// PDF) and the technology-specific AI documentation.
import React, { useState } from 'react';
import { Download, FileText, Loader2, Printer, Sparkles } from 'lucide-react';
import type { ModernizationPlan } from '@/lib/modernization/plan';
import { ViabilityBadge } from '../badges';

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export default function PlanStep({
  plan, markdown, json, onGenerateDocs, docs,
}: {
  plan: ModernizationPlan;
  markdown: () => string;
  json: () => string;
  onGenerateDocs: () => void;
  docs: { loading: boolean; text: string | null; error: string | null; provider: string | null; template: string | null };
}) {
  const [copied, setCopied] = useState(false);
  const base = `${plan.project.replace(/[^\w.-]+/g, '-') || 'proyecto'}-plan`;
  const btn = 'inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-sm hover:bg-accent';
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-4 py-3">
        <p className="mr-auto text-sm text-muted-foreground">
          {plan.totals.proposals} propuestas en {plan.stages.length} etapas{plan.parameters ? ', con los parámetros de inferencia ajustados' : ''}.
        </p>
        <button type="button" data-testid="export-markdown" className={btn} onClick={() => download(`${base}.md`, markdown(), 'text/markdown;charset=utf-8')}>
          <FileText className="h-4 w-4" aria-hidden /> Markdown
        </button>
        <button type="button" data-testid="export-json" className={btn} onClick={() => download(`${base}.json`, json(), 'application/json;charset=utf-8')}>
          <Download className="h-4 w-4" aria-hidden /> JSON
        </button>
        <button type="button" data-testid="export-pdf" className={btn} onClick={() => window.print()}>
          <Printer className="h-4 w-4" aria-hidden /> PDF (imprimir)
        </button>
      </div>

      <ol className="space-y-5">
        {plan.stages.map((st) => (
          <li key={st.viability} data-testid="plan-stage" data-viability={st.viability} className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
            <div>
              <div className="text-xs text-muted-foreground">Etapa {st.index}</div>
              <h3 className="text-md font-semibold">{st.title}</h3>
              <ViabilityBadge viability={st.viability} />
            </div>
            <ol className="space-y-2">
              {st.proposals.map((p, i) => (
                <li key={p.id} className="rounded-md border border-border bg-card px-4 py-3">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-xs tabular-nums text-muted-foreground">{st.index}.{i + 1}</span>
                    <span className="font-medium">{p.name}</span>
                    {p.edited && <span className="rounded bg-accent px-1.5 py-0.5 text-xs">Editada{p.score !== null ? `, puntuación ${p.score.toFixed(2)}` : ''}</span>}
                    {p.entrypoint && p.entrypoint.type !== 'internal' && <span className="text-xs text-muted-foreground">entrada {p.entrypoint.type}</span>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                    {p.components.length} componentes · cohesión {p.cohesion.toFixed(2)} · acoplamiento externo {p.coupling}
                    {p.tables.length > 0 && ` · ${p.tables.length} tablas`}
                    {p.severeIssues > 0 && ` · ${p.severeIssues} problemas graves`}
                    {p.componentsWithSecrets.length > 0 && ` · ${p.componentsWithSecrets.length} con secretos`}
                  </p>
                  {p.actions.length > 0 && (
                    <ul className="mt-2 list-disc space-y-0.5 pl-4 text-sm">{p.actions.map((a, k) => <li key={k}>{a}</li>)}</ul>
                  )}
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>

      <section data-testid="ai-panel" aria-label="Documentación con IA" className="rounded-md border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="mr-auto">
            <h3 className="text-base font-semibold">Documentación de arquitectura con IA</h3>
            <p className="text-xs text-muted-foreground">
              Usa la plantilla de {plan.profile.label} y el proveedor configurado en el servidor (LLM_PROVIDER). Solo se envían los
              documentos del análisis, no el código fuente.
            </p>
          </div>
          <button type="button" data-testid="ai-generate" onClick={onGenerateDocs} disabled={docs.loading} className={`${btn} disabled:opacity-60`}>
            {docs.loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
            {docs.text ? 'Regenerar' : 'Generar documentación'}
          </button>
        </div>
        {docs.error && <p role="alert" className="mt-3 text-sm" style={{ color: 'var(--sev-critical)' }}>{docs.error}</p>}
        {docs.text && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Plantilla {docs.template} · proveedor {docs.provider}</span>
              <button type="button" className="ml-auto rounded border border-border px-2 py-0.5 hover:bg-accent" onClick={() => { void navigator.clipboard?.writeText(docs.text ?? ''); setCopied(true); }}>
                {copied ? 'Copiado' : 'Copiar'}
              </button>
              <button type="button" className="rounded border border-border px-2 py-0.5 hover:bg-accent" onClick={() => download(`${base}-arquitectura.md`, docs.text ?? '', 'text/markdown;charset=utf-8')}>
                Descargar
              </button>
            </div>
            <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded border border-border bg-background p-3 text-sm">{docs.text}</pre>
          </div>
        )}
      </section>
    </div>
  );
}
