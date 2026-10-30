---
description: "Task list for 022-external-integrations"
---

# Tasks: Integraciones externas, proyectos ausentes y dependencias EOL

**Prerequisites**: spec, plan, research, data-model, contracts, quickstart, tests/features (hash LOCKED; TS-001, TS-002, TS-003, TS-004, TS-005, TS-010, TS-011, TS-012, TS-013, TS-014, TS-015, TS-016, TS-020, TS-021, TS-022, TS-030, TS-031, TS-032, TS-033). TDD obligatorio; `.feature` intocables; SDK .NET 8.

## Phase 1: Setup
- [x] T001 Enlazar las features de 022 en el csproj de pruebas (excluye `integrations-engine.feature`)
- [x] T002 [P] Steps Reqnroll `Bdd/IntegrationSteps.cs` (`has exactly the external dependencies`, `exactly these outbound warnings`, `no user warning starts with`, `outbound integrations are … because of …`); ejecutar: rojo [TS-001, TS-002, TS-003, TS-004, TS-010, TS-011, TS-012, TS-013, TS-014, TS-015, TS-016]
- [x] T003 [P] Runner Cucumber `integrationsbdd/RunExternalIntegrationsFeaturesTest` (glue propio + `storedprocsbdd`); ejecutar: rojo [TS-020, TS-021, TS-022]
- [x] T004 [P] Fixture `Fixtures/VbLegacy/SyntheticIntegrations/**` (plan Design 8) [TS-030, TS-032]

## Phase 2: Foundational
- [x] T005 `schema/eol-dependencies.json` + `Analysis/Vb/EolCatalog.cs` (recurso embebido enlazado) + `Hosts.cs` + pruebas unitarias
- [x] T006 [P] Configuración: Java `IntegrationsConfig`, `DependenciesConfig`, `InferenceConfig`, defaults, validador, schema + tipos TS, `engine/CONFIGURATION.md`, `DependenciesConfigTest`; .NET `AnalysisOptions.Integrations/Dependencies`; puente incluye las secciones [TS-020, TS-021]
- [x] T007 `VbProjectFile` (+ `Packages`, `AssemblyReferences`, `ServiceReferences`, `MissingProjectReferences`) y `AppConfigParser` (+ `ClientEndpoints`) con pruebas

## Phase 3: US1/US2 — Integraciones salientes
- [x] T008 [US1] `Analysis/Vb/VbIntegrationAnalyzer.cs` (pasada 12b) conectada en `ProjectAnalyzer` según `integrations.outbound` y lenguaje; diagnóstico `[info] Outbound integrations: on|off for <lang> (auto|config)` [TS-001, TS-002, TS-003, TS-004, TS-005, TS-016]

## Phase 4: US3/US4 — Dependencias, EOL, proyectos ausentes
- [x] T009 [US4] `Analysis/Vb/VbDependencyAnalyzer.cs` (pasada 12c): dependencias, `EOL_DEPENDENCY`, `project:<ausente>`, advertencias de proyectos ausentes y `.vdproj` [TS-010, TS-011, TS-012, TS-013, TS-014, TS-015]

## Phase 5: Corpus, docs, polish
- [x] T010 Goldens `SyntheticIntegrations.golden.json`; regenerar goldens 020/021 si cambian [TS-030, TS-031]
- [x] T011 [P] Docs `docs/VB-LEGACY.md`, `docs/SCHEMA.md`, `CHANGELOG.md` [TS-033]
- [x] T012 [P] Prueba `Corpus` opt-in: SC-001 (≥ 12 integraciones, 11 proyectos ausentes, ≥ 3 EOL, sin direcciones completas)
- [ ] T013 `make test-engine` (SDK 8), `dotnet format`, doble corrida sobre la referencia; memoria

## Dependencies
T001-T004 paralelo → T005 → {T006, T007} → T008 → T009 → T010 → {T011, T012} → T013.
