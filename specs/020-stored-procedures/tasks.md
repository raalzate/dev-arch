---
description: "Task list for 020-stored-procedures"
---

# Tasks: Acceso a datos por stored procedures en .NET legacy

**Input**: Design documents from `specs/020-stored-procedures/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md, tests/features/ (hash LOCKED; escenarios TS-001, TS-002, TS-003, TS-004, TS-005, TS-006, TS-007, TS-008, TS-009, TS-010, TS-011, TS-012, TS-013, TS-014, TS-015, TS-016, TS-017, TS-018, TS-019, TS-020, TS-021, TS-022, TS-023, TS-024, TS-025, TS-026, TS-027, TS-028, TS-029, TS-030, TS-031, TS-032, TS-033, TS-034, TS-040, TS-041, TS-042, TS-043, TS-044, TS-045)

**Tests**: TDD obligatorio (Constitución III). Cada tarea de pruebas / step definitions se ejecuta y falla (rojo) antes de su implementación. Prohibido modificar `.feature`, `context.json` o aserciones existentes (incluidas las de 001-014).

**Dónde se trabaja**: `~/Documents/maestria/dev-arch`, rama `020-stored-procedures` (sobre `014b-engine-debt`). Runner .NET: Reqnroll (features de 020 salvo `procedure-inference-engine.feature`); runner Java: Cucumber-JVM (`@engine`). Entorno canónico: SDK .NET 8 (`DOTNET_ROOT=$HOME/.dotnet8`).

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [x] T001 Enlazar `specs/020-stored-procedures/tests/features/*.feature` (excepto `procedure-inference-engine.feature`) en `engine/src/test/dotnet/DotNetAnalyzer.Tests/DotNetAnalyzer.Tests.csproj` con un segundo `ItemGroup` de `ReqnrollFeatureFiles` (code-behind en `obj/ReqnrollFeatures/`), misma mecánica que 009 (plan Design 10, research D9)
- [x] T002 [P] Capturar el golden del corpus sintético **antes** de tocar código de producción: `Fixtures/Golden/SyntheticDesktop.golden.json` (raíz `<ROOT>`) con el fixture actual; registrar en el commit que se regenerará al añadir `PolicyAdapter.vb` (T005) con justificación [TS-041]
- [x] T003 Crear los steps Reqnroll de 020 en `engine/src/test/dotnet/DotNetAnalyzer.Tests/Bdd/ProcedureSteps.cs` (proyecto C# temporal `a C# legacy project with the file`, `the procedure catalog directory … with the script`, `the procedure catalog file`, `the project is analyzed [twice] with the configuration` (archivo temporal con rutas de catálogo resueltas respecto del proyecto), `the analyzer is run with the configuration` (proceso `dotnet-analyzer` real: código de salida y stderr), `the analysis log states that stored procedure detection is …`, `the analyzer error output contains`) con aserciones reales; ejecutar: rojo [TS-001, TS-002, TS-003, TS-004, TS-005, TS-006, TS-007, TS-008, TS-009, TS-011, TS-012, TS-013, TS-014, TS-015, TS-016, TS-017, TS-018, TS-019, TS-030, TS-031, TS-032, TS-033, TS-034]
- [x] T004 [P] Crear el runner Cucumber-JVM `engine/src/test/java/com/extractor/storedprocsbdd/RunStoredProceduresFeaturesTest.java` (`@SelectDirectories("../specs/020-stored-procedures/tests/features")`, filtro `@engine`) y `StoredProceduresSteps.java` (grafo sintético desde tabla, inferencia con `InferenceService` y configuración, re-inferencia por `AnalysisService`, carga/validación de configuración, análisis CLI de demos y comparación con `engine/src/test/resources/baseline-*`, captura de los argumentos del puente mediante un `DotNetToolLocator` apuntando a un `dotnet-analyzer` envoltorio que registra `argv` y reenvía al real, heurística de entidad); ejecutar: rojo [TS-020, TS-021, TS-022, TS-023, TS-024, TS-025, TS-026, TS-027, TS-028, TS-029]
- [x] T005 [P] Ampliar el corpus sintético: `Fixtures/VbLegacy/SyntheticDesktop/DataAccess/PolicyAdapter.vb` (R1-R4, concatenación, nombre calificado, un nombre no literal en la línea 34, un comando de texto), `Fixtures/VbLegacy/SyntheticDesktop/Catalog/procs/{policy.sql,audit.sql}` y `Catalog/procs.csv` equivalentes (tablas `Policies`, `PolicyHolders`, `PolicyArchive`, `AuditLog`; `usp_Policy_Touch` ausente del catálogo), README actualizado; `Fixtures/CSharpLegacyEntLib/` mínimo (csproj + `Adapter.cs`) para la activación por configuración [TS-040, TS-042, TS-043]

**Checkpoint**: los dos runners descubren los 40 escenarios; TS-010 (golden C#) verde; el resto rojo.

---

## Phase 2: Foundational

- [x] T006 Configuración Java: `engine/src/main/java/com/extractor/inference/config/DataAccessConfig.java` (record), `InferenceConfig` (+ `dataAccess`), `inference-defaults.json` (sección `dataAccess`), `InferenceConfigValidator` (`procedures` ∈ auto|on|off, `catalogMode` ∈ complement|replace, `procedureWeight ≥ 0`, claves desconocidas rechazadas como hoy); pruebas `engine/src/test/java/com/extractor/inference/config/DataAccessConfigTest.java` (rojo → verde) [TS-025]
- [x] T007 [P] Contrato: añadir `dataAccess` a `schema/1.0.0/inference-config.schema.json` (aditivo, defaults), regenerar `schema/generated/{types,validators}.ts` (`npm run generate -w schema`), `npm run check -w schema` y `make schema-check` en verde; documentar en `docs/SCHEMA.md` (contrato `contracts/inference-config-dataaccess.md`) [TS-045]
- [x] T008 Opciones del analizador .NET: `engine/src/main/dotnet/DotNetAnalyzer/Analysis/AnalysisOptions.cs` (`DataAccessOptions`: `ProceduresMode`, `CatalogPath`, `CatalogMode`; `Parse(json)` tolerante a claves desconocidas, errores con causa) y `Program.cs` (`dotnet-analyzer <path> [--config=<file>]`, exit 1 + `Error: invalid --config: …`); `ProjectAnalyzer.AnalyzeProjectAsync(path, options)` con la sobrecarga actual delegando en `AnalysisOptions.Default`; pruebas `Analysis/AnalysisOptionsTests.cs` [TS-034]
- [x] T009 [P] Canonicalización y plegado C#: `Analysis/Data/ProcedureName.cs` (`Canonical`, `Key`, `LooksLikeIdentifier`) y `Analysis/Data/CsStringFolder.cs` (literales, `+`, `string.Concat`, verbatim, interpolaciones ⇒ hueco); pruebas unitarias `Analysis/Data/ProcedureNameTests.cs`, `Analysis/Data/CsStringFolderTests.cs` (rojo → verde) (research D5)

**Checkpoint**: configuración cargable por CLI/MCP con `dataAccess`; el analizador acepta `--config`; TS-025 y TS-034 en verde; el comando sin `--config` no cambia.

---

## Phase 3: User Story 1 — Procedimientos invocados (P1) 🎯 MVP

- [x] T010 [US1] Emparejador y adaptadores sintácticos: `Analysis/Data/ProcedureCallMatcher.cs` (reglas R1-R4 de data-model §Reglas, advertencia de nombre no literal), `Analysis/Data/IProcedureCallSyntax.cs`, `Analysis/Data/VisualBasicProcedureCallSyntax.cs` (sobre `VbTypeIndex` + `VbStringFolder`), `Analysis/Data/CSharpProcedureCallSyntax.cs` (índice mínimo de tipos C# con el nombre calificado de `TypeAnalyzer` + `CsStringFolder`); pruebas unitarias `Analysis/Data/ProcedureCallMatcherTests.cs` (casos positivos y negativos por regla, en ambos lenguajes) (research D2, D4)
- [x] T011 [US1] Pasada 5c `Analysis/Data/ProcedureCallExtractor.cs` (emisión `sp:<Canonical>` por componente, advertencias de usuario ordenadas, diagnóstico `[info] Stored procedure detection: …`) conectada en `Analysis/ProjectAnalyzer.cs` tras 5/5b según `DataAccessOptions.ProceduresMode` y el lenguaje de la compilación; verificar que las salidas de `test-for-demo/*` no cambian (`make test-engine`) [TS-001, TS-002, TS-003, TS-004, TS-005, TS-006, TS-007, TS-008, TS-009, TS-010, TS-030, TS-031, TS-032, TS-033]

**Checkpoint**: TS-001..TS-010 y TS-030..TS-034 verdes; `BaselineParityTest` y golden C# intactos.

---

## Phase 4: User Story 2 — Catálogo sp → tablas (P1)

- [x] T012 [US2] `Analysis/Vb/SqlTableParser.cs`: helper `SplitStatements(text)` (por `;` o palabra clave inicial de línea) sin cambiar `Parse`; `Analysis/Data/ProcedureScriptParser.cs` (encabezados `CREATE [OR ALTER] PROC[EDURE]` / `ALTER PROC[EDURE]`, cuerpo hasta `GO`/siguiente encabezado, tablas por sentencia, `EXEC[UTE] <ref>`), sin timeouts; pruebas `Analysis/Data/ProcedureScriptParserTests.cs` (rojo → verde) (research D6)
- [x] T013 [US2] `Analysis/Data/ProcedureCatalog.cs` (`Load(path)`: directorio ⇒ scripts ordinal sin `bin/`/`obj/`; `.csv` ⇒ cabecera obligatoria ES/EN; `None(reason)` ante ruta inexistente/ilegible/cabecera inválida; duplicados por menor ruta; `Resolve` transitivo con visitados; `Unresolved`); pruebas `Analysis/Data/ProcedureCatalogTests.cs` (scripts, CSV, duplicados, ciclos, errores) (rojo → verde)
- [x] T014 [US2] Integrar el catálogo en `ProcedureCallExtractor` (modos `complement`/`replace`, advertencias `not loaded`, `not found`, `duplicate definition` con nombres relativos al catálogo, nunca cuerpos ni rutas absolutas) [TS-011, TS-012, TS-013, TS-014, TS-015, TS-016, TS-017, TS-018, TS-019]

**Checkpoint**: TS-011..TS-019 verdes; doble corrida con catálogo idéntica.

---

## Phase 5: User Story 3 — Inferencia por procedimientos compartidos (P2)

- [x] T015 [US3] `engine/src/main/java/com/extractor/inference/DataResources.java` (recursos ponderados: tablas 1.0, `sp:` `procedureWeight`, omitidos si 0; orden tablas→`sp:`); pruebas `engine/src/test/java/com/extractor/inference/DataResourcesTest.java` (rojo → verde) (research D7)
- [x] T016 [US3] Consumir `DataResources` en `ClusteringAlgorithm.groupBySharedTables`, `MetricsCalculator.findSharedTables`, `ViabilityScorer.calculateDataCohesion` y el Jaccard de datos de `EvidenceGraph`/`RecommendationEngine`; propagar `InferenceConfig.dataAccess` por `InferenceService`; `ReinferArchitectureTool`/`AnalysisService` aceptan la sección sin cambios de forma; `BaselineParityTest` y `DefaultOutputsRegressionTest` intactos [TS-020, TS-021, TS-022, TS-023, TS-024]

**Checkpoint**: TS-020..TS-025 verdes; baselines byte-idénticos.

---

## Phase 6: User Story 4 — Activación y transporte de la configuración (P2)

- [x] T017 [US4] `engine/src/main/java/com/extractor/analyzer/DotNetBridgeAnalyzer.java`: constructor con `DataAccessConfig`; si difiere de la de por defecto, archivo temporal `{ "dataAccess": … }` (ruta del catálogo absoluta) y argumento `--config=<file>`, borrado al terminar; `ExtractionService` pasa la sección desde `InferenceConfig`; prueba `engine/src/test/java/com/extractor/analyzer/DotNetBridgeConfigTest.java` (sin configuración ⇒ `argv` exactamente `[exe, project]`) [TS-026, TS-027]

**Checkpoint**: TS-026, TS-027 verdes; TS-023 sigue verde (comando por defecto inalterado).

---

## Phase 7: User Story 5 — Heurística de entidad (P3)

- [x] T018 [US5] `engine/src/main/java/com/extractor/inference/ProcedureEntityHeuristic.java` (prefijos, verbos fijos, PascalCase; `null` sin estructura) y uso en `MicroserviceNameGenerator` solo con `entityHeuristic = true`; pruebas `ProcedureEntityHeuristicTest.java` [TS-028, TS-029]

**Checkpoint**: TS-028, TS-029 verdes; sin `entityHeuristic` los nombres de propuesta no cambian (baselines).

---

## Phase 8: Corpus, golden y documentación

- [x] T019 Regenerar los golden del corpus sintético tras el verde: `Fixtures/Golden/SyntheticDesktop.golden.json` (sin catálogo; justificación: `PolicyAdapter.vb` añadido en T005) y `Fixtures/Golden/SyntheticDesktop.catalog.golden.json` (modo `replace`, idéntico con scripts y CSV) [TS-040, TS-041, TS-042, TS-043]
- [x] T020 [P] Prueba `Corpus` opt-in en `engine/src/test/dotnet/DotNetAnalyzer.Tests/Analysis/Vb/VbCorpusSmokeTests.cs`: SC-002 (≥ 80 % de `*Adapter` con `tables_used`, ≥ 850 `sp:` distintos) y SC-008 (tiempo ≤ +10 % respecto de la corrida sin la pasada) sobre la referencia externa cuando exista [TS-044]
- [x] T021 [P] Documentación: `docs/VB-LEGACY.md` (sección "Procedimientos almacenados": `sp:`, formas R1-R4, catálogo, modos, activación, peso, heurística, limitaciones), `docs/SCHEMA.md` (ya en T007), `CHANGELOG.md` ([Unreleased] "Añadido (feature 020)") [TS-045]

---

## Phase 9: Polish & Cross-Cutting

- [ ] T022 Determinismo y entorno: doble corrida byte-idéntica sobre la referencia externa (opt-in, macOS) y sobre el corpus sintético en CI Linux; `make test-engine` completo en SDK 8; Checkstyle (ratchet), SpotBugs 0, `dotnet format --verify-no-changes`
- [x] T023 Registrar en `docs/ARCHITECTURE.md` (tabla de deuda) el índice mínimo de tipos C# de `CSharpProcedureCallSyntax` como extensión de la deuda de walkers (se retira si 016 abstrae sobre `IOperation`); actualizar la memoria de progreso del plan; abrir PR `020-stored-procedures` → `main` (tras el merge de `014b-engine-debt`)

---

## Dependencies & Execution Order

- Setup: T001 → T003; T002, T004, T005 en paralelo con T001 (archivos distintos). T002 antes de cualquier cambio de producción.
- Foundational: T006 → T007 (schema refleja el record); T008 y T009 en paralelo entre sí y con T006/T007.
- US1: T010 (necesita T009) → T011 (necesita T008, T010).
- US2: T012 → T013 → T014 (necesita T011).
- US3: T015 (necesita T006) → T016.
- US4: T017 (necesita T006, T008).
- US5: T018 (necesita T006).
- Corpus/docs: T019 (necesita T011, T014); T020, T021 en paralelo.
- Polish: T022 (todo lo anterior) → T023.

Ruta crítica: T001 → T003 → T008 → T010 → T011 → T012 → T013 → T014 → T019 → T022 → T023.
Lotes paralelos: {T002, T004, T005} · {T006, T008, T009} · {T015, T017, T018 tras T006/T008} · {T020, T021}.

## Implementation Strategy

MVP = Setup + Foundational + US1 (T001-T011): el corpus de referencia pasa de 1 a ≥ 850 procedimientos visibles y el PRD de policy-manager ya obtiene el mapa procedimiento → componente. Después US2 (catálogo), US3/US4 (inferencia y transporte), US5, corpus/golden, polish.
