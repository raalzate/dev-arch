---
description: "Task list for 024-extended-static-analysis"
---
# Tasks: Análisis estático extendido
**Prerequisites**: spec, plan, research, data-model, contracts, quickstart, tests/features (hash LOCKED; TS-001..TS-014 .NET, TS-020..TS-024 engine). TDD; `.feature` intocables.
## Phase 1: Setup
- [x] T001 Fixture `Fixtures/VbLegacy/SyntheticExtended` (Rules, Dead, Dup, Forms, Program, reports/sonar.sarif, README, vbproj); `Bdd/ExtendedSteps.cs`; csproj enlaza features 024; runner Cucumber `extendedbdd`; ejecutar: rojo [TS-001..TS-014, TS-020..TS-024]
## Phase 2: Foundational
- [x] T002 BUG-010: `EOL_DEPENDENCY` → `SECURITY`; golden 022 regenerado; `CodeIssueTypeTest` compara enum Java con `schema/1.0.0/common.schema.json`; docs [TS-014]
- [x] T003 `AnalysisOptions.Analysis` + `Parse`; `schema/extended-rules.json` + `ExtendedRuleSet`; csproj (NetAnalyzers 8.0.0, DLL al output, recurso) [TS-002, TS-003]
- [x] T004 Java `AnalysisConfig`, `viability.maintainabilityWeight`, validador, defaults, schema + TS, bridge, preset, `engine/CONFIGURATION.md` [TS-020, TS-021, TS-024]
## Phase 3: US1/US2/US3/US4/US5 (.NET)
- [x] T005 [US1] `VbExtendedAnalyzer` (NetAnalyzers, mapeo tipo/severidad/mensaje, `[WARN]` por excepción) + pasada 11d + diagnóstico de estado [TS-001, TS-011]
- [x] T006 [US2] `VbDeadCodeAnalyzer` [TS-004]
- [x] T007 [US2] `VbDuplicationAnalyzer` [TS-005, TS-006]
- [x] T008 [US3] `VbMaintainabilityCalculator` + `DebtIndex` MI [TS-007, TS-022]
- [x] T009 [US4] `SarifImporter` [TS-008, TS-009]
- [x] T010 [US5] `LayerSuppressions` [TS-010]
## Phase 4: Polish
- [x] T011 Golden `SyntheticExtended`, doble corrida, validación de contrato [TS-012, TS-013]
- [x] T012 [P] Docs: `docs/VB-LEGACY.md`, `docs/SCHEMA.md`, `CHANGELOG.md`, `docs/EVALUATIONS.md` §12 (referencia: categorías, CWE, tiempo)
- [ ] T013 `make test-engine` (SDK 8), baselines [TS-023]; memoria
## Dependencies
T001 → T002 → T003 → T004 → {T005..T010} → T011 → T012 → T013.
