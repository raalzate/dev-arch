"use client";

// Comparison of two analyses (010 FR-038): totals side by side with the difference, and the components present only
// in each one.
import React from 'react';
import { X } from 'lucide-react';
import type { Comparison } from '@/lib/modernization/compare';
import { VIABILITY_ORDER } from '@/lib/modernization/ordering';
import { SEVERITIES, SEVERITY_STYLES } from '@/lib/modernization/severity';

export interface ComparedSide {
  jobId: string;
  project: string;
  label: string;
  createdAt: string;
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

export default function ComparisonView({ a, b, cmp, onClose }: { a: ComparedSide; b: ComparedSide; cmp: Comparison; onClose: () => void }) {
  const rows: { metric: string; label: string; a: number; b: number; d: number }[] = [
    { metric: 'components', label: 'Componentes', a: cmp.a.components, b: cmp.b.components, d: cmp.delta.components },
    { metric: 'loc', label: 'Líneas de código', a: cmp.a.loc, b: cmp.b.loc, d: cmp.delta.loc },
    { metric: 'edges', label: 'Dependencias internas', a: cmp.a.edges, b: cmp.b.edges, d: cmp.delta.edges },
    ...VIABILITY_ORDER.map((v) => ({ metric: `proposals-${v}`, label: `Propuestas de viabilidad ${v.toLowerCase()}`, a: cmp.a.proposals[v], b: cmp.b.proposals[v], d: cmp.delta.proposals[v] })),
    ...SEVERITIES.map((s) => ({ metric: `issues-${s}`, label: `Problemas ${SEVERITY_STYLES[s].label.toLowerCase()}`, a: cmp.a.issues[s], b: cmp.b.issues[s], d: cmp.delta.issues[s] })),
  ];
  const only = (testId: string, title: string, ids: string[]) => (
    <div className="rounded-md border border-border bg-card">
      <h3 className="border-b border-border px-4 py-2.5 text-base font-semibold">{title} <span className="text-xs font-normal tabular-nums text-muted-foreground">{ids.length}</span></h3>
      <ul data-testid={testId} className="max-h-80 space-y-0.5 overflow-auto px-4 py-2 font-mono text-xs">
        {ids.map((id) => <li key={id} className="truncate" title={id}>{id}</li>)}
        {ids.length === 0 && <p className="font-sans text-sm text-muted-foreground">Ninguno.</p>}
      </ul>
    </div>
  );
  return (
    <section data-testid="comparison-view" aria-label="Comparación de análisis" className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">Comparación</h2>
        <span className="text-sm text-muted-foreground"><span className="font-mono">A</span> {a.project} ({a.label}) frente a <span className="font-mono">B</span> {b.project} ({b.label})</span>
        <button type="button" onClick={onClose} className="ml-auto inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-sm hover:bg-accent">
          <X className="h-4 w-4" aria-hidden /> Cerrar comparación
        </button>
      </div>
      <div className="overflow-auto rounded-md border border-border bg-card">
        <table className="w-full text-sm tabular-nums">
          <thead className="text-left text-xs text-muted-foreground">
            <tr><th className="px-4 py-2 font-medium">Métrica</th><th className="px-4 py-2 text-right font-medium">A · {a.project}</th><th className="px-4 py-2 text-right font-medium">B · {b.project}</th><th className="px-4 py-2 text-right font-medium">B − A</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.metric} data-testid="comparison-total" data-metric={r.metric} data-a={r.a} data-b={r.b} className="border-t border-border">
                <td className="px-4 py-1.5">{r.label}</td>
                <td className="px-4 py-1.5 text-right">{r.a.toLocaleString('es')}</td>
                <td className="px-4 py-1.5 text-right">{r.b.toLocaleString('es')}</td>
                <td className={`px-4 py-1.5 text-right ${r.d === 0 ? 'text-muted-foreground' : 'font-medium'}`}>{signed(r.d)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {only('comparison-only-a', `Solo en A (${a.project})`, cmp.onlyInA)}
        {only('comparison-only-b', `Solo en B (${b.project})`, cmp.onlyInB)}
      </div>
    </section>
  );
}
