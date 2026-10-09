// Result section and "Sin hallazgos" line (010 FR-003..FR-005; contracts/ui-sections.md). A section is rendered
// only with at least one item; the applicable sections without items are named once per step.
import React from 'react';

export function Section({
  id, title, count, children, actions, description,
}: { id: string; title: string; count: number; children: React.ReactNode; actions?: React.ReactNode; description?: React.ReactNode }) {
  if (count < 1) return null;
  return (
    <section data-testid="section" data-section={id} data-count={count} aria-labelledby={`sec-${id}`} className="rounded-md border border-border bg-card">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border px-4 py-2.5">
        <h3 id={`sec-${id}`} className="text-base font-semibold">{title}</h3>
        <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
        {description && <p className="basis-full text-xs text-muted-foreground">{description}</p>}
        {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
      </header>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

export function NoFindings({ step, empty }: { step: string; empty: { id: string; title: string }[] }) {
  if (empty.length === 0) return null;
  return (
    <p data-testid="no-findings" data-step={step} data-sections={empty.map((e) => e.id).join(',')} className="text-xs text-muted-foreground">
      Sin hallazgos: {empty.map((e) => e.title.toLowerCase()).join(' · ')}.
    </p>
  );
}
