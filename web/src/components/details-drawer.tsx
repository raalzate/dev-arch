"use client";

// 028-details-drawer: the component detail as a fixed, non-modal panel on the right, shared by every step and by
// the search results. No overlay, Escape closes, "Atrás" walks the linear history, "Ver en el mapa" jumps to the map.
import React, { useEffect, useState } from 'react';
import { ArrowLeft, Map as MapIcon, X } from 'lucide-react';
import type { Component } from '@static-inference/schema';
import { back, navigate, open, type DrawerState } from '@/lib/modernization/drawer-history';
import type { TechnologyProfile } from '@/lib/modernization/technology';
import ComponentDetails from './component-details';

export const DRAWER_WIDTH_CLASS = 'lg:w-[520px]';
/** Right margin of the step content while the drawer is open (width + gap), large screens only. */
export const CONTENT_SHIFT_CLASS = 'lg:pr-[540px]';

export default function DetailsDrawer({
  selectedId, byId, profile, canOpenSource, onOpenSource, onSelect, onClose, onShowInMap,
}: {
  selectedId: string;
  byId: Map<string, Component>;
  profile: TechnologyProfile;
  canOpenSource: boolean;
  onOpenSource: (file: string, id: string) => void;
  /** Selection change (the map and the lists follow the drawer). */
  onSelect: (id: string) => void;
  onClose: () => void;
  onShowInMap: (id: string) => void;
}) {
  const [state, setState] = useState<DrawerState>(() => open(selectedId));
  // External selection (map click, search result) resets or advances the history.
  useEffect(() => {
    setState((s) => (s.current === selectedId ? s : navigate(s, selectedId)));
  }, [selectedId]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const component = byId.get(state.current);
  const go = (id: string) => {
    setState((s) => navigate(s, id));
    onSelect(id);
  };
  const goBack = () => {
    const next = back(state);
    setState(next);
    onSelect(next.current);
  };

  return (
    <aside
      data-testid="details-drawer"
      role="complementary"
      aria-label={`Detalle de ${state.current}`}
      className={`fixed inset-x-0 bottom-0 top-[72px] z-20 flex w-full flex-col border-l border-border bg-card shadow-xl lg:inset-x-auto lg:right-0 ${DRAWER_WIDTH_CLASS} print:hidden`}
    >
      <div className="flex items-center gap-1 border-b border-border px-3 py-2">
        <button
          type="button"
          data-testid="drawer-back"
          onClick={goBack}
          disabled={state.history.length === 0}
          aria-label="Atrás"
          className="inline-flex h-8 items-center gap-1 rounded px-2 text-sm text-muted-foreground hover:bg-accent disabled:invisible"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Atrás
        </button>
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {state.history.length > 0 ? `${state.history.length} en el historial` : 'Detalle del componente'}
        </span>
        <button
          type="button"
          data-testid="drawer-show-in-map"
          onClick={() => onShowInMap(state.current)}
          className="inline-flex h-8 items-center gap-1 rounded border border-border px-2 text-sm hover:bg-accent"
        >
          <MapIcon className="h-4 w-4" aria-hidden /> Ver en el mapa
        </button>
        <button type="button" data-testid="drawer-close" onClick={onClose} aria-label="Cerrar detalle" className="rounded p-1.5 text-muted-foreground hover:bg-accent">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {component ? (
          <ComponentDetails
            component={component}
            profile={profile}
            canOpenSource={canOpenSource}
            onOpenSource={onOpenSource}
            onSelect={go}
            onClose={onClose}
            embedded
          />
        ) : (
          <p className="text-sm text-muted-foreground">El componente {state.current} no está en este análisis.</p>
        )}
      </div>
    </aside>
  );
}
