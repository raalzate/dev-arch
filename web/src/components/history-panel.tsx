"use client";

// History of the analyses kept by the server (010 FR-036..FR-038): open any completed analysis or select two and
// compare them. Rendered as a side sheet over the current step.
import React, { useState } from 'react';
import { GitCompare, X } from 'lucide-react';
import type { HistoryEntry } from '@/lib/analyses-client';
import { STATUS_LABELS } from '@/lib/analyses-client';
import { isComparable } from '@/lib/modernization/compare';

function when(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

const TECH_VAR: Record<string, string> = { java: 'var(--tech-java)', csharp: 'var(--tech-dotnet)', dotnet: 'var(--tech-dotnet)', 'dotnet-mixed': 'var(--tech-dotnet)', vb: 'var(--tech-vb)' };

export default function HistoryPanel({
  entries, loading, error, activeJobId, onOpen, onCompare, onClose,
}: {
  entries: HistoryEntry[];
  loading: boolean;
  error: string | null;
  activeJobId: string | null;
  onOpen: (jobId: string) => void;
  onCompare: (a: string, b: string) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (id: string, on: boolean) => setSelected((prev) => (on ? [...prev.filter((x) => x !== id), id].slice(-2) : prev.filter((x) => x !== id)));
  return (
    <div className="fixed inset-0 z-50 flex justify-end print:hidden" role="dialog" aria-modal="true" aria-labelledby="history-title">
      <button type="button" aria-label="Cerrar historial" className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-[560px] flex-col border-l border-border bg-card shadow-xl">
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <h2 id="history-title" className="text-md font-semibold">Historial de análisis</h2>
          <span className="text-xs text-muted-foreground">en este servidor</span>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="ml-auto rounded p-1 text-muted-foreground hover:bg-accent"><X className="h-4 w-4" /></button>
        </header>
        <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-sm">
          <span className="text-muted-foreground">{selected.length === 2 ? 'Dos análisis seleccionados' : 'Marca dos análisis completados para compararlos'}</span>
          <button
            type="button"
            data-testid="history-compare"
            disabled={selected.length !== 2}
            onClick={() => onCompare(selected[0], selected[1])}
            className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <GitCompare className="h-4 w-4" aria-hidden /> Comparar
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          {loading && <p className="p-4 text-sm text-muted-foreground">Cargando el historial…</p>}
          {error && <p role="alert" className="p-4 text-sm" style={{ color: 'var(--sev-critical)' }}>{error}</p>}
          {!loading && !error && entries.length === 0 && <p className="p-4 text-sm text-muted-foreground">Todavía no hay análisis en este servidor.</p>}
          <ul className="divide-y divide-border">
            {entries.map((e) => {
              const project = e.projectRoot ?? e.origin;
              const comparable = isComparable(e);
              return (
                <li
                  key={e.jobId}
                  data-testid="history-row"
                  data-job-id={e.jobId}
                  data-status={e.status}
                  data-technology={e.technology ?? ''}
                  data-project={project}
                  className={`flex items-center gap-3 px-4 py-2.5 ${e.jobId === activeJobId ? 'bg-accent/60' : ''}`}
                >
                  <input
                    type="checkbox"
                    data-testid="history-select-compare"
                    aria-label={`Comparar ${project}`}
                    disabled={!comparable}
                    checked={selected.includes(e.jobId)}
                    onChange={(ev) => toggle(e.jobId, ev.target.checked)}
                    className="h-4 w-4 accent-[hsl(var(--primary))]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-mono text-sm">{project}</span>
                      {e.technologyLabel && <span className="text-xs font-medium" style={{ color: TECH_VAR[e.technology ?? ''] }}>{e.technologyLabel}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      {when(e.createdAt)} · {STATUS_LABELS[e.status]}
                      {e.summary ? ` · ${e.summary.componentCount} componentes · ${e.summary.proposalCount} propuestas` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    data-testid="history-open-analysis"
                    disabled={e.status === 'failed'}
                    onClick={() => onOpen(e.jobId)}
                    className="rounded-md border border-border px-2 py-1 text-sm hover:bg-accent disabled:opacity-50"
                  >
                    {e.jobId === activeJobId ? 'Abierto' : 'Abrir'}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
