---
description: "Task list for 008-configurable-inference"
---

# Tasks: Extracción e inferencia separadas y configurables

**Input**: Design documents from `specs/008-configurable-inference/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md, tests/features/ (49 escenarios TS-001, TS-002, TS-003, TS-004, TS-005, TS-006, TS-007, TS-008, TS-009, TS-010, TS-011, TS-012, TS-013, TS-014, TS-015, TS-016, TS-017, TS-018, TS-019, TS-020, TS-021, TS-022, TS-023, TS-024, TS-025, TS-026, TS-027, TS-028, TS-029, TS-030, TS-031, TS-032, TS-033, TS-034, TS-035, TS-036, TS-037, TS-038, TS-039, TS-040, TS-041, TS-042, TS-043, TS-044, TS-045, TS-046, TS-047, TS-048, TS-049, hash LOCKED)

**Tests**: TDD obligatorio (CONSTITUTION.md principio III). Cada tarea de pruebas / step definitions DEBE ejecutarse y fallar antes de su tarea de implementación. Prohibido modificar `.feature`, aserciones existentes (001–007) o `context.json` para pasar.

**Dónde se trabaja**: raíz del producto `apps/dev-arch` (worktree `/Users/raul.alzate/Documents/maestria/maestria-devarch`, rama `008-configurable-inference`). Comandos con JDK 17 vía `JAVA_HOME` y `DOTNET_ROOT`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizable (archivos distintos, sin dependencias pendientes)
- **[USn]**: historia de usuario de spec.md
- Trazabilidad: listas explícitas `[TS-001, TS-002]`

---

## Phase 1: Setup

**Purpose**: línea base de regresión y runner BDD antes de tocar código de producción

- [x] T001 Capturar `engine/src/test/resources/baseline-v1.2.0/<project>/{output,output_architecture,output_entrypoints}.json` de los 6 proyectos de demostración con el motor de `7bc8170` (worktree temporal, `DemoOutputs` herméticos, marcador `${REPO}`), con `README.md` que documente origen y regeneración (research D1)
- [x] T002 [P] Crear runner JVM `engine/src/test/java/com/extractor/configbdd/RunConfigurableInferenceFeaturesTest.java` (`@SelectDirectories("../specs/008-configurable-inference/tests/features")`, glue `com.extractor.configbdd`) con `World.java`, `Hooks.java` y soporte compartido (`Demo.java`: copias herméticas, almacenes de análisis sin fuentes; `Mcp.java`: llamadas en proceso a tools y recursos, cliente stdio); ejecutar: escenarios indefinidos (rojo)
- [x] T003 [P] Generador determinista de grafo sintético de 500 componentes en `engine/src/test/java/com/extractor/testsupport/SyntheticGraph.java` (25 dominios × 20 clases, llamadas intra/inter dominio, tablas) con prueba de determinismo `SyntheticGraphTest.java` (research D13)

**Checkpoint**: línea base versionada; los 49 escenarios se descubren (rojos).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: configuración con nombre, inferencia parametrizada y separación de etapas — base de todas las historias

- [x] T004 [P] Pruebas unitarias de configuración en `engine/src/test/java/com/extractor/inference/config/InferenceConfigLoaderTest.java`: defaults = valores de data-model.md, fusión parcial, desconocidos, tipos, rangos, pares incoherentes, enums, archivo inexistente/no JSON, `toJson` estable (rojo) [TS-008, TS-010, TS-013]
- [x] T005 Implementar `engine/src/main/java/com/extractor/inference/config/` (`InferenceConfig` y records de sección, `InferenceConfigLoader`, `InvalidConfigException`) hasta pasar T004 (research D3, D4)
- [x] T006 [P] Pruebas unitarias por etapa en `engine/src/test/java/com/extractor/inference/ConfigurableInferenceTest.java`: cada clase con `InferenceConfig.defaults()` produce lo mismo que el constructor actual y un parámetro cambiado produce el efecto esperado (agrupación, evidencia, consolidación, viabilidad, propuestas, nombres) (rojo) [TS-043, TS-044, TS-045, TS-046, TS-047]
- [x] T007 Parametrizar `ClusteringAlgorithm`, `InterClusterGraph` (`Set.of(array)` en el orden vigente), `ClusterConsolidator`, `ViabilityScorer`, `MicroserviceNameGenerator`, `MicroserviceRecommendationEngine` e `InferenceEngine` en `engine/src/main/java/com/extractor/inference/` con constructores por defecto que delegan a `defaults()`; sin cambios de salida (T006 + pruebas existentes)
- [x] T008 [P] Pruebas de separación en `engine/src/test/java/com/extractor/service/StageSplitTest.java`: `ExtractionService` + `InferenceService` == `AnalysisService.analyzeProject` byte a byte en `java-standar` y `dotnet-ecommerce`; `InferenceService` no toca el sistema de archivos (secretos precalculados) (rojo) [TS-001, TS-002]
- [x] T009 Implementar `ExtractionResult`, `InferenceInput`, `ExtractionService`, `InferenceService` en `engine/src/main/java/com/extractor/service/`, sobrecarga con secretos precalculados en `MicroserviceRecommendationEngine`, y `AnalysisService` como fachada con sobrecargas `InferenceConfig` (caché solo con defaults) hasta pasar T008 (research D2, D9)

**Checkpoint**: inferencia configurable y pura; salidas por defecto sin cambios.

---

## Phase 3: User Story 3 — Las salidas por defecto no cambian (Priority: P1) 🎯 MVP

**Goal**: regresión byte a byte de los 18 documentos en CLI y MCP; 5 herramientas por defecto; versión de contrato intacta.

**Independent Test**: `RunConfigurableInferenceFeaturesTest` filtrado a `regression.feature`.

- [x] T010 [US3] Step definitions de `regression.feature` en `engine/src/test/java/com/extractor/configbdd/RegressionSteps.java` (CLI vía `java -jar` del artefacto empaquetado, MCP vía `AnalyzeProjectTool.handle`, comparación con `baseline-v1.2.0`, registro de tools con/sin herramientas de inferencia); ejecutar (TS-003 rojo) [TS-001, TS-002, TS-003, TS-004]
- [x] T011 [US3] `McpServerMain.createToolSpecs(service, inferenceTools)` y lectura de `STATIC_INFERENCE_INFERENCE_TOOLS` (env o `-D`) en `engine/src/main/java/com/extractor/mcp/McpServerMain.java` (tools nuevas como esqueletos que delegan en el núcleo, completadas en US1/US4) hasta pasar [TS-003]

**Checkpoint**: US3 verde — cualquier cambio posterior que rompa la regresión se detecta.

---

## Phase 4: User Story 2 — Configurar la inferencia de un análisis (Priority: P1)

**Goal**: configuración desde CLI (`--config=`) y MCP (`config`/`configPath`), validación, paridad, caché solo por defecto, guía de parámetros.

**Independent Test**: `configuration.feature`.

- [x] T012 [US2] Step definitions de `configuration.feature` en `engine/src/test/java/com/extractor/configbdd/ConfigurationSteps.java` (ejecutar: rojo) [TS-005, TS-006, TS-007, TS-008, TS-009, TS-010, TS-011, TS-012, TS-013]
- [x] T013 [US2] `ToolArguments.config(request)` (config xor configPath) y `ToolSchemas.analyzeProject()` con `config`/`configPath` en `engine/src/main/java/com/extractor/mcp/`; `AnalyzeProjectTool` pasa la config al núcleo (validación antes de escribir) [TS-007, TS-008, TS-010, TS-011, TS-012]
- [x] T014 [US2] `--config=<file>` en `engine/src/main/java/com/extractor/MicroserviceInferenceMain.java` (opciones en cualquier orden, error → stderr + salida 1 sin archivos) con prueba en `engine/src/test/java/com/extractor/cli/ConfigOptionTest.java` [TS-005, TS-006, TS-009]
- [x] T015 [US2] Reescribir `engine/CONFIGURATION.md`: tabla de parámetros (nombre, defecto, rango, etapa, efecto), formato y fusión, CLI/MCP, errores, correcciones opt-in, listas de palabras clave y configuración alineada recomendada, invariante de la salvaguarda de soporte, herramientas nuevas y recursos (FR-022) [TS-013]

**Checkpoint**: US2 verde.

---

## Phase 5: User Story 1 — Re-inferir sin volver a analizar (Priority: P1)

**Goal**: `reinfer_architecture` por `graphPath`/`jobId`, reproducción byte a byte, advertencias, errores, < 2 s en 500 componentes.

**Independent Test**: `reinfer.feature`.

- [x] T016 [US1] Step definitions de `reinfer.feature` en `engine/src/test/java/com/extractor/configbdd/ReinferSteps.java` (ejecutar: rojo) [TS-014, TS-015, TS-016, TS-017, TS-018, TS-019, TS-020, TS-021, TS-022]
- [x] T017 [P] [US1] Pruebas unitarias de `GraphSource` en `engine/src/test/java/com/extractor/service/GraphSourceTest.java` (ida y vuelta del grafo de los 6 demos, arquitectura hermana, versión, jobId válido/inválido/contención) (rojo) [TS-019, TS-020, TS-021]
- [x] T018 [US1] Deserialización de `ApiEndpoint`/`ApiSchema` (y modelos anidados necesarios) sin cambiar su serialización en `engine/src/main/java/com/extractor/model/`; `GraphSource` y `LoadedGraph` en `engine/src/main/java/com/extractor/service/` hasta pasar T017 (research D6)
- [x] T019 [US1] `ReinferArchitectureTool` en `engine/src/main/java/com/extractor/mcp/tools/` y `ToolSchemas.reinferArchitecture()`; advertencias en `_meta`; filtro `minViability` validado [TS-014, TS-015, TS-016, TS-017, TS-019, TS-020, TS-021, TS-022]
- [x] T020 [P] [US1] Esquema `schema/1.0.0/mcp/reinfer_architecture.response.schema.json`, entrada en `schema/gen/lib.mjs` `ENTRIES` y en el registro Java de pruebas de contrato, `schema/generated/` regenerado, fixture válido en `schema/fixtures/valid/mcp/` [TS-015] — desviación: sin `ENTRIES`/`schema/generated` ni fixtures TS (TS-028 de 005 fija 8 validadores; ver docs/SCHEMA.md)
- [x] T021 [US1] Medir TS-018 con el grafo sintético; si supera 2 s, indexar búsquedas `clusterId → Cluster` en `ClusterConsolidator`/`ViabilityScorer`/`MicroserviceNameGenerator` sin cambiar el orden de iteración [TS-018]

**Checkpoint**: US1 verde — criterio de salida de rendimiento verificado.

---

## Phase 6: User Story 4 — Evaluar una propuesta editada (Priority: P2)

**Goal**: `score_proposal` con fragmentos sobre la agrupación inferida.

**Independent Test**: `score-proposal.feature`.

- [x] T022 [US4] Step definitions de `score-proposal.feature` en `engine/src/test/java/com/extractor/configbdd/ScoreProposalSteps.java` (ejecutar: rojo) [TS-023, TS-024, TS-025, TS-026, TS-027, TS-028]
- [x] T023 [US4] `ProposalScorer` y `ProposalScore` en `engine/src/main/java/com/extractor/service/` (research D10) con prueba unitaria `engine/src/test/java/com/extractor/service/ProposalScorerTest.java` [TS-023, TS-025, TS-026, TS-027]
- [x] T024 [US4] `ScoreProposalTool` en `engine/src/main/java/com/extractor/mcp/tools/` y `ToolSchemas.scoreProposal()` [TS-024, TS-025, TS-026, TS-028]
- [x] T025 [P] [US4] Esquema `schema/1.0.0/mcp/score_proposal.response.schema.json` + `ENTRIES` + registro Java + `schema/generated/` + fixture válido [TS-024] — desviación: sin `ENTRIES`/`schema/generated` ni fixtures TS (TS-028 de 005 fija 8 validadores; ver docs/SCHEMA.md)

**Checkpoint**: US4 verde.

---

## Phase 7: User Story 5 — Recursos de documentación (Priority: P2)

**Goal**: cuatro recursos de solo lectura servidos desde el JAR.

**Independent Test**: `resources.feature`.

- [x] T026 [US5] Step definitions de `resources.feature` en `engine/src/test/java/com/extractor/configbdd/ResourcesSteps.java` (ejecutar: rojo) [TS-029, TS-030, TS-031, TS-032]
- [x] T027 [US5] `<resource>` sin filtrado en `engine/pom.xml` (docs y `../schema/1.0.0/**` bajo `static-inference/`), `McpResources` en `engine/src/main/java/com/extractor/mcp/` y registro con capacidad `resources` en `McpServerMain` [TS-029, TS-030, TS-031, TS-032]
- [x] T028 [P] [US5] Esquema `schema/1.0.0/inference-config.schema.json` (validación del recurso de defaults y de los ejemplos de la guía) con prueba de contrato `engine/src/test/java/com/extractor/schema/InferenceConfigSchemaTest.java` [TS-030]

**Checkpoint**: US5 verde.

---

## Phase 8: User Story 6 — Detección anidada (Priority: P3)

**Goal**: `detection.maxDepth` opcional con advertencia de módulos.

**Independent Test**: `detection.feature`.

- [x] T029 [US6] Step definitions de `detection.feature` en `engine/src/test/java/com/extractor/configbdd/DetectionSteps.java` (ejecutar: rojo) [TS-033, TS-034, TS-035, TS-036, TS-037, TS-038, TS-048]
- [x] T030 [US6] `ProjectTypeDetector.detect(Path, int)` + `Detection` en `engine/src/main/java/com/extractor/analyzer/` (research D12) con prueba `engine/src/test/java/com/extractor/analyzer/NestedDetectionTest.java`; integración en `ExtractionService` (advertencia, mensaje ambiguo con módulos) [TS-033, TS-034, TS-035, TS-036, TS-037, TS-038, TS-048]

**Checkpoint**: US6 verde.

---

## Phase 9: User Story 7 — Correcciones opcionales y parámetros por etapa (Priority: P3)

**Goal**: `dataJaccardMode`, listas independientes, invariante de soporte, efectos por etapa observables.

**Independent Test**: `corrections.feature`.

- [x] T031 [US7] Step definitions de `corrections.feature` en `engine/src/test/java/com/extractor/configbdd/CorrectionsSteps.java` (ejecutar: rojo) [TS-039, TS-040, TS-041, TS-042, TS-043, TS-044, TS-045, TS-046, TS-047]
- [x] T032 [US7] `recommendation.dataJaccardMode = data_cohesion` en `MicroserviceRecommendationEngine` y accesor de estado de soporte para la prueba de invariante en `ClusterConsolidator` [TS-039, TS-040, TS-041, TS-042]

**Checkpoint**: US7 verde.

---

## Phase 10: Polish & Cross-Cutting Concerns

- [x] T033 [P] Web: `STATIC_INFERENCE_INFERENCE_TOOLS=true` y `STATIC_INFERENCE_JOBS_DIR=<dataDir>/jobs` en el entorno del proceso del motor (`web/src/server/engine/`) con prueba `node:test` (FR-027)
- [x] T034 Step definitions de TS-049 en `engine/src/test/java/com/extractor/configbdd/RegressionSteps.java` (rojo) y eliminar las 3 entradas "feature 008" de `engine/spotbugs-exclude.xml` corrigiendo `DLS_DEAD_LOCAL_STORE` (`ProjectAnalyzer.analyzeSpringEvents`), `DLS_DEAD_LOCAL_STORE`/`UC_USELESS_CONDITION`/`WMI_WRONG_MAP_ITERATOR` (`ClusteringAlgorithm`) y `WMI_WRONG_MAP_ITERATOR` (`MicroserviceRecommendationEngine.aggregatePackageDependencies`) sin cambio de comportamiento (FR-028) [TS-001, TS-002, TS-049]
- [x] T035 [P] Actualizar `engine/ALGORITHMS.md` (parámetros por nombre, invariante de soporte), `engine/MCP.md` (tools nuevas, variables, recursos), `CHANGELOG.md` y `docs/SCHEMA.md` (definiciones nuevas aditivas en 1.0.0) (FR-022, FR-026)
- [ ] T036 Verificar gates: `make build`, `make test`, Checkstyle ≤ 4655, SpotBugs 0, `dotnet format`, determinismo y paridad; `git diff` sin cambios en `.feature`/`context.json`/aserciones de 001–007 (SC-009)
- [ ] T037 Validación final: clon limpio de la rama → `make build && make test`; evidencia de tiempos de `reinfer_architecture` (quickstart.md)

---

## Dependencies & Execution Order

- Setup (T001–T003) → Foundational (T004–T009) → US3 (T010–T011) → US2 (T012–T015) → US1 (T016–T021) → US4 (T022–T025) → US5 (T026–T028) → US6 (T029–T030) → US7 (T031–T032) → Polish (T033–T037).
- T005 depende de T004; T007 de T005 y T006; T009 de T007 y T008; T011 de T010; T013/T014 de T012 y T009; T018 de T017; T019 de T018 y T011; T021 de T019 y T003; T023 de T018; T024 de T023; T027 de T026; T030 de T029; T032 de T031; T036 de todo lo anterior; T037 de T036.
- US1 y US4 comparten `GraphSource` (T018); US7 reutiliza `ReinferArchitectureTool` (T019).

### Parallel Opportunities

- Setup: T002 ∥ T003 (T001 primero o en paralelo).
- Foundational: T004 ∥ T006 ∥ T008 (pruebas en archivos distintos).
- US1: T017 ∥ T020; US4: T025 ∥ T023; US5: T028 ∥ T027; Polish: T033 ∥ T035.

### Critical path

T001 → T004 → T005 → T007 → T009 → T010 → T011 → T016 → T018 → T019 → T021 → T036 → T037.

## Implementation Strategy

MVP = Setup + Foundational + US3 (refactor sin cambios observables, protegido por la línea base). Luego US2 (configuración), US1 (re-inferencia y criterio de salida), US4, US5, US6, US7 y pulido. Commits por grupo de tareas con alcance `008-configurable-inference`.
