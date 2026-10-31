# Implementation Plan: Experiencia de uso con proyectos grandes

**Branch**: `027-large-project-ux` | **Date**: 2026-10-31 | **Spec**: [spec.md](./spec.md)

## Summary
Web (Next.js/TS): `lib/modernization/search.ts` (índice y búsqueda puros), `components/search-box.tsx` (entrada en la barra superior, resultados agrupados, teclado), `component-graph.tsx` (zoom imperativo sobre `<g ref>`, capas memoizadas, umbral `HOVER_DIM_MAX_COMPONENTS = 300`), `component-details.tsx` (valores `break-all`, listas desplazables), `findings-step.tsx` (`selectedId`, `aria-current`, paginación `PAGE = 150` con `paginate()` puro), `software-architecture-analyzer.tsx` (buscador y navegación).

## Constitution Check
I–VII PASS: solo presentación; sin dependencias nuevas; determinismo del orden de resultados.

## Design
1. `search.ts`: `buildSearchIndex(view): SearchEntry[]`; `search(index, query, limit=50): SearchResult[]` con `normalize()` (minúsculas, sin acentos), coincidencia de todas las palabras en `haystack`, orden (prioridad de tipo, posición en el título, título); `groupResults()`.
2. `search-box.tsx`: estado local, `useDeferredValue`, lista con `role="listbox"`, Enter abre el primero, Escape cierra.
3. Grafo: `zoom.on('zoom', ev => g.setAttribute('transform', …))`; `EdgesLayer`/`NodesLayer` con `React.memo`; `focus` para atenuar = seleccionado siempre, hover solo si `components.length <= 300`; etiqueta del hover en una capa aparte.
4. Detalle: `componentAttributes` devuelve `list?: string[]`; render de listas en `<ul className="max-h-40 overflow-auto">`.
5. Hallazgos: `selectedId` en `FindingsStep`, `CompLink` con `aria-current`, `IssueRows` paginado.
6. Analizador: `TopBar` recibe `search`; `onPick` → `setStep`/`setSelected`.
7. Pruebas: `search.test.ts`, `paging.test.ts`, umbral del grafo; feature 027 con pasos puros (índice) y @e2e para el resaltado.
