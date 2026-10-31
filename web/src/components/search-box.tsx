"use client";

// 027-large-project-ux (US4): lexical search over every datum of the analysis, in the top bar. Results grouped by
// kind with the total per kind; Enter opens the first result, Escape closes.
import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { countByKind, groupResults, search, type SearchEntry, type SearchResult } from '@/lib/modernization/search';

export default function SearchBox({ index, onPick }: { index: SearchEntry[]; onPick: (r: SearchResult) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const deferred = useDeferredValue(query);
  const rootRef = useRef<HTMLDivElement>(null);
  const results = useMemo(() => search(index, deferred), [index, deferred]);
  const groups = useMemo(() => groupResults(results), [results]);
  const counts = useMemo(() => (deferred.trim() ? countByKind(index, deferred) : {}), [index, deferred]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const pick = (r: SearchResult) => {
    onPick(r);
    setOpen(false);
  };

  return (
    <div ref={rootRef} data-testid="search-box" className="relative w-44 md:w-56 xl:w-72">
      <Search aria-hidden className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        data-testid="search-input"
        type="search"
        role="combobox"
        aria-expanded={open && query.trim().length > 0}
        aria-controls="search-results"
        aria-label="Buscar en el análisis"
        placeholder="Buscar componentes, tablas, problemas…"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
          if (e.key === 'Enter' && results[0]) pick(results[0]);
        }}
        className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-7 text-sm"
      />
      {query && (
        <button type="button" aria-label="Borrar búsqueda" onClick={() => { setQuery(''); setOpen(false); }} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-accent">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      {open && query.trim().length > 0 && (
        <div id="search-results" role="listbox" data-testid="search-results" className="absolute right-0 z-40 mt-1 max-h-[70vh] w-[28rem] max-w-[90vw] overflow-auto rounded-md border border-border bg-card p-1 shadow-lg">
          {groups.length === 0 && <p className="px-2 py-3 text-sm text-muted-foreground">Sin coincidencias para “{query.trim()}”.</p>}
          {groups.map((g) => (
            <div key={g.kind} data-testid="search-group" data-kind={g.kind}>
              <div className="flex items-center justify-between px-2 pb-0.5 pt-2 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                <span>{g.label}</span>
                <span className="tabular-nums">{counts[g.kind] ?? g.items.length}</span>
              </div>
              {g.items.map((r, i) => (
                <button
                  key={`${r.kind}:${r.title}:${i}`}
                  type="button"
                  role="option"
                  aria-selected={false}
                  data-testid="search-result"
                  onClick={() => pick(r)}
                  className="flex w-full flex-col items-start gap-0.5 rounded px-2 py-1.5 text-left hover:bg-accent"
                >
                  <span className="w-full truncate font-mono text-xs">{r.title}</span>
                  <span className="w-full truncate text-2xs text-muted-foreground">{r.subtitle}</span>
                </button>
              ))}
            </div>
          ))}
          {results.length >= 50 && <p className="px-2 py-1.5 text-2xs text-muted-foreground">Mostrando los primeros 50 resultados; afina la búsqueda.</p>}
        </div>
      )}
    </div>
  );
}
