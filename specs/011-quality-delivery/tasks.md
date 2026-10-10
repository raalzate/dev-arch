---
description: "Task list for 011-quality-delivery"
---

# Tasks: Calidad, CI/CD y entrega de dev-arch

**Input**: Design documents from `specs/011-quality-delivery/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md, tests/features/ (hash LOCKED; escenarios TS-001 … TS-034)

**Tests**: TDD obligatorio (Constitución III). Cada tarea de pasos se ejecuta en rojo antes de su implementación. Regla aditiva (usuario 2026-10-09): prohibido modificar `.feature`, `context.json`, specs, pasos o pruebas de 001–010; solo archivos de pruebas nuevos.

**Dónde se trabaja**: `apps/dev-arch` (worktree `maestria-devarch-009`, rama `011-quality-delivery`); workflow en la raíz del monorepo `.github/workflows/dev-arch.yml`.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [x] T001 Añadir `specs/011-quality-delivery/tests/features/**/*.feature` a `cucumber.mjs` y el filtro `acceptance` del workflow (`specs/011-*/tests/**`)
- [x] T002 Crear los pasos de 011 en `tests/acceptance/steps/quality-*.steps.ts` (tipos/lint, runners heredados, cobertura, release, observabilidad, frescura, guardas) con aserciones reales; ejecutar: rojo [TS-001 … TS-034]

**Checkpoint**: Cucumber descubre los 34 escenarios de 011 (TS-020 y TS-017/TS-030 con ejemplos); los no implementados fallan.

---

## Phase 2: US1 — Tipos y lint bloqueantes (P1)

- [x] T003 [US1] `web/src/server/env.ts` (`Env`) y firmas de producción que aceptan `Env` (config, engine-locator, engine-path, bind-warning, llm/provider); `allowImportingTsExtensions` en `web/tsconfig.json`; `tsc --noEmit` = 0 [TS-002, TS-004]
- [x] T004 [US1] ESLint 9 + `eslint-config-next` + `@eslint/eslintrc` (devDeps web), `web/eslint.config.mjs` (`next/core-web-vitals`); corregir violaciones en producción; `next lint` = 0 [TS-003]
- [x] T005 [US1] Quitar `ignoreBuildErrors`/`ignoreDuringBuilds` de `web/next.config.ts`; `npm run build -w web` verde [TS-001]
- [x] T006 [US1] `scripts/test.sh web`: `npm run typecheck -w web`, `npm run lint -w web`, `npm test -w web` (sin `npx`, 006 TS-010); workflow web: pasos typecheck y lint bloqueantes [TS-005]

## Phase 3: US2 — Escenarios heredados 001–003 (P1)

- [x] T007 [US2] `engine/src/test/java/com/extractor/legacybdd/LegacySupport.java` (analizador, CLI, MCP en proceso, `legacybdd.analyzer=absent`) y runners `Run…FeaturesTest` (001, 002, 003) con glue propio e informes `legacy-00X.json` [TS-006]
- [x] T008 [P] [US2] Pasos 001 (`legacybdd/mcp`): analyze-project, cli-backward-compatibility, error-handling, granular-tools, installation-setup [TS-007, TS-008]
- [x] T009 [P] [US2] Pasos 002 (`legacybdd/dotnet`): 6 features + bugfix BUG-001…006 [TS-007, TS-008, TS-009]
- [x] T010 [P] [US2] Pasos 003 (`legacybdd/codeissues`): bug-pattern-detection, graceful-degradation, schema-and-pipeline [TS-007, TS-008, TS-009]
- [~] T011 [US2] Corregir en producción los defectos del motor que revelen los escenarios heredados (o detener y reportar si contradicen decisiones posteriores); `mvn verify` verde
- [x] T012 [US2] Workflow `engine-java`: setup-dotnet 8 + `bash scripts/engine-build.sh --dotnet-only` antes de `mvn verify` [TS-010]

## Phase 4: US3/US4 — Cobertura y pruebas unitarias web (P1/P2)

- [x] T013 [US3] `jacoco-maven-plugin` 0.8.12 en `engine/pom.xml` (prepare-agent + report en verify) [TS-011]
- [x] T014 [US3] `coverlet.collector` en el proyecto de pruebas .NET; `scripts/test.sh engine` con `--collect "XPlat Code Coverage" --results-directory engine/target/coverage/dotnet` [TS-012]
- [x] T015 [US3] `web/scripts/run-tests.mjs` (lista explícita para Node 20, `--coverage`: lcov + `summary.json`, módulos objetivo, umbral 85 %); scripts `test`/`coverage` de la web [TS-013, TS-014]
- [x] T016 [US3] `scripts/coverage.sh` (`run` y `summary`) y `make coverage` [TS-015, TS-016]
- [x] T017 [US3] Workflow: artefactos `engine-java-coverage`, `engine-dotnet-coverage`, `web-coverage` y resumen en `$GITHUB_STEP_SUMMARY` [TS-017]
- [x] T018 [P] [US4] Pruebas unitarias de cada ruta API (`web/src/app/api/**/route.test.ts` nuevas) con éxito y error [TS-013, TS-018]
- [x] T019 [P] [US4] Pruebas del cliente del motor (arranque, éxito, error de herramienta, caída, tiempo agotado) y utilidades (`lib/utils`, `lib/analyses-client`, `server/http`, `server/runtime`, `inference/routes`) [TS-013, TS-019]

## Phase 5: US5 — Release unificada (P2)

- [x] T020 [US5] `scripts/release-check.sh` [TS-020]
- [x] T021 [US5] Workflow: `release-version-check` (tags), `release.needs` += check, `release-skills` (zip + sha256 a la misma release) [TS-021, TS-022]

## Phase 6: US6 — Observabilidad (P2)

- [x] T022 [US6] Pruebas unitarias `web/src/server/jobs/job-events.test.ts` (rojo) [TS-023 … TS-029]
- [x] T023 [US6] `job-events.ts` (`JobEventLog`, métricas), integración en `JobRunner` (reloj y escritor inyectables en `JobRuntimeDeps`), `Job.metrics`, `publicJob.metrics`, línea de consola [TS-023 … TS-029]

## Phase 7: US7 — Analizador obsoleto (P2)

- [x] T024 [US7] `scripts/dotnet-analyzer-freshness.sh`; sello `.published` en `engine-build.sh` y `schema-check.sh`; `test.sh engine` y `schema-check.sh` usan la decisión y la anuncian [TS-030, TS-031]

## Phase 8: Polish & guards

- [x] T025 Registrar la investigación de BUG-007 en `research.md` (D8) [TS-034]
- [ ] T026 Verificar guardas: Checkstyle (conteo ≤ línea base), SpotBugs 0, `dotnet format`, artefactos bloqueados intactos [TS-032, TS-033]
- [ ] T027 `make test` completo verde (incluye escenarios 006/007/010/011 y runners heredados)
- [ ] T028 Clon limpio de la rama: `make build && make test && make test-e2e-browser`; borrar el clon

## Dependencies

T001–T002 → resto. US1 (T003–T006) antes de T018/T019 (las pruebas nuevas deben tipar). T007 → T008–T010 → T011. T015 → T016–T017. T022 → T023. T026–T028 al final.

## Status (2026-10-10)

- T011 partial: three production defects fixed (001 TS-022, 002 TS-051, 003 TS-025); four locked scenarios
  (001 TS-003, 002 TS-014, 003 TS-001, TS-018) contradict later locked decisions — **BLOCKER, STOP** (analysis.md).
  They are excluded by tag in the runners; 011 TS-007/TS-008 stay red until the user decides.
- T026 done locally (Checkstyle 4589 = before, SpotBugs 0, `dotnet format` clean). T027/T028 not closed (blocked).
