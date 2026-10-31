---
description: "Task list for 023-legacy-desktop-inference"
---
# Tasks: Inferencia para el perfil desktop legacy
**Prerequisites**: spec, plan, research, data-model, contracts, quickstart, tests/features (hash LOCKED; TS-001..TS-014). TDD; `.feature` intocables.
## Phase 1: Setup
- [x] T001 Runner Cucumber `legacyinferencebdd/RunLegacyInferenceFeaturesTest` (glue propio + `storedprocsbdd`) y `LegacyInferenceSteps` (grafo desde tabla con fuente, summary, nombres, soporte, cohesión sin presentación, rationale, puntuación recordada, índice de deuda); ejecutar: rojo [TS-001..TS-014]
## Phase 2: Foundational
- [x] T002 Configuración: `InferenceSection`, `viability.debtWeight`, `naming.strategy`, `recommendation.supportNamespaces/minReferencingDomains`; defaults, validador, schema + tipos TS, `engine/CONFIGURATION.md`; `InferenceConfig.overrides()` conservado por el loader [TS-011, TS-014]
- [x] T003 `Presets` (recurso `inference-preset-legacy-desktop.json`, selección `auto`, aplicación defaults ← preset ← overrides) + `PresetsTest`; `InferenceService` resuelve el preset y `summary` lo registra [TS-001, TS-002, TS-003, TS-004]
## Phase 3: US4 — Deuda
- [x] T004 [US4] `DebtIndex` + `DebtIndexTest`; `ViabilityScorer` resta `debtWeight × deuda` y añade `rationale` [TS-009, TS-010, TS-013]
## Phase 4: US1/US2/US3
- [x] T005 [US1] Presentación fuera de cohesión/densidad (`MetricsCalculator`, `ViabilityScorer`) [TS-008]
- [x] T006 [US2] `MicroserviceNameGenerator` estrategia `domain` (+ entidad) [TS-005, TS-006]
- [x] T007 [US3] `isSupportGroup` por namespaces de soporte y fan-in de dominios [TS-007]
## Phase 5: Corpus, docs, polish
- [x] T008 Medición sobre la referencia con la CLI Java (sin prueba `@Tag("corpus")`: la referencia no está en el repositorio); resultado parcial anotado en `docs/EVALUATIONS.md` §11 y en SC-001
- [x] T009 [P] Docs: `docs/VB-LEGACY.md`, `docs/SCHEMA.md`, `CHANGELOG.md`
- [ ] T010 `make test-engine` (SDK 8), baselines, doble corrida; memoria
## Dependencies
T001 → T002 → T003 → T004 → {T005, T006, T007} → T008 → T009 → T010.
