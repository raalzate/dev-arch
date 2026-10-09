"use client";

// Step 4 — Findings (010 FR-028..FR-030): technology inventory sections that apply and have items, then tabs with
// content only (issues, secrets, contracts, entrypoints). Empty applicable sections are named once.
import React, { useMemo, useState } from 'react';
import type { ApiEndpoint, Component, Proposal, SecretLocation } from '@static-inference/schema';
import { groupIssues, type IssueGroupMode } from '@/lib/modernization/findings';
import { edgeTypes } from '@/lib/modernization/graph-model';
import { layerLabel } from '@/lib/modernization/layers';
import { FINDINGS_TABS, resolveSections, type AnalysisView, type IssueRow } from '@/lib/modernization/sections';
import { SEVERITIES, SEVERITY_STYLES, type Severity } from '@/lib/modernization/severity';
import type { TechnologyProfile } from '@/lib/modernization/technology';
import { SeverityBadge } from '../badges';
import { NoFindings, Section } from '../section';

const TAB_LABELS: Record<string, string> = {
  'tab-issues': 'Problemas de código',
  'tab-secrets': 'Secretos',
  'tab-contracts': 'Contratos',
  'tab-entrypoints': 'Puntos de entrada',
};

const ENTRY_LABELS: Record<string, string> = { rest: 'API REST', messaging: 'Mensajería', service: 'Servicio', internal: 'Interno' };

function CompLink({ id, onSelect }: { id: string; onSelect: (id: string) => void }) {
  return (
    <button type="button" onClick={() => onSelect(id)} className="max-w-full truncate text-left font-mono text-xs hover:underline" title={id}>
      {id}
    </button>
  );
}

function ComponentList({ items, profile, onSelect, extra }: { items: Component[]; profile: TechnologyProfile; onSelect: (id: string) => void; extra?: (c: Component) => React.ReactNode }) {
  return (
    <ul className="max-h-72 divide-y divide-border overflow-auto">
      {items.map((c) => (
        <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-1.5">
          <CompLink id={c.id} onSelect={onSelect} />
          <span className="text-xs text-muted-foreground">{layerLabel(c.layer, profile)}</span>
          {extra && <span className="ml-auto text-xs text-muted-foreground">{extra(c)}</span>}
        </li>
      ))}
    </ul>
  );
}

function IssueRows({ issues, onSelect }: { issues: IssueRow[]; onSelect: (id: string) => void }) {
  return (
    <ul className="divide-y divide-border">
      {issues.map((i, k) => (
        <li key={k} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 py-1.5 text-xs md:grid-cols-[auto_minmax(0,16rem)_minmax(0,1fr)]">
          <SeverityBadge severity={i.severity} />
          <span className="truncate"><CompLink id={i.componentId} onSelect={onSelect} /><span className="text-muted-foreground"> :{i.line}</span></span>
          <span className="col-span-2 md:col-span-1">{i.message} <span className="font-mono text-muted-foreground">{i.pattern}</span></span>
        </li>
      ))}
    </ul>
  );
}

function IssuesTab({ issues, onSelect }: { issues: IssueRow[]; onSelect: (id: string) => void }) {
  const [mode, setMode] = useState<IssueGroupMode>('severity');
  const [min, setMin] = useState<Severity | null>(null);
  const groups = useMemo(() => groupIssues(issues, mode, min), [issues, mode, min]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div data-testid="issues-group-mode" role="radiogroup" aria-label="Agrupar problemas por" className="inline-flex rounded-md border border-border p-0.5">
          {(['severity', 'pattern'] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} data-mode={m} onClick={() => setMode(m)} className={`rounded px-2.5 py-0.5 text-sm ${mode === m ? 'bg-accent font-medium' : 'text-muted-foreground'}`}>
              {m === 'severity' ? 'Por severidad' : 'Por patrón'}
            </button>
          ))}
        </div>
        <label className="inline-flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Desde</span>
          <select data-testid="issues-severity-filter" value={min ?? ''} onChange={(e) => setMin((e.target.value || null) as Severity | null)} className="h-8 rounded-md border border-input bg-background px-2 text-sm">
            <option value="">Todas las severidades</option>
            {SEVERITIES.map((s) => <option key={s} value={s}>{SEVERITY_STYLES[s].label}</option>)}
          </select>
        </label>
      </div>
      {groups.map((g) => (
        <details key={g.key} data-testid="issue-group" data-group={g.key} data-count={g.count} open={groups.length <= 3} className="rounded border border-border">
          <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm">
            {mode === 'severity' ? <SeverityBadge severity={g.key as Severity} /> : <span className="font-mono text-xs">{g.key}</span>}
            <span className="tabular-nums text-muted-foreground">{g.count}</span>
          </summary>
          <div className="max-h-96 overflow-auto border-t border-border px-3"><IssueRows issues={g.issues} onSelect={onSelect} /></div>
        </details>
      ))}
      {groups.length === 0 && <p className="text-sm text-muted-foreground">Ningún problema alcanza esa severidad.</p>}
    </div>
  );
}

