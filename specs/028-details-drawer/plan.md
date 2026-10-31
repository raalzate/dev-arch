# Implementation Plan: Detalle en panel lateral

**Branch**: `028-details-drawer` | **Date**: 2026-10-31 | **Spec**: [spec.md](./spec.md)

## Summary
Web: `lib/modernization/drawer-history.ts` (puro), `components/details-drawer.tsx` (aside fijo, Escape, Atrás, "Ver en el mapa"), `component-details.tsx` con secciones `<details>` plegables y prop `onShowInMap`, analizador monta el drawer y aplica `lg:pr-[540px]` al contenido cuando hay selección; `MapStep`/`FindingsStep` sin columna lateral.

## Constitution Check
I–VII PASS (solo presentación).
