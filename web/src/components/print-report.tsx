// Printable modernization report (010 FR-034): hidden on screen, the only thing printed. The browser print dialog
// saves it as PDF, so no PDF dependency is needed (Constitution VI).
import React from 'react';
import type { ModernizationPlan } from '@/lib/modernization/plan';
import { num } from './badges';
import { SEVERITIES, SEVERITY_STYLES } from '@/lib/modernization/severity';

export default function PrintReport({ plan }: { plan: ModernizationPlan }) {
  return (
    <article data-testid="print-report" className="hidden text-[11pt] leading-snug text-black print:block">
      <h1 className="text-[18pt] font-semibold">Plan de modernización: {plan.project}</h1>
      <p className="mt-1">
        {plan.profile.label} · análisis {plan.analysisId}
        {plan.finishedAt ? ` · ${plan.finishedAt}` : ''}
        {plan.profile.reducedFidelity ? ' · fidelidad reducida' : ''}
      </p>
      <h2 className="mt-5 text-[13pt] font-semibold">Resumen ejecutivo</h2>
      <p>
        {plan.totals.components} componentes, {plan.totals.loc} líneas de código, {plan.totals.edges} dependencias internas,
        {' '}{plan.totals.endpoints} endpoints y {plan.totals.proposals} propuestas de extracción. Problemas de código:{' '}
        {SEVERITIES.map((s) => `${plan.severityCounts[s]} ${SEVERITY_STYLES[s].label.toLowerCase()}`).join(', ')}.
      </p>
      {plan.stages.map((st) => (
        <section key={st.viability} className="mt-5 break-inside-avoid-page">
          <h2 className="text-[13pt] font-semibold">Etapa {st.index}: {st.title} (viabilidad {st.viability.toLowerCase()})</h2>
          <ol className="mt-1 list-decimal space-y-2 pl-5">
            {st.proposals.map((p) => (
              <li key={p.id} className="break-inside-avoid">
                <strong>{p.name}</strong>
                {p.edited && p.score !== null ? ` (editada, puntuación del motor ${p.score.toFixed(2)})` : ''} — {p.components.length} componentes,
                cohesión {p.cohesion.toFixed(2)}, acoplamiento externo {num(p.coupling)}
                {p.tables.length > 0 ? `, tablas: ${p.tables.join(', ')}` : ''}
                {p.sensitive ? ', datos sensibles' : ''}.
                {p.actions.length > 0 && <ul className="list-disc pl-5">{p.actions.map((a, i) => <li key={i}>{a}</li>)}</ul>}
              </li>
            ))}
          </ol>
        </section>
      ))}
      {plan.supportLibraries.length > 0 && (
        <section className="mt-5">
          <h2 className="text-[13pt] font-semibold">Librerías de soporte</h2>
          <ul className="list-disc pl-5">{plan.supportLibraries.map((l) => <li key={l.name}>{l.name} ({l.components} componentes)</li>)}</ul>
        </section>
      )}
      {plan.warnings.length > 0 && (
        <section className="mt-5">
          <h2 className="text-[13pt] font-semibold">Advertencias del análisis</h2>
          <ul className="list-disc pl-5 font-mono text-[9pt]">{plan.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </section>
      )}
      {plan.parameters && (
        <section className="mt-5">
          <h2 className="text-[13pt] font-semibold">Parámetros de inferencia</h2>
          <pre className="font-mono text-[9pt]">{JSON.stringify(plan.parameters, null, 2)}</pre>
        </section>
      )}
    </article>
  );
}
