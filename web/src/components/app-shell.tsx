"use client";

// Application shell of the modernization flow (010 FR-008, FR-010, FR-015): top bar (product, project, technology,
// analysis status, history, new analysis, theme) with top spacing and the brand mark (013), a 3 px stripe in the technology accent and the numbered step rail.
import React, { useRef } from 'react';
import { History } from 'lucide-react';
import { PHASE_LABELS, STATUS_LABELS, type AnalysisStatus } from '@/lib/analyses-client';
import { STEPS, type StepId } from '@/lib/modernization/sections';
import type { TechnologyProfile } from '@/lib/modernization/technology';
import { ACCENT_VAR, TechBadge } from './badges';
import { BrandMark } from './brand-mark';
import ThemeToggle from './theme-toggle';

export function StatusCluster({ status }: { status: AnalysisStatus }) {
  const tone = status.status === 'failed' ? 'text-destructive' : status.status === 'completed' ? 'text-muted-foreground' : 'text-primary';
  return (
    <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
      <span data-testid="analysis-status" data-status={status.status} className={`font-medium ${tone}`}>{STATUS_LABELS[status.status]}</span>
      <span
        data-testid="analysis-phase"
        data-phase={status.phase ?? ''}
        className={status.status === 'completed' || status.status === 'failed' ? 'sr-only' : ''}
      >
        {status.phase ? PHASE_LABELS[status.phase] : status.status === 'queued' ? 'esperando turno' : 'iniciando'}
      </span>
      <code data-testid="analysis-id" title="Identificador del análisis" className="hidden truncate font-mono text-2xs md:inline">{status.jobId}</code>
    </div>
  );
}

export function TopBar({
  project, profile, status, onHistory, upload,
}: {
  project: string | null;
  profile: TechnologyProfile | null;
  status: AnalysisStatus | null;
  onHistory: () => void;
  upload: React.ReactNode;
}) {
  return (
    <header data-testid="top-bar" className="sticky top-0 z-30 border-b border-border bg-card pt-3 print:hidden">
      <div className="flex h-[52px] items-center gap-3 px-4">
        <span className="flex items-center gap-2">
          <BrandMark className="h-6 w-6 shrink-0" />
          <span className="text-md font-semibold tracking-tight">dev-arch</span>
        </span>
        {project && (
          <>
            <span aria-hidden className="text-muted-foreground">/</span>
            <span className="max-w-[16rem] truncate font-mono text-sm" title={project}>{project}</span>
          </>
        )}
        {profile && <TechBadge profile={profile} />}
        {status && <StatusCluster status={status} />}
        <div className="ml-auto flex items-center gap-2">
          {upload}
          <button
            type="button"
            data-testid="history-open"
            onClick={onHistory}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-sm hover:bg-accent"
          >
            <History className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Historial</span>
          </button>
          <ThemeToggle />
        </div>
      </div>
      <div aria-hidden className="h-[3px]" style={{ background: profile ? ACCENT_VAR[profile.accent] : 'hsl(var(--border))' }} />
    </header>
  );
}

export function StepRail({ active, counts, onSelect }: { active: StepId; counts: Partial<Record<StepId, number>>; onSelect: (s: StepId) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const next = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? STEPS.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    refs.current[(next + STEPS.length) % STEPS.length]?.focus();
  };
  return (
    <nav data-testid="step-nav" aria-label="Pasos de la modernización" className="print:hidden">
      <ol className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
        {STEPS.map((s, i) => {
          const current = s.id === active;
          return (
            <li key={s.id} className="shrink-0">
              <button
                ref={(el) => { refs.current[i] = el; }}
                type="button"
                data-testid="step-link"
                data-step={s.id}
                aria-current={current ? 'step' : undefined}
                onClick={() => onSelect(s.id)}
                onKeyDown={(e) => onKey(e, i)}
                className={`group flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm ${current ? 'bg-accent font-medium text-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'}`}
              >
                <span
                  aria-hidden
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums ${current ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}
                >
                  {i + 1}
                </span>
                <span className="whitespace-nowrap">{s.label}</span>
                {counts[s.id] !== undefined && <span className="ml-auto text-xs tabular-nums text-muted-foreground">{counts[s.id]}</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
