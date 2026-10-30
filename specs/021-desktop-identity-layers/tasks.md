---
description: "Task list for 021-desktop-identity-layers"
---

# Tasks: Identidad, capas y puntos de entrada del perfil desktop .NET legacy

**Input**: Design documents from `specs/021-desktop-identity-layers/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md, tests/features/ (hash LOCKED; escenarios TS-001, TS-002, TS-003, TS-004, TS-005, TS-010, TS-011, TS-012, TS-013, TS-014, TS-015, TS-020, TS-021, TS-022, TS-023, TS-024, TS-030, TS-031, TS-032, TS-040, TS-041, TS-042, TS-043, TS-044, TS-045, TS-046, TS-047, TS-050, TS-051, TS-052, TS-053, TS-054)

**Tests**: TDD obligatorio. Prohibido modificar `.feature`, `context.json` o aserciones existentes (001-020). Runner .NET: Reqnroll (features de 021 salvo `desktop-entrypoint-engine.feature`); Java: Cucumber-JVM `@engine`. SDK .NET 8 canónico.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup
- [ ] T001 Enlazar las features de 021 en `DotNetAnalyzer.Tests.csproj` (tercer `ItemGroup`, excluye `desktop-entrypoint-engine.feature`)
- [ ] T002 [P] Steps Reqnroll `Bdd/DesktopSteps.cs` (directorio de proyectos anidados, `the components are exactly`, anotaciones, log de reglas de deuda, log no contiene); ejecutar: rojo [TS-001, TS-002, TS-003, TS-004, TS-005, TS-010, TS-011, TS-012, TS-013, TS-014, TS-030, TS-031, TS-032, TS-040, TS-041, TS-042, TS-043, TS-044, TS-045, TS-046, TS-047]
- [ ] T003 [P] Runner Cucumber `desktopbdd/RunDesktopIdentityFeaturesTest` (glue `desktopbdd` + `storedprocsbdd`) y `DesktopIdentitySteps` (grafo anotado, `legacy_entrypoint`); ejecutar: rojo [TS-020, TS-021, TS-022, TS-023, TS-024]
- [ ] T004 [P] Fixture `Fixtures/VbLegacy/SyntheticLegacyDebt/**` (plan Design 7) y `OptionStrict On` en `SyntheticDesktop.vbproj` y `SyntheticProcedures.vbproj` (test data; README) [TS-050, TS-053]

## Phase 2: Foundational
- [ ] T005 `Analysis/Vb/VbProjectFile.cs` + `VbProjectContext.FindProjectFile` + pruebas `VbProjectFileTests.cs` (research D1)
- [ ] T006 [P] Configuración `debt`: Java `DebtConfig`, `InferenceConfig`, defaults, validador, schema + tipos TS, `engine/CONFIGURATION.md`; `DebtConfigTest` [TS-022]
- [ ] T007 [P] .NET `AnalysisOptions.Debt` (`DebtOptions`: enabled, godClass.minLoc, godClass.minComplexity) + pruebas; puente Java incluye `debt` en el `--config` temporal (`DebtConfig.affectsAnalyzer`) [TS-023]

## Phase 3: US1 — Identidad (P1)
- [ ] T008 [US1] `VbProjectLoader`: opciones de compilación con `RootNamespace` e `Import` globales; `LoadAdhocProjects` por `.vbproj` anidado en orden de `ProjectReference` con referencias de metadatos; `ProjectAnalyzer.LoadCompilationsViaAdhoc` lo usa para carpetas con `.vbproj` anidados; `VbTypeIndex` nombre de respaldo con raíz [TS-001, TS-002, TS-003, TS-004, TS-005]

## Phase 4: US2 — Capas y punto de entrada (P1)
- [ ] T009 [US2] `VbLayerClassifier`: capas finas, anotaciones `Layer:*`/`EntryPoint:Main`, proyección, Validator (research D3) [TS-010, TS-011, TS-012, TS-013, TS-014, TS-015]
- [ ] T010 [US2] Java `MicroserviceRecommendationEngine.buildEntrypointFromComponents`: punto de entrada por lotes (`internal`, `Main`) [TS-020, TS-021]

## Phase 5: US3/US4 — Issue de proyecto y reglas de deuda (P2)
- [ ] T011 [US4] `Analysis/Vb/VbDebtAnalyzer.cs` (seis reglas, data-model) conectado como pasada 11c según `DebtOptions` y lenguaje; diagnóstico `[info] Legacy debt rules: on|off for <lang> (auto|config)`; pruebas unitarias [TS-030, TS-031, TS-032, TS-040, TS-041, TS-042, TS-043, TS-044, TS-045, TS-046, TS-047]

## Phase 6: Corpus, goldens, docs
- [ ] T012 Goldens `SyntheticLegacyDebt.golden.json`, `SyntheticLegacyDebt.debt-off.golden.json`; regenerar goldens 020 (anotaciones nuevas, justificación) [TS-050, TS-051, TS-052]
- [ ] T013 [P] Docs: `docs/VB-LEGACY.md`, `docs/SCHEMA.md`, `CHANGELOG.md`, `docs/ARCHITECTURE.md` (deuda) [TS-054]
- [ ] T014 [P] Prueba `Corpus` opt-in: SC-001 (0 sin namespace, ≥ 95 % Win en Presentación/Reportes, consola Batch) y aristas ≥ 90 % de las actuales; SC-006 tiempo

## Phase 7: Polish
- [ ] T015 `make test-engine` completo (SDK 8), Checkstyle/SpotBugs/`dotnet format`, doble corrida sobre la referencia; memoria de progreso

## Dependencies
Setup (T001-T004, paralelo) → T005 → {T006, T007} → T008 → T009 → T010 → T011 → T012 → {T013, T014} → T015.
