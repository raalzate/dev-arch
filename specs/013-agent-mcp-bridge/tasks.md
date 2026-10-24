# Tasks: 013-agent-mcp-bridge

**Input**: spec.md, plan.md, research.md, data-model.md, contracts/, tests/features/ (TS-001..TS-034, hash bloqueado)
**TDD**: obligatorio (Constitución III): cada prueba en rojo antes de su implementación.

## Phase 1: Setup

- [ ] T001 Añadir `specs/013-agent-mcp-bridge/tests/features/**/*.feature` a `cucumber.mjs`
- [ ] T002 Soporte de aceptación: servidor HTTP en proceso sobre las rutas de la web (para el puente), cliente MCP HTTP y arranque del puente en `tests/acceptance/support/agent-mcp.ts`

## Phase 2: US2 — consulta por partes (P1) 🎯

- [ ] T003 [US2] Pruebas unitarias en rojo `web/src/server/agent-mcp/views.test.ts` (resumen, propuestas, hallazgos, plan iguales a `lib/modernization`; determinismo) [TS-011..TS-014, TS-018]
- [ ] T004 [US2] `web/src/server/agent-mcp/views.ts`, `errors.ts`, `links.ts`
- [ ] T005 [US2] Pruebas en rojo `web/src/server/agent-mcp/tools.test.ts` y `web/src/app/api/mcp/route.test.ts` (lista de herramientas, errores, documentos, historial, token) [TS-010, TS-015..TS-017, TS-022, TS-024]
- [ ] T006 [US2] `web/src/server/agent-mcp/tools.ts`, `server.ts`, `web/src/app/api/mcp/route.ts`
- [ ] T007 [US2] Pasos `tests/acceptance/steps/agent-mcp-query.steps.ts` [TS-010..TS-018]

## Phase 3: US1 — envío desde el agente (P1)

- [ ] T008 [US1] Pruebas en rojo `web/src/server/agent-mcp/bridge.test.ts` (empaquetado, exclusiones, enlaces simbólicos, ZIP determinista, proxy, `UNREACHABLE`, `--version`) [TS-002..TS-004, TS-025, TS-028]
- [ ] T009 [US1] `web/public/dev-arch-mcp.mjs` (puente sin dependencias)
- [ ] T010 [US1] `analyze_project` y `get_analysis` con espera en `tools.ts` [TS-001, TS-005..TS-008]
- [ ] T011 [US1] Pasos `tests/acceptance/steps/agent-mcp-submit.steps.ts` [TS-001..TS-009]

## Phase 4: US3 — re-inferencia (P2)

- [ ] T012 [US3] Pruebas en rojo y `get_inference_parameters`, `reinfer_proposals` [TS-019..TS-021]
- [ ] T013 [US3] Pasos `tests/acceptance/steps/agent-mcp-reinfer.steps.ts`

## Phase 5: US4 — conexión (P2)

- [ ] T014 [US4] Prueba en rojo + campo `agentMcp` en `web/src/server/health/health.ts` [TS-026]
- [ ] T015 [US4] `docs/AGENTS-MCP.md` + enlace en `docs/INSTALL.md` [TS-027]
- [ ] T016 [US4] Pasos `tests/acceptance/steps/agent-mcp-connect.steps.ts` [TS-022..TS-028]

## Phase 6: US5 — identidad visual (P3)

- [ ] T017 [US5] `web/src/components/brand-mark.tsx`, `web/src/app/icon.svg`, quitar `favicon.ico`, espacio superior en `app-shell.tsx` [TS-029..TS-031]
- [ ] T018 [US5] `?analysis=<id>` en `software-architecture-analyzer.tsx` [TS-032]
- [ ] T019 [US5] Pasos `tests/acceptance/steps/brand.steps.ts` (estáticos + navegador)

## Phase 7: Polish & guards

- [ ] T020 Pasos de guardas [TS-033, TS-034]
- [ ] T021 `make test` completo verde, `@slow` con `DEVARCH_E2E=true`, `make test-e2e-browser`
- [ ] T022 Prueba manual con Claude Code real contra el contenedor (registro con la guía)

## Dependencies

T001–T002 → resto. T003 → T004 → T005 → T006 → T007. T006 → T008 → T009 → T010 → T011. T006 → T012 → T013.
T006 → T014. T009 → T015 → T016. T017 → T018 → T019. T020–T022 al final.
