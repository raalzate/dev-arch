# Tasks: 014-standalone-repo

**Input**: spec.md, plan.md, tests/features (TS-001..TS-010, hash bloqueado); re-testify aprobado (2026-10-23).

## Phase 1: Repositorio

- [x] T001 Extraer `apps/dev-arch` con historia (`git subtree split`) y publicar `raalzate/dev-arch` (público) [FR-001]
- [ ] T002 Recrear la etiqueta `dev-arch-006-baseline` en el commit equivalente y publicarla [TS-002]
- [x] T003 Re-testify de los escenarios atados al monorepo (006, 007, 011, 012, 013) [FR-005]

## Phase 2: Producto en la raíz

- [ ] T004 `tests/acceptance/support/layout.ts`: raíz del repositorio = raíz del producto; entradas permitidas `README.md`, `LICENSE`, `.github`
- [ ] T005 Pasos con rutas o commits del monorepo (006, 007, 010, 011, 012, 013) y guardas acotadas a su rango [TS-010]
- [ ] T006 `engine/pom.xml` y `ProductLayout*.java`: workflow en `.github/workflows/dev-arch.yml` del repositorio
- [ ] T007 `.github/workflows/dev-arch.yml` en la raíz (filtros y `working-directory` sin `apps/dev-arch`) [TS-004]
- [ ] T008 Comentarios, scripts y docs sin `apps/dev-arch` (Makefile, docker, scripts, web) [TS-001]
- [ ] T009 Pasos de 014 `tests/acceptance/steps/standalone-repo.steps.ts` [TS-001..TS-010]

## Phase 3: Documentación (US5)

- [ ] T010 Capturas reales (Playwright, motor real) en `docs/images/` [TS-006]
- [ ] T011 `README.md` (tesis, capturas, inicio rápido), `docs/ARCHITECTURE.md`, `docs/CONTINUOUS-MODERNIZATION.md` [TS-005, TS-007, TS-008]

## Phase 4: Cierre

- [ ] T012 `make build && make test`, `@slow`, `make test-e2e-browser` en clon limpio del repositorio
- [ ] T013 Push de la rama y PR a `main`
