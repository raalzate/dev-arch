"use client";

// Details of one component (010 FR-031): only attributes that have a value, incoming and outgoing calls, domain and
// the layer named for the technology. Rendered as a side panel of the map and findings steps.
import React from 'react';
import { FileCode, X } from 'lucide-react';
import type { Component } from '@static-inference/schema';
import { layerLabel } from '@/lib/modernization/layers';
import type { TechnologyProfile } from '@/lib/modernization/technology';
import { SeverityBadge } from './badges';

type Attr = { key: string; label: string; value: React.ReactNode; list?: string[] };

/** 027 (FR-020): lists longer than this scroll inside the panel instead of stretching it. */
const LIST_SCROLL_FROM = 6;

function has(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

export function componentAttributes(c: Component, profile: TechnologyProfile): Attr[] {
  const list: [string, string, unknown, ((v: never) => React.ReactNode)?][] = [
    ['layer', 'Capa', layerLabel(c.layer, profile)],
    ['domain', 'Dominio', c.domain],
    ['loc', 'Líneas de código', c.loc, (v: number) => v.toLocaleString('es')],
    ['cbo', 'Acoplamiento (CBO)', c.cbo],
    ['lcom', 'Falta de cohesión (LCOM)', c.lcom, (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2))],
    ['complexity_max', 'Complejidad máxima', c.complexity_max],
    ['ejb_type', 'Tipo EJB', c.ejb_type],
    ['messaging_type', 'Mensajería', c.messaging_type && [c.messaging_type, c.messaging_role].filter(Boolean).join(' · ')],
    ['web_type', 'Web', c.web_type && [c.web_type, c.web_role].filter(Boolean).join(' · ')],
    ['extends', 'Extiende', c.extends],
    ['implements', 'Implementa', c.implements, (v: string[]) => v.join(', ')],
    ['annotations', 'Anotaciones', c.annotations, (v: string[]) => v.map((a) => `@${a}`).join(' ')],
    ['tables_used', 'Tablas y procedimientos', c.tables_used, (v: string[]) => v.join(', ')],
    ['external_dependencies', 'Dependencias externas', c.external_dependencies, (v: string[]) => v.join(', ')],
    ['secrets_references', 'Referencias a secretos', c.secrets_references, (v: string[]) => String(v.length)],
    ['sensitive_data', 'Datos sensibles', c.sensitive_data ? 'Sí' : null],
    ['uses_jndi', 'Usa JNDI', c.uses_jndi ? 'Sí' : null],
    ['is_interface', 'Interfaz', c.is_interface ? 'Sí' : null],
  ];
  const LISTS = new Set(['annotations', 'tables_used', 'external_dependencies', 'implements']);
  return list
    .filter(([, , v]) => has(v))
    .map(([key, label, v, f]) => ({
      key, label, value: f ? f(v as never) : String(v),
      list: LISTS.has(key) && Array.isArray(v) ? (v as string[]).map((x) => (key === 'annotations' ? `@${x}` : x)) : undefined,
    }));
}

/** Value cell of the details grid: long tokens break anywhere; long lists scroll (027 FR-020). */
function AttrValue({ a }: { a: Attr }) {
  if (a.list && a.list.length > LIST_SCROLL_FROM) {
    return (
      <ul data-testid="detail-list" className="max-h-40 space-y-0.5 overflow-auto rounded border border-border/60 p-1.5 font-mono text-xs">
        {a.list.map((x) => <li key={x} className="break-all">{x}</li>)}
      </ul>
    );
  }
  if (a.list) return <span className="break-all font-mono text-xs">{a.list.join(', ')}</span>;
  return <>{a.value}</>;
}

export default function ComponentDetails({
  component, profile, canOpenSource, onOpenSource, onSelect, onClose,
}: {
  component: Component;
  profile: TechnologyProfile;
  canOpenSource: boolean;
  onOpenSource: (file: string, id: string) => void;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const c = component;
  const attrs = componentAttributes(c, profile);
  const calls = (title: string, ids: string[], testId: string) =>
    ids.length > 0 && (
      <div>
        <h4 className="text-xs font-medium text-muted-foreground">{title} ({ids.length})</h4>
        <ul className="mt-1 max-h-40 space-y-0.5 overflow-auto">
          {ids.map((id) => (
            <li key={id}>
              <button type="button" data-testid={testId} onClick={() => onSelect(id)} className="max-w-full truncate text-left font-mono text-xs hover:underline">
                {id}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  return (
    <aside data-testid="component-details" aria-label={`Detalle de ${c.id}`} className="min-w-0 space-y-4 overflow-hidden rounded-md border border-border bg-card p-4">
      <div className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1 break-all font-mono text-sm font-medium">{c.id}</h3>
        <button type="button" onClick={onClose} aria-label="Cerrar detalle" className="rounded p-1 text-muted-foreground hover:bg-accent">
          <X className="h-4 w-4" />
        </button>
      </div>
      <dl className="grid grid-cols-[minmax(6rem,auto)_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
        {attrs.map((a) => (
          <div key={a.key} data-testid="detail-attr" data-attr={a.key} className="contents">
            <dt className="text-muted-foreground">{a.label}</dt>
            <dd data-testid="detail-value" className="min-w-0 break-all"><AttrValue a={a} /></dd>
          </div>
        ))}
      </dl>
      {c.code_issues.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground">Problemas de código ({c.code_issues.length})</h4>
          <ul className="mt-1 max-h-48 space-y-1 overflow-auto text-xs">
            {c.code_issues.map((i, k) => (
              <li key={k} className="flex gap-2">
                <SeverityBadge severity={i.severity} />
                <span className="min-w-0 break-words">{i.message} <span className="text-muted-foreground">(línea {i.line})</span></span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {calls('Llamadas entrantes', c.calls_in, 'calls-in-item')}
      {calls('Llamadas salientes', c.calls_out, 'calls-out-item')}
      {c.files.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground">Archivos</h4>
          <ul className="mt-1 space-y-1">
            {c.files.map((f) => (
              <li key={f} className="flex items-center gap-2 font-mono text-xs">
                <span className="min-w-0 flex-1 truncate" title={f}>{f}</span>
                {canOpenSource && (
                  <button type="button" onClick={() => onOpenSource(f, c.id)} className="inline-flex items-center gap-1 rounded px-1 text-muted-foreground hover:bg-accent hover:text-foreground">
                    <FileCode className="h-3.5 w-3.5" aria-hidden /> Ver
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
