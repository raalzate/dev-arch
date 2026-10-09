"use client";

// "Parámetros de inferencia" (010 FR-022..FR-025, FR-027): engine defaults and contract ranges, one slider and one
// numeric field per parameter, minimum viability, reset, and the state of the last recalculation. Every change
// re-infers with the engine through the web API; the last change wins.
import React, { useEffect, useState } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { MIN_VIABILITIES, clampToRange, type MinViability, type PanelParameter } from '@/lib/modernization/inference';

export type InferenceRunState = 'original' | 'pending' | 'recalculated' | 'error';

export interface InferenceUiState {
  params: PanelParameter[] | null;
  loadError: string | null;
  values: Record<string, number>;
  minViability: MinViability | null;
  state: InferenceRunState;
  revision: number;
  error: string | null;
  lastMs: number | null;
}

function ParamRow({ p, value, onCommit, disabled }: { p: PanelParameter; value: number; onCommit: (v: number) => void; disabled: boolean }) {
  const [slider, setSlider] = useState(value);
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setSlider(value);
    setText(String(value));
  }, [value]);
  useEffect(() => {
    if (slider === value) return;
    const t = setTimeout(() => onCommit(slider), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slider]);
  const commitText = () => {
    const v = clampToRange(Number(text.replace(',', '.')), p);
    setText(String(v));
    if (v !== value) onCommit(v);
  };
  const changed = value !== p.default;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={`inf-${p.path}`} className={`text-sm ${changed ? 'font-medium' : ''}`}>{p.label}</label>
        <span className="font-mono text-2xs text-muted-foreground" title="Valor del motor por defecto">por defecto {p.default}</span>
      </div>
      <div className="flex items-center gap-2">
        <input
          id={`inf-${p.path}`}
          type="range"
          data-testid="inference-param"
          data-path={p.path}
          min={p.min}
          max={p.max}
          step={p.step}
          value={slider}
          aria-valuemin={p.min}
          aria-valuemax={p.max}
          aria-valuenow={value}
          disabled={disabled}
          onChange={(e) => setSlider(Number(e.target.value))}
          className="h-1.5 min-w-0 flex-1 cursor-pointer accent-[hsl(var(--primary))]"
        />
        <input
          type="number"
          data-testid="inference-input"
          data-path={p.path}
          aria-label={`${p.label} (valor)`}
          min={p.min}
          max={p.max}
          step={p.step}
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commitText(); }}
          onBlur={commitText}
          className="h-7 w-[4.5rem] rounded border border-input bg-background px-1.5 text-right font-mono text-xs tabular-nums"
        />
      </div>
    </div>
  );
}

export default function InferencePanel({
  ui, onChange, onMinViability, onReset,
}: {
  ui: InferenceUiState;
  onChange: (path: string, value: number) => void;
  onMinViability: (v: MinViability | null) => void;
  onReset: () => void;
}) {
  const statusText =
    ui.state === 'pending' ? 'Recalculando con el motor…'
      : ui.state === 'recalculated' ? `Propuestas recalculadas por el motor${ui.lastMs !== null ? ` en ${(ui.lastMs / 1000).toFixed(1)} s` : ''}`
        : ui.state === 'error' ? 'El motor rechazó la configuración; se mantienen las propuestas anteriores'
          : 'Propuestas originales del análisis';
  return (
    <aside data-testid="inference-panel" aria-label="Parámetros de inferencia" className="space-y-4 rounded-md border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">Parámetros de inferencia</h3>
          <p className="text-xs text-muted-foreground">Recalcula las propuestas sin volver a analizar el código.</p>
        </div>
        <button
          type="button"
          data-testid="inference-reset"
          onClick={onReset}
          disabled={!ui.params}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Restablecer
        </button>
      </div>
      <p
        data-testid="inference-status"
        data-state={ui.state}
        data-revision={ui.revision}
        aria-live="polite"
        className="flex items-center gap-1.5 text-xs text-muted-foreground"
      >
        {ui.state === 'pending' && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
        {statusText}
      </p>
      {ui.error && (
        <p data-testid="inference-error" role="alert" className="rounded border px-2.5 py-2 text-xs" style={{ color: 'var(--sev-critical)', borderColor: 'color-mix(in srgb, var(--sev-critical) 40%, transparent)' }}>
          {ui.error}
        </p>
      )}
      {ui.loadError && <p role="alert" className="text-sm text-muted-foreground">{ui.loadError}</p>}
      {!ui.params && !ui.loadError && <p className="text-sm text-muted-foreground">Leyendo los valores por defecto del motor…</p>}
      {ui.params && (
        <div className="space-y-3">
          {ui.params.map((p) => (
            <ParamRow key={p.path} p={p} value={ui.values[p.path] ?? p.default} onCommit={(v) => onChange(p.path, v)} disabled={false} />
          ))}
          <label className="block space-y-1">
            <span className="text-sm">Viabilidad mínima a mostrar</span>
            <select
              data-testid="inference-min-viability"
              value={ui.minViability ?? ''}
              onChange={(e) => onMinViability((e.target.value || null) as MinViability | null)}
              className="block h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">Todas</option>
              {MIN_VIABILITIES.map((v) => <option key={v} value={v}>{v} o superior</option>)}
            </select>
          </label>
        </div>
      )}
    </aside>
  );
}
