---
description: "Task list for 010-modernization-ux"
---

# Tasks: Experiencia de modernización en dev-arch

**Input**: Design documents from `specs/010-modernization-ux/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md, tests/features/ (hash LOCKED; escenarios TS-001 … TS-053) (005 intacto: opción B, 2026-10-09)

**Tests**: TDD obligatorio (Constitución III). Cada tarea de pruebas / step definitions se ejecuta y falla (rojo) antes de su implementación. Prohibido modificar `.feature`, `context.json` o aserciones existentes.

**Dónde se trabaja**: raíz del producto `apps/dev-arch` (worktree `maestria-devarch-009`, rama `010-modernization-ux`). Runner de aceptación: Cucumber-JS (`cucumber.mjs`); e2e: Playwright (`make test-e2e-browser`); unitarias: `npm test -w web`.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [x] T001 Añadir `specs/010-modernization-ux/tests/features/**/*.feature` a `cucumber.mjs`; crear la fixture `tests/acceptance/fixtures/vb-synthetic/{output,output_architecture,output_entrypoints}.json` con el motor real sobre `Fixtures/VbLegacy/SyntheticDesktop` (rutas de archivo relativas) [TS-001, TS-003, TS-005, TS-006]
- [x] T002 Crear los steps de todos los escenarios rápidos de 010 en `tests/acceptance/steps/modernization-*.steps.ts` (perfil, secciones, mapa, hallazgos, plan, comparación, IA, tipos, API con motor simulado) con aserciones reales; ejecutar: rojo [TS-001 … TS-007, TS-016 … TS-021, TS-023 … TS-028, TS-033, TS-034, TS-037 … TS-039, TS-041 … TS-044, TS-046 … TS-053]
- [x] T003 Crear los steps `@e2e` de 010 en `tests/acceptance/steps/modernization-browser.steps.ts` (VB ZIP desde archivos versionados del fixture, visitar pasos, secciones, mapa, inferencia, exportaciones, historial, tema); ejecutar en seco (`--dry-run`): sin pasos indefinidos [TS-008 … TS-015, TS-022, TS-029 … TS-032, TS-035, TS-036, TS-040, TS-045]

**Checkpoint**: Cucumber descubre los 53 escenarios de 010; los rápidos fallan en rojo.

---

## Phase 2: Foundational — tipos generados (US10)

- [x] T004 [US10] ~~Actualizar pasos de 005 TS-028~~ (revertido, opción B 2026-10-09: 005 intacto). Pasos de 010 TS-051 contra el módulo de extensión (`schema/extensions/`, `extensionValidatorsByKind`) y `schema/test/extensions.test.ts`; ejecutar: rojo [TS-051]
- [x] T005 [US10] `EXTENSION_ENTRIES` (`inference-config`, `mcp/reinfer_architecture`, `mcp/score_proposal`) en `schema/gen/lib.mjs` + `generateExtensions` → `schema/extensions/*` (registro propio); `ENTRIES` y `schema/generated/*` sin cambios; deriva de `extensions/` en `check`; web importa de `@static-inference/schema/extensions`; `npm --prefix schema run generate`; `make schema-check`; verde [TS-051]
- [x] T006 [US10] Sustituir `web/src/lib/types.ts` por tipos de `@static-inference/schema` en toda la web; prueba que recorre `web/src` sin declaraciones de tipos del contrato [TS-052]

**Checkpoint**: 005 completo en verde; la web compila con tipos generados.

---

## Phase 3: US1 — Coherencia tecnológica (P1) MVP

- [x] T007 [P] [US1] Pruebas unitarias `web/src/lib/modernization/technology.test.ts`, `layers.test.ts`, `sections.test.ts` (rojo) [TS-001 … TS-007]
- [x] T008 [US1] Implementar `technology.ts`, `layers.ts`, `severity.ts`, `sections.ts` (catálogo de contracts/ui-sections.md); verde [TS-001 … TS-007, TS-016]

## Phase 4: US2 + US3 — Recorrido y aspecto (P1)

- [x] T009 [US3] Tokens de diseño (`globals.css`, `tailwind.config.ts`), IBM Plex, script de tema sin parpadeo en `layout.tsx`, `theme-toggle.tsx`, `badges.tsx` (TechBadge, SeverityBadge), `section.tsx` (Section + NoFindings) [TS-014, TS-015, TS-016]
- [x] T010 [US2] `app-shell.tsx` (barra superior, rail de pasos accesible, franja de acento), `landing.tsx` (subida/importación/historial reciente; ganchos de 007), `run-progress.tsx` (fases, tiempo transcurrido) [TS-011, TS-013]
- [x] T011 [US2] Pruebas + `lib/modernization/summary.ts` (tamaño, salud, candidatas top-3, riesgo top-8) y `steps/summary-step.tsx` (proposal-card, component-node, warnings, fidelidad reducida) [TS-012, TS-009]
- [x] T012 [US2] Reescribir `software-architecture-analyzer.tsx` como contenedor de estado (análisis activo, documentos, contratos, escenario de inferencia, ediciones, paso activo); preservar todos los ganchos de 007 [TS-008 … TS-015]

**Checkpoint**: e2e de 007 + TS-008 … TS-015 verdes.

## Phase 5: US4 — Mapa del sistema (P2)

- [x] T013 [P] [US4] Pruebas + `lib/modernization/graph-model.ts` [TS-017 … TS-021]
- [x] T014 [US4] Reescribir `component-graph.tsx` (d3: color por tipo, grosor por peso, agrupación, severidad, leyenda conmutable, tabla alternativa) y `steps/map-step.tsx` [TS-022]

## Phase 6: US5 — Parámetros de inferencia (P2)

- [x] T015 [US5] Pruebas + `EngineClient.callTool/readResource`; ampliar `tests/acceptance/support/fake-mcp-server.mjs` (reinfer, score, recurso de defaults, controles de error/violación) [TS-023 … TS-027, TS-053]
- [x] T016 [US5] Pruebas + `server/inference/inference-service.ts` y rutas `GET /api/inference/defaults`, `POST /api/analyses/{id}/reinfer`, `POST /api/analyses/{id}/score` (token, errores, validación zod) [TS-023 … TS-027, TS-042, TS-053]
- [x] T017 [US5] Pruebas + `lib/modernization/inference.ts` (toInferenceConfig, clamp) y cliente (`analyses-client.ts`) [TS-028]
- [x] T018 [US5] `inference-panel.tsx` (sliders, viabilidad mínima, restablecer, estado, último cambio gana) + `steps/proposals-step.tsx` + `proposal-card.tsx` (mover componente, re-puntuar, detalle con entrypoint/señales/tablas) [TS-029 … TS-032, TS-036]

## Phase 7: US6 — Hallazgos (P2)

- [x] T019 [P] [US6] Pruebas + `lib/modernization/findings.ts` (agrupación/filtro de issues) [TS-033, TS-034]
- [x] T020 [US6] `steps/findings-step.tsx` (inventario por tecnología, pestañas con contenido, contratos, secretos, puntos de entrada) y `component-details.tsx` (atributos con valor, llamadas entrantes, dominio, capa por tecnología) [TS-035, TS-036]

## Phase 8: US7 — Plan y exportación (P2)

- [x] T021 [P] [US7] Pruebas + `lib/modernization/plan.ts`, `markdown.ts` (determinista), exportación JSON [TS-037 … TS-039]
- [x] T022 [US7] `steps/plan-step.tsx`, `print-report.tsx` + estilos `@media print`, botones de exportación [TS-040]

## Phase 9: US8 — Historial y comparación (P2)

- [x] T023 [US8] Pruebas + `server/jobs/history.ts` y `GET /api/analyses` (orden, tecnología cacheada, sin rutas) [TS-041, TS-042]
- [x] T024 [P] [US8] Pruebas + `lib/modernization/compare.ts` (totales, deltas, exclusivos, `isComparable`) [TS-043, TS-044]
- [x] T025 [US8] `history-panel.tsx` (abrir, seleccionar dos, comparar) y `comparison-view.tsx` [TS-045]

## Phase 10: US9 — IA por tecnología (P3)

- [x] T026 [US9] Pruebas + `ai/llm/provider.ts`, `ai/prompts/*` (plantillas Spring/JEE, ASP.NET Core, VB desktop; selección por perfil) [TS-046 … TS-050]
- [x] T027 [US9] Adaptadores Gemini (Genkit) y Anthropic (`@anthropic-ai/sdk`, modelo por defecto según skill `claude-api`), `generate-architecture-documentation.ts` usando plantilla + proveedor; panel IA en el paso Plan [TS-046 … TS-050]

## Phase 11: Polish & gates

- [ ] T028 `npm test -w web`, `npx tsc --noEmit` (0 errores nuevos en producción), `make test` completo verde
- [x] T029 `make test-e2e-browser` (007 + 010) verde
- [x] T030 Capturas Playwright de cada paso (Java y .NET C#, claro/oscuro) en `specs/010-modernization-ux/screenshots/`; README breve de la web (sección UX); CHANGELOG
- [ ] T031 Clon limpio: `make build && make test` + `make test-e2e-browser`; borrar el clon

## Dependencies

- Phase 1 → Phase 2 → Phase 3 → Phase 4 → (Phases 5–10 en cualquier orden; 6 antes de 8 para la exportación con parámetros) → Phase 11.
- [P] = archivos independientes, paralelizable.
