---
description: "Task list for 012-install-doctor-docker"
---

# Tasks: Instalación guiada — doctor e imagen Docker / Compose

**Input**: Design documents from `specs/012-install-doctor-docker/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md, tests/features/ (hash LOCKED; escenarios TS-001 … TS-037)

**Tests**: TDD obligatorio (Constitución III): los pasos y pruebas unitarias se ejecutan en rojo antes de su implementación. Regla aditiva (usuario 2026-10-09): prohibido modificar `.feature`, `context.json`, specs, pasos o pruebas de 001–011.

**Dónde se trabaja**: `apps/dev-arch` (worktree `maestria-devarch-009`, rama `012-install-doctor-docker`); workflow en `.github/workflows/dev-arch.yml` (raíz del monorepo). Docker no está instalado localmente: la imagen se valida estáticamente y se construye en CI.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [x] T001 Añadir `specs/012-install-doctor-docker/tests/features/**/*.feature` a `cucumber.mjs` y `specs/012-*/tests/**` al filtro `acceptance` del workflow
- [x] T002 Pasos de 012 en `tests/acceptance/steps/install-doctor.steps.ts`, `install-health.steps.ts`, `install-container.steps.ts`, `install-guide.steps.ts` con aserciones reales; ejecutar: rojo [TS-001 … TS-037]

**Checkpoint**: Cucumber descubre los escenarios de 012; los no implementados fallan.

---

## Phase 2: US1/US2 — Doctor (P1)

- [x] T003 [US1] Pruebas unitarias `scripts/doctor/checks.test.mjs`, `doctor.test.mjs` (sistemas simulados darwin/linux/win32, cada requisito ausente, versiones límite, `--fix`, `--json`, modos, errores de uso) en rojo [TS-002 … TS-017]
- [x] T004 [US1] `scripts/doctor/requirements.mjs` (definición única + tabla Markdown) [TS-035]
- [x] T005 [US1] `scripts/doctor/checks.mjs` (verificaciones puras, estados, modos, consulta `--doctor` del motor) [TS-002 … TS-017]
- [x] T006 [US1] `scripts/doctor/system.mjs`, `format.mjs`, `doctor.mjs`, `cli.mjs` [TS-001, TS-009, TS-013, TS-018]
- [x] T007 [US1] `package.json` (`scripts.doctor`, `bin.dev-arch`), `Makefile` (`check-env` con `DOCTOR_ARGS`; `doctor` sin cambios), `scripts/test.sh` (subconjunto `doctor` en `all`) [TS-007, TS-008]

## Phase 3: US4 — Motor `--doctor` y salud (P2)

- [x] T008 [US4] `engine/src/test/java/com/extractor/EngineDoctorTest.java` en rojo (analizador encontrado / no encontrado, orden de claves, versión del esquema) [TS-021]
- [x] T009 [US4] `EngineDoctor.java`, rama `--doctor` en `MicroserviceInferenceMain`, `McpServerMain.serverVersion()` pública; Checkstyle sin aumento [TS-019, TS-020, TS-021]
- [x] T010 [US4] `web/src/server/health/health.test.ts` y `web/src/app/api/health/route.test.ts` en rojo [TS-022 … TS-025]
- [x] T011 [US4] `web/src/server/health/health.ts`, `web/src/app/api/health/route.ts`, `peekRuntime()` en `server/runtime.ts`; cobertura web ≥ 85 % [TS-022 … TS-026]

## Phase 4: US3 — Contenedor (P1)

- [x] T012 [US3] `web/next.config.ts`: `output: 'standalone'` y `outputFileTracingRoot` solo con `NEXT_OUTPUT=standalone` [TS-032]
- [x] T013 [US3] `docker/Dockerfile`, `docker/Dockerfile.dockerignore`, `docker/compose.yaml`, `docker/README.md` [TS-027, TS-028, TS-031]
- [x] T014 [US3] `docker/smoke-test.sh` [TS-030]
- [x] T015 [US3] Workflow: filtro `docker`, trabajo `docker` (build, up, smoke, logs/down, push GHCR en tags) [TS-029]

## Phase 5: US5 — Guía (P2)

- [x] T016 [US5] `docs/INSTALL.md` (rutas local y Docker, tabla generada entre marcadores, limitación .NET sin SDK en la imagen) [TS-033, TS-034]

## Phase 6: Polish & guards

- [ ] T017 Guardas: Checkstyle (≤ 4589), SpotBugs 0, `dotnet format`, typecheck/lint web, artefactos bloqueados intactos [TS-036, TS-037]
- [ ] T018 `make test` completo verde y escenarios @slow de 012 con `DEVARCH_E2E=true`
- [ ] T019 Clon limpio de la rama: `make build && make test && make test-e2e-browser` + muestra de `npm run doctor`; borrar el clon

## Dependencies

T001–T002 → resto. T004 → T005 → T006 → T007. T008 → T009. T006 + T009 → T010 → T011. T012 → T013 → T014 → T015. T004 → T016. T017–T019 al final.
