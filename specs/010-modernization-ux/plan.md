# Implementation Plan: Experiencia de modernización en dev-arch

**Branch**: `010-modernization-ux` | **Date**: 2026-10-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/010-modernization-ux/spec.md`

## Summary

La web (`apps/dev-arch/web`, Next.js 15) se reorganiza alrededor de un flujo de modernización de cinco pasos (Resumen → Mapa del sistema → Propuestas → Hallazgos → Plan). Un **perfil tecnológico** calculado a partir de `meta.source` y de las extensiones de archivo (Java / .NET · C# / VB.NET / mixto) gobierna un **registro declarativo de secciones**: cada sección declara sus tecnologías y solo se muestra si aplica y tiene elementos; las vacías se resumen en una línea "Sin hallazgos". El mapa d3 se reescribe con un modelo puro (tipos y pesos de dependencias, agrupación por capa/propuesta, severidad). El panel "Parámetros de inferencia" llama a `reinfer_architecture` y `score_proposal` del motor a través del cliente MCP de 007 (nuevas rutas API), validando con los tipos/zod generados; los tres esquemas de 008 se generan en un módulo de extensión separado del paquete del contrato (`schema/extensions/`, registro `extensionValidatorsByKind`; decisión del usuario 2026-10-09, opción B — 005 intacto). Historial y comparación usan el almacén de trabajos del servidor (`GET /api/analyses`). Exportación JSON/Markdown/PDF (vista imprimible) desde un modelo de plan determinista. Documentación IA con plantillas por tecnología y abstracción `LLM_PROVIDER=gemini|anthropic`. Aspecto: herramienta técnica sobria con tokens de color claro/oscuro, IBM Plex, acentos por tecnología e insignias de severidad. **El motor no cambia.**

## Technical Context

**Language/Version**: TypeScript 5 / React 18 / Next.js 15.3.8 (web); Node ≥ 20 (generador del contrato)
**Primary Dependencies**: existentes (shadcn/Radix, Tailwind 3, d3 7, Genkit 1.20 + Google GenAI, `@modelcontextprotocol/sdk` 1.32.1, zod 3, `@static-inference/schema`); **nueva**: `@anthropic-ai/sdk` (solo usada cuando `LLM_PROVIDER=anthropic`, research D10). 0 dependencias nuevas en el motor
**Storage**: almacén de trabajos de 007 en disco (`ARCHVIEW_DATA_DIR/jobs`); navegador: `devarch.activeJobId`, `devarch.theme`
**Testing**: `node:test` + tsx (web), Cucumber-JS 11 (aceptación, `specs/010…/tests/features`), Playwright 1.64 (`@e2e`), pasos Java de 005 (Cucumber-JVM) de 005 sin cambios
**Target Platform**: navegadores modernos (Chromium para e2e), servidor Node en macOS/Linux
**Project Type**: web app dentro del producto `apps/dev-arch` (monorepo)
**Performance Goals**: recálculo de propuestas < 3 s en los proyectos de ejemplo (SC-004); mapa usable con ≥ 300 componentes
**Constraints**: escenarios bloqueados de 001–009 intactos, sin excepciones (opción B, 2026-10-09); `data-testid` de 007 preservados (contracts/ui-sections.md); el navegador nunca guarda resultados (007 FR-007/TS-015); sin rutas absolutas en respuestas; errores de `tsc --noEmit` en archivos de producción de la web: 0 nuevos (todos los errores de la línea base están en `*.test.ts` y en los módulos generados `schema/generated/` y `schema/extensions/`, TS5097 por las importaciones `.ts`)
**Scale/Scope**: 10 historias, 44 FR, 7 SC; ~12 módulos puros nuevos, ~15 componentes React nuevos/reescritos, 4 rutas API nuevas, 1 cambio de generador del contrato

## Constitution Check

```
CONSTITUTION GATE ACTIVE — CONSTITUTION.md v1.0.0
```

| Principio / regla | Evaluación | Estado |
|---|---|---|
| I. Compatibilidad / contrato público | El motor y el contrato 1.0.0 no cambian; los tipos generados solo añaden tres entradas (aditivo). La API web de 007 se conserva; las rutas nuevas son aditivas | PASS |
| II. Lógica de análisis en el núcleo | La web no calcula viabilidad, clústeres ni métricas: re-inferencia y puntuación se delegan al motor. Perfil tecnológico, registro de secciones, re-etiquetado de capas, filtros del mapa, orden del plan y comparación son presentación sobre datos del motor | PASS |
| III. TDD; aserciones intocables | testify antes de tasks; cada módulo con prueba roja previa; ningún escenario bloqueado de 001–009 modificado (opción B: módulo de extensión generado en lugar de re-testify de 005 TS-028) | PASS |
| IV. Determinismo | Salidas del motor intactas; re-inferencia determinista (008); Markdown determinista (FR-035) | PASS |
| V. Degradación y errores claros | Errores del motor con su mensaje (422/502); herramientas deshabilitadas → panel desactivado con causa; fidelidad reducida advertida | PASS |
| VI. Huella mínima | PDF sin dependencias (impresión del navegador); única dependencia nueva `@anthropic-ai/sdk`, justificada por FR-040 (decisión del usuario) y solo en la web | PASS (justificado) |
| Quality: pruebas | Pruebas unitarias de cada módulo puro y ruta nueva; e2e de los tres lenguajes; respuestas MCP validadas con zod generado | PASS |
| Workflow: breaking schema ⇒ bump | Sin cambio de esquema | PASS |
| Governance | Sin enmiendas | PASS |

**Post-design re-check**: PASS.

## Architecture

```text
 Browser (React, 5 steps)                                   Next.js server (Node)
 ┌───────────────────────────────┐   fetch /api/*   ┌──────────────────────────────────────┐
 │ AppShell: top bar, step rail  │ ───────────────► │ /api/analyses (POST 007, GET list)   │
 │  Summary · Map(d3) · Proposals│                  │ /api/analyses/{id}/{doc} (007)       │
 │  Findings · Plan · History    │                  │ /api/analyses/{id}/reinfer   (new)   │
 │ lib/modernization (pure):     │                  │ /api/analyses/{id}/score     (new)   │
 │  technology, sections, layers,│                  │ /api/inference/defaults      (new)   │
 │  graph-model, findings, plan, │                  │ JobStore (disk) · EngineClient (MCP) │
 │  markdown, compare, inference │                  └──────────────┬───────────────────────┘
 └───────────────────────────────┘                                 │ stdio MCP (long-lived)
           │ server action                                         ▼
           ▼                                          Engine JAR --mcp (unchanged):
 AI docs: prompts per technology ── LlmProvider ──►    analyze_project, reinfer_architecture,
   gemini (Genkit, default) | anthropic (SDK)          score_proposal, resources
```

## Project Structure

```text
schema/gen/lib.mjs                         # + EXTENSION_ENTRIES (inference-config, mcp/reinfer_architecture, mcp/score_proposal); ENTRIES unchanged
schema/gen/generate.mjs                    # + generateExtensions (same pipeline, own registry); generate() unchanged
schema/gen/check.mjs                       # drift check of extensions/ too; validates with both registries
schema/extensions/{types,validators,index}.ts  # GENERATED extension module (extensionValidatorsByKind, parse*)
schema/test/extensions.test.ts             # extension module tests (010)
schema/package.json                        # exports "." and "./extensions"
schema/generated/*                         # unchanged (005, byte-identical)
web/src/lib/modernization/
  technology.ts layers.ts severity.ts sections.ts graph-model.ts findings.ts summary.ts
  inference.ts plan.ts markdown.ts compare.ts  (+ *.test.ts)
web/src/lib/analyses-client.ts             # + listAnalyses, getContracts, reinfer, score, getInferenceDefaults
web/src/lib/types.ts                       # removed (generated types only)
web/src/server/engine/engine-client.ts     # + callTool, readResource
web/src/server/inference/inference-service.ts (+ test)   # params from schema, error mapping
web/src/server/jobs/history.ts (+ test)    # history entries + technology cache
web/src/app/api/analyses/route.ts          # + GET
web/src/app/api/analyses/[id]/reinfer/route.ts, [id]/score/route.ts, app/api/inference/defaults/route.ts
web/src/components/
  app-shell.tsx landing.tsx run-progress.tsx theme-toggle.tsx badges.tsx section.tsx
  steps/summary-step.tsx steps/map-step.tsx steps/proposals-step.tsx steps/findings-step.tsx steps/plan-step.tsx
  inference-panel.tsx proposal-card.tsx component-details.tsx history-panel.tsx comparison-view.tsx print-report.tsx
  component-graph.tsx (rewritten) software-architecture-analyzer.tsx (state container)
web/src/ai/llm/{provider,generate}.ts, web/src/ai/prompts/{java-spring-jee,aspnet-core,vb-desktop,index}.ts
web/src/app/{layout.tsx,globals.css}, web/tailwind.config.ts   # tokens, fonts, dark mode
tests/acceptance/steps/modernization-*.steps.ts, tests/acceptance/support/fake-mcp-server.mjs (+tools)
tests/acceptance/fixtures/vb-synthetic/    # engine output of the VB synthetic desktop project (versioned)
cucumber.mjs                               # + specs/010 path
specs/010-modernization-ux/screenshots/    # Playwright captures
```

## Design system (frontend-design)

- **Concepto**: consola de inspección de un sistema legacy. El recorrido es una secuencia real, por eso el rail lateral numera los pasos 1–5 con su recuento. El único elemento "audaz": una franja de 3 px con el color de acento de la tecnología bajo la barra superior, repetida en la insignia; todo lo demás es sobrio.
- **Color (claro)**: fondo `#F4F6F9`, superficie `#FFFFFF`, tinta `#172033`, tinta secundaria `#556076`, línea `#DCE1E8`, primario `#2B59C3`. **Oscuro**: fondo `#141821`, superficie `#1B202B`, tinta `#E4E8EF`, secundaria `#9AA4B6`, línea `#2C3341`, primario `#7B9BF0`.
- **Acentos de tecnología**: Java `#B4532A` (cobre), .NET C# `#7246D8` (violeta), VB.NET `#0E7C86` (verde azulado).
- **Severidad** (insignia con texto): Crítica `#C62828`, Error `#D9622B`, Advertencia `#B7791F`, Info `#5B6B82`; fondos tintados y texto con contraste AA en ambos modos.
- **Tipografía**: IBM Plex Sans 400/500/600 (base 14 px, escala 12/13/14/16/20/26), IBM Plex Mono para identificadores de componentes, rutas y endpoints (información, no decoración). Sentence case; sin mayúsculas sostenidas.
- **Layout**: barra superior 52 px (producto, proyecto, insignia, id de análisis, estado, Historial, Nuevo análisis, tema) · rail 216 px (pasos) · contenido alineado a la izquierda, ancho máx. 1320 px; paneles con borde de 1 px y radio 6 px, tablas densas. En móvil el rail pasa a una barra de pasos horizontal desplazable.
- **Movimiento**: solo en respuesta a acciones (expandir, recalcular); `prefers-reduced-motion` respetado.
- **Revisión contra el brief**: el brief fija "Linear/Grafana sobrio"; se evitan los defaults genéricos (tarjetas idénticas con sombra, eyebrows en mayúsculas, gradientes); la distinción viene del acento por tecnología y del rail secuencial con recuentos.

## Testing Strategy

1. **Unit (node:test)**: cada módulo de `lib/modernization`, `server/inference`, `server/jobs/history`, `ai/llm`, `ai/prompts`, rutas nuevas con runtime inyectado (patrón de `analyze-route.test.ts`).
2. **Acceptance (Cucumber-JS, rápidos)**: escenarios de `specs/010…/tests/features` sin navegador: perfiles y secciones sobre las fixtures del contrato y la salida VB sintética, plan/Markdown, comparación, proveedor LLM y plantillas, API con el motor simulado ampliado.
3. **E2E (`@e2e @slow`, Playwright, motor real)**: Java, C# y VB de punta a punta; sin secciones Java en .NET; sin secciones vacías; mapa; re-inferencia y re-puntuación; contratos; exportación; historial y comparación; tema.
4. **Contrato**: 005 TS-028…TS-033 sin cambios; el módulo de extensión se prueba en `schema/test/extensions.test.ts` y en 010 TS-051.
5. **Capturas**: script Playwright (tarea final) → `specs/010-modernization-ux/screenshots/`.

## Complexity Tracking

| Item | Justificación |
|---|---|
| `@anthropic-ai/sdk` | Decisión del usuario (proveedor Anthropic opcional); SDK oficial en lugar de re-implementar el protocolo |
| Módulo generado de extensión (`schema/extensions/`) | Decisión del usuario 2026-10-09 (opción B): cubrir los esquemas de 008 sin modificar artefactos bloqueados de 005 |
