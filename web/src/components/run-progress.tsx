"use client";

// Progress of a queued or running analysis (010 FR-011): the real engine phase marked within the four phases and
// the elapsed time. No partial result is ever shown here.
import React, { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { PHASE_LABELS, type AnalysisStatus, type Phase } from '@/lib/analyses-client';

const ORDER: Phase[] = ['detection', 'extraction', 'inference', 'writing'];

function elapsed(from: string | null): string {
  if (!from) return '0 s';
  const s = Math.max(0, Math.floor((Date.now() - Date.parse(from)) / 1000));
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
}

export default function RunProgress({ status }: { status: AnalysisStatus }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const current = status.status === 'running' && status.phase ? ORDER.indexOf(status.phase) : -1;
  return (
    <section data-testid="run-progress" aria-live="polite" className="max-w-2xl rounded-md border border-border bg-card p-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-md font-semibold">{status.status === 'queued' ? 'Análisis en cola' : 'Analizando el proyecto'}</h2>
        <span className="text-sm text-muted-foreground">
          Tiempo transcurrido <span data-testid="run-elapsed" className="font-mono tabular-nums text-foreground">{elapsed(status.startedAt ?? status.createdAt)}</span>
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {status.status === 'queued'
          ? 'Hay otro análisis en curso; este empieza en cuanto termine.'
          : 'Los resultados aparecen cuando el motor termina las cuatro fases.'}
      </p>
      <ol className="mt-4 grid grid-cols-4 gap-2">
        {ORDER.map((p, i) => {
          const state = current < 0 ? 'pending' : i < current ? 'done' : i === current ? 'current' : 'pending';
          return (
            <li key={p} data-testid="run-phase-step" data-phase={p} data-state={state} aria-current={state === 'current' ? 'step' : undefined}>
              <div className={`h-1 rounded-full ${state === 'pending' ? 'bg-border' : 'bg-primary'} ${state === 'current' ? 'animate-pulse' : ''}`} />
              <div className={`mt-2 flex items-center gap-1.5 text-sm ${state === 'pending' ? 'text-muted-foreground' : 'text-foreground'}`}>
                {state === 'done' && <Check className="h-3.5 w-3.5 text-primary" aria-hidden />}
                {state === 'current' && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden />}
                <span>{i + 1}. {PHASE_LABELS[p]}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
