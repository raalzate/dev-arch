---
description: "Task list for 009-vb-legacy-completion"
---

# Tasks: Cierre de VB.NET legacy

**Input**: Design documents from `specs/009-vb-legacy-completion/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md, tests/features/ (hash LOCKED; escenarios TS-001, TS-002, TS-003, TS-004, TS-005, TS-006, TS-007, TS-008, TS-009, TS-010, TS-011, TS-012, TS-013, TS-014, TS-015, TS-016, TS-017, TS-018, TS-019, TS-020, TS-021, TS-022, TS-023, TS-024, TS-025, TS-026, TS-030, TS-031, TS-032, TS-033, TS-034, TS-035, TS-036, TS-040, TS-041, TS-042, TS-043, TS-044, TS-045, TS-050, TS-051, TS-052, TS-053, TS-054, TS-055, TS-060, TS-061, TS-062, TS-070, TS-071, TS-080, TS-081, TS-082, TS-083, TS-084, TS-090, TS-091, TS-092, TS-093)

**Tests**: TDD obligatorio (Constitución III). Cada tarea de pruebas / step definitions se ejecuta y falla (rojo) antes de su implementación. Prohibido modificar `.feature`, `context.json` o aserciones existentes.

**Dónde se trabaja**: raíz del producto `apps/dev-arch` (worktree `maestria-devarch-009`, rama `009-vb-legacy-completion`). Runner .NET: Reqnroll (todas las features salvo `reduced-fidelity-engine.feature`); runner Java: Cucumber-JVM (`@engine`).

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [ ] T001 Añadir `Reqnroll.xUnit` 2.0.3 a `engine/src/test/dotnet/DotNetAnalyzer.Tests/DotNetAnalyzer.Tests.csproj`, enlazar `specs/009-vb-legacy-completion/tests/features/*.feature` (excepto `reduced-fidelity-engine.feature`) con code-behind movido a `obj/ReqnrollFeatures/`, excluir `bin/`/`obj/` de la copia de fixtures; añadir `specs/**/*.feature.cs` a `.gitignore` (research D9)
- [ ] T002 [P] Añadir los fixtures sintéticos `Fixtures/VbLegacy/SyntheticDesktop/**` y `Fixtures/VbLegacy/SyntheticWebServices/**` (research D11)
- [ ] T003 Capturar los archivos de oro C# **antes** de tocar código de producción (`Fixtures/Golden/SampleProject.golden.json`, `Fixtures/Golden/CodeIssuesSample.golden.json`, raíz sustituida por `<ROOT>`) y crear los steps de compatibilidad en `Bdd/CompatibilitySteps.cs` [TS-070]; ejecutar: verde (línea base)
- [ ] T004 Crear los steps compartidos Reqnroll (`Bdd/VbAnalysisContext.cs`, `Bdd/VbProjectSteps.cs`: proyectos VB temporales, fixtures sintéticos, análisis, serialización como `Program.cs`) y los steps de todas las features .NET con aserciones reales; ejecutar: rojo
- [ ] T005 [P] Crear el runner Cucumber-JVM `engine/src/test/java/com/extractor/vblegacybdd/RunVbLegacyCompletionFeaturesTest.java` (filtro `@engine`) y `VbWarningsSteps.java` [TS-090, TS-091, TS-092, TS-093]; ejecutar: rojo

**Checkpoint**: runners descubren todos los escenarios; TS-070 verde, el resto rojo.

---

## Phase 2: Foundational

- [ ] T006 Pruebas + implementación de `Analysis/Vb/VbTypeIndex.cs` (bloque de tipo → id de componente, bloque más interno) y `Analysis/Vb/VbProjectContext.cs` (directorio del proyecto, `app.config`/`web.config`, `*.xsd`) en `Analysis/Vb/VbTypeIndexTests.cs`, `Analysis/Vb/VbProjectContextTests.cs`
- [ ] T007 Carga VB con fidelidad reducida: en `Analysis/ProjectAnalyzer.cs` la rama `.vbproj` cae a Adhoc si la compilación no resuelve `System.Object` (FR-065), `meta.source = roslyn-fallback` cuando un proyecto VB usa Adhoc, `UserWarnings` deterministas; `VbProjectLoader.LoadAdhoc` excluye `bin/`/`obj/`; `Program.cs` imprime `[warning] <texto>` tras el JSON; despacho de pasadas VB solo para compilaciones VB [TS-060, TS-061, TS-062]

**Checkpoint**: TS-060, TS-061, TS-062, TS-070 en verde.

---

## Phase 3: User Story 1 — Tablas (P1) 🎯 MVP

- [ ] T008 [US1] Pruebas unitarias `Analysis/Vb/SqlTableParserTests.cs`, `Analysis/Vb/VbStringFolderTests.cs`, `Analysis/Vb/TypedDataSetParserTests.cs` (rojo) e implementación de `Analysis/Vb/SqlTableParser.cs`, `Analysis/Vb/VbStringFolder.cs`, `Analysis/Vb/TypedDataSetParser.cs` (data-model §SQL, §DataSet)
- [ ] T009 [US1] Implementar `Analysis/Vb/VbTableExtractor.cs` y conectarlo en `ProjectAnalyzer` (pasada 5b) [TS-001, TS-002, TS-003, TS-004, TS-005, TS-006, TS-007, TS-008, TS-009]

---

## Phase 4: User Story 2 — Code issues VB (P1)

- [ ] T010 [US2] Implementar `Analysis/Vb/VbCodeAnalyzer.cs` (reglas de data-model §Code issues, enlace tardío por operaciones dinámicas, orden como C#, `sensitive_data` por secreto en código) y conectarlo (pasada 11b) [TS-010, TS-011, TS-012, TS-013, TS-014, TS-015, TS-016, TS-017, TS-018, TS-019]

---

## Phase 5: User Story 3 — Métricas (P1)

- [ ] T011 [US3] Implementar `Analysis/Vb/VbMetricsCalculator.cs` (CBO, LCOM, complejidad, `HIGH_CYCLOMATIC_COMPLEXITY`) y conectarlo (pasada 7b) [TS-020, TS-021, TS-022, TS-023, TS-024, TS-025, TS-026]

---

## Phase 6: User Story 4 — Configuración y secretos (P2)

- [ ] T012 [US4] Pruebas `Analysis/Vb/AppConfigParserTests.cs` (rojo) e implementación `Analysis/Vb/AppConfigParser.cs` (data-model §Configuración, DTD deshabilitada, diagnósticos)
- [ ] T013 [US4] Implementar `Analysis/Vb/VbSecretsDetector.cs` y conectarlo (pasada 10b) [TS-030, TS-031, TS-032, TS-033, TS-034, TS-035, TS-036]

---

## Phase 7: User Story 5 — Capas de escritorio (P2)

- [ ] T014 [US5] Implementar `Analysis/Vb/VbLayerClassifier.cs` (FR-040 en orden, interfaces intactas) y conectarlo tras el clasificador general (pasada 8b) [TS-040, TS-041, TS-042, TS-043, TS-044, TS-045]

---

## Phase 8: User Story 6 — Endpoints ASMX/WCF (P2)

- [ ] T015 [US6] Implementar `Analysis/Vb/VbEndpointExtractor.cs` (data-model §Endpoints) y conectarlo (pasada 4b; capa `Controlador` de servicios web en T014) [TS-050, TS-051, TS-052, TS-053, TS-054, TS-055]

---

## Phase 9: User Story 7 — Advertencias de fidelidad reducida (P2)

- [ ] T016 [US7] Prueba JUnit `engine/src/test/java/com/extractor/analyzer/DotNetBridgeWarningsTest.java` (rojo) y lectura de líneas `[warning] ` de stderr en `engine/src/main/java/com/extractor/analyzer/DotNetBridgeAnalyzer.java` (contracts/dotnet-warnings-channel.md) [TS-090, TS-091, TS-092]
- [ ] T017 [P] [US7] Documentar limitaciones y reglas VB en `docs/VB-LEGACY.md` [TS-093]

---

## Phase 10: User Story 8 — Corpus (P1)

- [ ] T018 [US8] Corregir la documentación de `Analysis/Vb/VbCorpusSmokeTests.cs` (corpus externo, no redistribuible, opcional; categoría `Corpus` intacta) y verificar los escenarios del corpus y de compatibilidad [TS-071, TS-080, TS-081, TS-082, TS-083, TS-084]

---

## Phase 11: Polish & Cross-Cutting

- [ ] T019 `CHANGELOG.md` ([Unreleased] — feature 009), diff antes/después de los demos `dotnet-ecommerce`, `dotnet-legacy-clinic`, `dotnet-unstructured` (byte-idénticos), quickstart ejecutado
- [ ] T020 Gates: `make test` verde, `dotnet format --verify-no-changes`, Checkstyle ≤ 4763, SpotBugs 0, `verify-steps`/`verify-step-quality`; clon limpio `make build && make test`

---

## Dependencies & Execution Order

- Setup (T001 → T003, T004; T002, T005 en paralelo) → Foundational (T006 → T007) → historias.
- US1 (T008 → T009) → US2 (T010) → US3 (T011) → US4 (T012 → T013) → US5 (T014, usa tablas de US1 y servicios web de US6 vía detección propia) → US6 (T015) → US7 (T016, T017) → US8 (T018) → Polish (T019 → T020).
- Las historias tocan `ProjectAnalyzer.cs` para conectar su pasada: se ejecutan en secuencia (sin [P] entre ellas).

## Implementation Strategy

MVP = Setup + Foundational + US1 + US2 + US3 (criterio de salida "tablas, métricas e issues no vacíos"). Después US4–US8 y Polish.
