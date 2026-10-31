"use client";

// Step 2 — System map (010 FR-017..FR-021, FR-021a): legend of dependency types (toggle), grouping by layer or by
// proposal, severity highlighting, the d3 map and its textual alternative (visible dependencies and components).
import React, { useMemo, useState } from 'react';
import type { Component } from '@static-inference/schema';
import {
  NO_PROPOSAL, edgeTypes, groupComponents, highlightedComponents, legend, visibleEdges, type GroupMode,
} from '@/lib/modernization/graph-model';
import { layerLabel } from '@/lib/modernization/layers';
import type { AnalysisView } from '@/lib/modernization/sections';
import { SEVERITIES, SEVERITY_STYLES, type Severity } from '@/lib/modernization/severity';
import type { TechnologyProfile } from '@/lib/modernization/technology';
import ComponentGraph, { groupColor } from '../component-graph';

export default function MapStep({
  view, profile, selectedId, onSelect, details,
}: {
  view: AnalysisView;
  profile: TechnologyProfile;
  selectedId: string | null;
  onSelect: (id: string) => void;
  details: React.ReactNode;
}) {
  const { graph, architecture } = view;
  const [disabled, setDisabled] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<GroupMode>('layer');
  const [minSeverity, setMinSeverity] = useState<Severity | null>(null);

  const types = useMemo(() => legend(graph.edges), [graph.edges]);
  const drawn = useMemo(() => visibleEdges(graph.edges, disabled), [graph.edges, disabled]);
  const groupOf = useMemo(() => groupComponents(graph.components, mode, architecture.proposals, profile), [graph.components, mode, architecture.proposals, profile]);
  const groups = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of groupOf.values()) counts.set(g, (counts.get(g) ?? 0) + 1);
    const names = [...counts.keys()].sort((a, b) => (a === NO_PROPOSAL ? 1 : b === NO_PROPOSAL ? -1 : a < b ? -1 : a > b ? 1 : 0));
    if (mode === 'proposal') for (const p of architecture.proposals) if (!names.includes(p.name)) names.push(p.name);
    return names.map((name) => ({ name, count: counts.get(name) ?? 0 }));
  }, [groupOf, mode, architecture.proposals]);
  const groupNames = groups.map((g) => g.name);
  const highlighted = useMemo(() => highlightedComponents(graph.components, minSeverity), [graph.components, minSeverity]);
  const byId = useMemo(() => new Map(graph.components.map((c) => [c.id, c])), [graph.components]);

  const toggle = (t: string) =>
    setDisabled((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });

  const link = (id: string) => (
    <button type="button" data-testid="map-component-link" data-component-id={id} onClick={() => onSelect(id)} className="max-w-full truncate text-left font-mono text-xs hover:underline" title={id}>
      {id}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-x-8 gap-y-3 rounded-md border border-border bg-card p-4">
        <div>
          <h3 className="text-xs font-medium text-muted-foreground">Tipos de dependencia</h3>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {types.map((t) => {
              const on = !disabled.has(t.type);
              return (
                <button
                  key={t.type}
                  type="button"
                  data-testid="map-legend-type"
                  data-type={t.type}
                  data-count={t.count}
                  aria-pressed={on}
                  onClick={() => toggle(t.type)}
                  className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-xs ${on ? 'border-border bg-background' : 'border-dashed border-border text-muted-foreground line-through'}`}
                >
                  {t.type} <span className="tabular-nums text-muted-foreground">{t.count}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <h3 className="text-xs font-medium text-muted-foreground">Agrupar por</h3>
          <div data-testid="map-group-mode" role="radiogroup" aria-label="Agrupar por" className="mt-1.5 inline-flex rounded-md border border-border p-0.5">
            {(['layer', 'proposal'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                data-mode={m}
                onClick={() => setMode(m)}
                className={`rounded px-2.5 py-0.5 text-sm ${mode === m ? 'bg-accent font-medium' : 'text-muted-foreground'}`}
              >
                {m === 'layer' ? 'Capa' : 'Propuesta'}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Resaltar problemas desde</span>
          <select
            data-testid="map-severity"
            value={minSeverity ?? ''}
            onChange={(e) => setMinSeverity((e.target.value || null) as Severity | null)}
            className="mt-1.5 block h-8 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">Sin resaltar</option>
            {SEVERITIES.map((s) => <option key={s} value={s}>{SEVERITY_STYLES[s].label}</option>)}
          </select>
        </label>
        <p className="ml-auto self-end text-xs text-muted-foreground tabular-nums">
          {drawn.length} de {graph.edges.length} dependencias · {highlighted.size > 0 ? `${highlighted.size} resaltados` : `${graph.components.length} componentes`}
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-2">
          <ComponentGraph
            components={graph.components}
            edges={drawn}
            layoutEdges={graph.edges}
            groups={groupNames}
            groupOf={groupOf}
            highlighted={highlighted}
            selectedId={selectedId}
            onSelect={onSelect}
            mode={mode}
          />
          <ul aria-label="Grupos" className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {groups.map((g) => (
              <li key={g.name} data-testid="map-legend-group" data-group={g.name} className="inline-flex items-center gap-1.5">
                <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: groupColor(groupNames, g.name) }} />
                {g.name} <span className="tabular-nums text-muted-foreground">{g.count}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Arrastra para mover el mapa y usa la rueda para acercar. El grosor de cada línea es el peso de la dependencia; las líneas
            discontinuas son inyecciones o registros en el contenedor.
          </p>
        </div>
        <div className="min-w-0">{details ?? <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">Selecciona un componente en el mapa o en las tablas para ver su detalle.</p>}</div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-border bg-card">
          <h3 className="border-b border-border px-4 py-2.5 text-base font-semibold">
            Dependencias visibles <span className="text-xs font-normal tabular-nums text-muted-foreground">{drawn.length}</span>
          </h3>
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-card text-muted-foreground">
                <tr><th className="px-4 py-1.5 font-medium">Origen</th><th className="px-2 py-1.5 font-medium">Destino</th><th className="px-2 py-1.5 font-medium">Tipo</th><th className="px-4 py-1.5 text-right font-medium">Peso</th></tr>
              </thead>
              <tbody>
                {drawn.map((e, i) => (
                  <tr key={`${e.from}->${e.to}#${i}`} data-testid="map-edge-row" data-from={e.from} data-to={e.to} className="border-t border-border">
                    <td className="max-w-[14rem] px-4 py-1">{link(e.from)}</td>
                    <td className="max-w-[14rem] px-2 py-1">{link(e.to)}</td>
                    <td className="px-2 py-1 font-mono text-muted-foreground">{edgeTypes(e).join(', ')}</td>
                    <td className="px-4 py-1 text-right tabular-nums">{e.weight}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="rounded-md border border-border bg-card">
          <h3 className="border-b border-border px-4 py-2.5 text-base font-semibold">
            Componentes <span className="text-xs font-normal tabular-nums text-muted-foreground">{graph.components.length}</span>
          </h3>
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-card text-muted-foreground">
                <tr><th className="px-4 py-1.5 font-medium">Componente</th><th className="px-2 py-1.5 font-medium">{mode === 'layer' ? 'Capa' : 'Propuesta'}</th><th className="px-2 py-1.5 text-right font-medium">LOC</th><th className="px-4 py-1.5 text-right font-medium">Entrantes</th></tr>
              </thead>
              <tbody>
                {[...graph.components].sort((a: Component, b: Component) => (a.id < b.id ? -1 : 1)).map((c) => (
                  <tr key={c.id} className={`border-t border-border ${c.id === selectedId ? 'bg-accent' : ''}`}>
                    <td className="max-w-[16rem] px-4 py-1">{link(c.id)}</td>
                    <td className="px-2 py-1 text-muted-foreground">{mode === 'layer' ? layerLabel(c.layer, profile) : groupOf.get(c.id)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{c.loc}</td>
                    <td className="px-4 py-1 text-right tabular-nums">{byId.get(c.id)?.calls_in.length ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