export default function FindingsStep({
  view, profile, onSelect, details,
}: {
  view: AnalysisView;
  profile: TechnologyProfile;
  onSelect: (id: string) => void;
  details: React.ReactNode;
}) {
  const { visible, empty } = resolveSections('findings', profile, view);
  const inventory = visible.filter((v) => !(FINDINGS_TABS as readonly string[]).includes(v.def.id));
  const tabs = visible.filter((v) => (FINDINGS_TABS as readonly string[]).includes(v.def.id));
  const [tab, setTab] = useState<string | null>(null);
  const activeTab = tabs.find((t) => t.def.id === tab) ?? tabs[0];

  const renderInventory = (id: string, items: unknown[]) => {
    switch (id) {
      case 'csharp-di':
        return (
          <ul className="max-h-72 divide-y divide-border overflow-auto">
            {(items as AnalysisView['graph']['edges']).map((e, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-2 py-1.5 text-xs">
                <CompLink id={e.from} onSelect={onSelect} /><span className="text-muted-foreground">recibe</span><CompLink id={e.to} onSelect={onSelect} />
                <span className="ml-auto font-mono text-muted-foreground">{edgeTypes(e).join(', ')}</span>
              </li>
            ))}
          </ul>
        );
      case 'vb-legacy-risks':
        return <div className="max-h-72 overflow-auto"><IssueRows issues={items as IssueRow[]} onSelect={onSelect} /></div>;
      case 'dotnet-app-config':
        return (
          <ul className="space-y-1 font-mono text-xs">
            {(items as SecretLocation[]).map((s, i) => <li key={i}>{s.path}:{s.line} <span className="text-muted-foreground">{s.kind}{s.redacted ? ' (valor oculto)' : ''}</span></li>)}
          </ul>
        );
      case 'external-deps':
        return (
          <ul className="grid gap-x-6 gap-y-0.5 font-mono text-xs md:grid-cols-2">
            {(items as [string, string][]).map(([n, v]) => <li key={n} className="flex justify-between gap-2"><span className="truncate">{n}</span><span className="text-muted-foreground">{v}</span></li>)}
          </ul>
        );
      case 'messaging':
        return <ComponentList items={items as Component[]} profile={profile} onSelect={onSelect} extra={(c) => [c.messaging_type, c.messaging_role].filter(Boolean).join(' · ')} />;
      case 'data-access':
        return <ComponentList items={items as Component[]} profile={profile} onSelect={onSelect} extra={(c) => c.tables_used.join(', ')} />;
      case 'java-ejb':
        return <ComponentList items={items as Component[]} profile={profile} onSelect={onSelect} extra={(c) => c.ejb_type ?? ''} />;
      default:
        return <ComponentList items={items as Component[]} profile={profile} onSelect={onSelect} />;
    }
  };

  const renderTab = (id: string, items: unknown[]) => {
    switch (id) {
      case 'tab-issues':
        return <IssuesTab issues={items as IssueRow[]} onSelect={onSelect} />;
      case 'tab-secrets': {
        const comps = (items as (Component | SecretLocation)[]).filter((x): x is Component => 'id' in x);
        const locs = (items as (Component | SecretLocation)[]).filter((x): x is SecretLocation => 'path' in x && !('id' in x));
        return (
          <div className="grid gap-4 md:grid-cols-2">
            {comps.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground">Componentes que referencian secretos ({comps.length})</h4>
                <ComponentList items={comps} profile={profile} onSelect={onSelect} extra={(c) => `${c.secrets_references.length} referencias`} />
              </div>
            )}
            {locs.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground">Ubicaciones en configuración ({locs.length})</h4>
                <ul className="space-y-1 font-mono text-xs">{locs.map((s, i) => <li key={i}>{s.path}:{s.line} <span className="text-muted-foreground">{s.kind}</span></li>)}</ul>
              </div>
            )}
          </div>
        );
      }
      case 'tab-contracts':
        return (
          <div className="max-h-[480px] overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-card text-muted-foreground">
                <tr><th className="py-1.5 pr-2 font-medium">Método</th><th className="px-2 py-1.5 font-medium">Ruta</th><th className="px-2 py-1.5 font-medium">Componente</th><th className="px-2 py-1.5 font-medium">Parámetros</th><th className="py-1.5 pl-2 font-medium">Respuesta</th></tr>
              </thead>
              <tbody>
                {(items as ApiEndpoint[]).map((e) => (
                  <tr key={e.id} data-testid="contract-row" data-method={e.method} data-path={e.path} data-component={e.component_id} className="border-t border-border align-top">
                    <td className="py-1 pr-2 font-mono font-medium">{e.method}</td>
                    <td className="px-2 py-1 font-mono">{e.path}</td>
                    <td className="max-w-[16rem] px-2 py-1"><CompLink id={e.component_id} onSelect={onSelect} /></td>
                    <td className="px-2 py-1 font-mono text-muted-foreground">{e.parameters.map((p) => p.name).join(', ')}</td>
                    <td className="py-1 pl-2 font-mono text-muted-foreground">{e.response_schema ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case 'tab-entrypoints':
        return (
          <ul className="divide-y divide-border">
            {(items as Proposal[]).map((p) => (
              <li key={p.id} className="py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{p.name}</span>
                  <span className="rounded bg-accent px-1.5 py-0.5 text-xs">{ENTRY_LABELS[p.legacy_entrypoint!.type] ?? p.legacy_entrypoint!.type}</span>
                  {p.legacy_entrypoint!.primary_entry_class && <span className="font-mono text-xs text-muted-foreground">{p.legacy_entrypoint!.primary_entry_class}</span>}
                </div>
                {p.legacy_entrypoint!.description && <p className="text-xs text-muted-foreground">{p.legacy_entrypoint!.description}</p>}
              </li>
            ))}
          </ul>
        );
      default:
        return null;
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          {inventory.map((s) => (
            <Section key={s.def.id} id={s.def.id} title={s.def.title} count={s.items.length}>
              {renderInventory(s.def.id, s.items)}
            </Section>
          ))}
        </div>
        {tabs.length > 0 && (
          <div className="space-y-3">
            <div role="tablist" aria-label="Hallazgos" className="flex flex-wrap gap-1 border-b border-border">
              {tabs.map((t) => {
                const on = t.def.id === activeTab?.def.id;
                return (
                  <button
                    key={t.def.id}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    data-testid="findings-tab"
                    data-tab={t.def.id}
                    onClick={() => setTab(t.def.id)}
                    className={`-mb-px border-b-2 px-3 py-2 text-sm ${on ? 'border-primary font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                  >
                    {TAB_LABELS[t.def.id]} <span className="tabular-nums text-muted-foreground">{t.items.length}</span>
                  </button>
                );
              })}
            </div>
            {activeTab && (
              <div role="tabpanel">
                <Section id={activeTab.def.id} title={activeTab.def.title} count={activeTab.items.length}>
                  {renderTab(activeTab.def.id, activeTab.items)}
                </Section>
              </div>
            )}
          </div>
        )}
        <NoFindings step="findings" empty={empty} />
      </div>
      <div>{details}</div>
    </div>
  );
}
