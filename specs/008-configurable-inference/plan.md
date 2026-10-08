# Implementation Plan: Extracción e inferencia separadas y configurables

**Branch**: `008-configurable-inference` | **Date**: 2026-10-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/008-configurable-inference/spec.md`

## Summary

`AnalysisService` se divide en `ExtractionService` (detección + Spoon/Roslyn + dependencias de proyecto + escaneo de secretos → `ExtractionResult`) e `InferenceService` (función pura `infer(InferenceInput, InferenceConfig)` → `ConsolidatedArchitecture`, sin E/S); `AnalysisService` queda como fachada con las firmas actuales. Todos los literales de `com.extractor.inference` que llegan a una salida pasan a un record `InferenceConfig` (records anidados por etapa) cuyo `defaults()` reproduce exactamente los valores vigentes; se carga con fusión parcial y validación estricta desde un archivo JSON (`--config=<file>` en la CLI; `configPath` en MCP) o desde un objeto (`config` en MCP). Dos herramientas MCP nuevas —`reinfer_architecture` y `score_proposal`— operan sobre un grafo ya extraído (`graphPath` o `jobId` resuelto en `STATIC_INFERENCE_JOBS_DIR`) y solo se registran con `STATIC_INFERENCE_INFERENCE_TOOLS=true` (por defecto siguen 5 herramientas: aserciones bloqueadas de 001/005). El servidor declara la capacidad `resources` con cuatro recursos de solo lectura empaquetados en el JAR (`algorithms`, `configuration`, `configuration/defaults`, `schema`). `ProjectTypeDetector` gana búsqueda anidada opcional (`detection.maxDepth`, 0 por defecto). Correcciones opt-in: `recommendation.dataJaccardMode` y listas de palabras clave independientes; la salvaguarda de soporte "solo raíz" se documenta como equivalente al grupo completo (invariante probado). El contrato se amplía dentro de 1.0.0 con `inference-config.schema.json` y dos esquemas de respuesta MCP. Regresión: línea base `baseline-v1.2.0` (6 proyectos × 3 documentos) capturada desde `7bc8170` antes de tocar código.

## Technical Context

**Language/Version**: Java 17 (motor, Maven); TypeScript 5 / Node ≥ 20 (paquete `schema/` generado, cliente MCP de la web); C# .NET 8 sin cambios
**Primary Dependencies**: existentes — Jackson 2.20 (records, árbol JSON para fusión/validación), MCP Java SDK 1.1.0 (`SyncResourceSpecification`), Spoon, JUnit 5, Cucumber-JVM 7, networknt json-schema-validator (pruebas de contrato); **0 dependencias nuevas** (principio VI)
**Storage**: sistema de archivos — grafos y arquitecturas ya escritos por `analyze_project`/CLI; área de jobs de la web (`<ARCHVIEW_DATA_DIR>/jobs/<id>/out/`)
**Testing**: JUnit 5 (unitarias y contrato MCP), Cucumber-JVM (runner nuevo `RunConfigurableInferenceFeaturesTest` para `specs/008-configurable-inference/tests/features`), `node:test` (web: entorno del motor), `npm --prefix schema test/check`
**Target Platform**: JVM 17 (CLI y modo servidor de larga vida); web Node 20
**Project Type**: producto web + motor (monorepo `apps/dev-arch`); el cambio vive en `engine/`, con toques en `schema/`, `web/src/server/engine/` y documentación
**Performance Goals**: `reinfer_architecture` < 2 s sobre grafo sintético de 500 componentes en el servidor en marcha (FR-017, SC-003); `score_proposal` del mismo orden
**Constraints**: salidas por defecto byte-idénticas a `baseline-v1.2.0` (FR-005, SC-001); contrato 1.0.0 sin cambio de versión ni de documentos existentes (FR-026); aserciones/`.feature`/`context.json` de 001–007 intactos; Checkstyle `sun_checks` ≤ 4655 (CI 4763, no se sube), SpotBugs 0 con 3 exclusiones menos (FR-028); `dotnet format` limpio; Constitución sin enmiendas
**Scale/Scope**: 7 historias, 29 FR, 10 SC; ~14 clases Java nuevas, ~10 modificadas, 3 esquemas nuevos, 1 cambio pequeño en la web, 2 guías reescritas

## Constitution Check

*GATE: evaluado antes de research y re-evaluado tras el diseño.*

```
CONSTITUTION GATE ACTIVE — CONSTITUTION.md v1.0.0 (6 principios + Quality Standards + Workflow + Governance)
```

| Principio / regla | Evaluación | Estado |
|-------------------|------------|--------|
| I. CLI operativo; JSON = contrato; misma salida CLI/MCP | `--config` y `config`/`configPath` son opcionales; `InferenceConfig.defaults()` = literales vigentes; regresión byte a byte de 18 documentos en CLI y MCP contra `baseline-v1.2.0` (research D1, D9); correcciones de comportamiento solo opt-in (D7); 5 herramientas por defecto (D5); contrato 1.0.0 sin bump (D8) | PASS |
| II. Lógica en el núcleo; adaptadores delgados | `ExtractionService`, `InferenceService`, `InferenceConfigLoader`, `GraphSource`, `ProposalScorer` en `com.extractor.service`/`com.extractor.inference.config`; `MicroserviceInferenceMain` y las tools MCP solo parsean argumentos y serializan; `AnalysisService` fachada (D2) | PASS |
| III. TDD; aserciones intactas; pruebas existentes pasan | testify antes de tasks; cada tarea de producción precedida por prueba roja; línea base capturada antes del primer cambio de código; verificación de `git diff` sobre `.feature`/`context.json`/aserciones de 001–007 | PASS |
| IV. Determinismo | Inferencia pura sin E/S ni tiempo; mismas estructuras de iteración (`Set.of` con el mismo orden de inserción para `roleKeywords` de evidencia, research D3); pruebas de doble ejecución byte a byte para reinfer/score | PASS |
| V. Degradación con errores claros | Validación de configuración con ruta JSON del parámetro; errores MCP `isError` con mensajes accionables; reinfer sin arquitectura hermana → advertencia en `_meta` (D6) | PASS |
| VI. Huella mínima | 0 dependencias nuevas; recursos empaquetados en el fat JAR; sin infraestructura | PASS |
| Quality: contract tests de tools MCP | Pruebas de contrato de entradas/salidas de las dos tools nuevas y validación de respuestas contra los esquemas nuevos | PASS |
| Quality: análisis estático resuelto | 3 exclusiones heredadas "feature 008" eliminadas con limpieza sin cambio de comportamiento; ratchet sin subir | PASS |
| Workflow: breaking schema ⇒ bump | Sin cambios breaking: definiciones nuevas aditivas (D8) | PASS |
| Governance: no enmendar | Sin enmiendas | PASS |

**Post-design re-check**: PASS. Riesgos vigilados en Complexity Tracking.

## Architecture

```text
 CLI (MicroserviceInferenceMain)          MCP server (McpServerMain, stdio)                 Web (Next.js)
  args: <project> <out> [--language=]      tools: analyze_project(+config|configPath),        engine-client spawns
        [--config=<file>]                         get_* (unchanged),                          `--mcp` with env
        │                                         reinfer_architecture*, score_proposal*      STATIC_INFERENCE_INFERENCE_TOOLS=true
        │                                  resources: algorithms, configuration,              STATIC_INFERENCE_JOBS_DIR=<data>/jobs
        │                                             configuration/defaults, schema
        ▼                                         │  (* only with INFERENCE_TOOLS=true)
 ┌────────────────────────────────────── shared core (com.extractor.service) ───────────────────────────────────────┐
 │ InferenceConfigLoader ── JSON file/object → merge onto defaults → validate → InferenceConfig                    │
 │ AnalysisService (facade, AnalysisCache only for default config)                                                  │
 │    ├─ ExtractionService: ProjectTypeDetector(maxDepth) → LanguageAnalyzer → DependencyGraph                      │
 │    │                     + projectDependencies + SecretLocationScanner → ExtractionResult(+warnings)             │
 │    └─ InferenceService.infer(InferenceInput, InferenceConfig) → ConsolidatedArchitecture (pure)                  │
 │ GraphSource: graphPath | jobId(+JOBS_DIR) → DependencyGraph + sibling *_architecture.json project metadata       │
 │ ProposalScorer: graph + components[] + config → ProposalScore (fragments over inferred clusters)                 │
 └──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
        ▼ InferenceConfig threaded through
 com.extractor.inference: InferenceEngine → ClusteringAlgorithm(clustering) → MetricsCalculator
   → MicroserviceRecommendationEngine(recommendation) → ClusterConsolidator(consolidation, evidence)
   → InterClusterGraph(evidence) → MicroserviceNameGenerator(naming) → ViabilityScorer(viability)
```

## Design Notes

1. **Línea base primero** (fase fundacional): `baseline-v1.2.0/<project>/{output,output_architecture,output_entrypoints}.json` para los 6 proyectos, generados con el motor de `7bc8170` (worktree temporal) sobre las copias herméticas de `DemoOutputs`, con `${REPO}` como marcador. Una prueba de regresión compara byte a byte la salida CLI (proceso `java -jar`) y MCP (`AnalyzeProjectTool.handle`). Cubre FR-005, SC-001.
2. **Configuración** (`com.extractor.inference.config`): `InferenceConfig` + records `DetectionConfig`, `ClusteringConfig`, `EvidenceConfig`, `ConsolidationConfig`, `ViabilityConfig` (+`RationaleConfig`), `RecommendationConfig`, `NamingConfig`; `InferenceConfig.defaults()`; `InferenceConfigLoader.fromJson(JsonNode)`, `fromFile(Path)`, `toJson(config)`; `InvalidConfigException extends IllegalArgumentException` con la ruta del parámetro. Formato y reglas: [contracts/inference-config.md](./contracts/inference-config.md), research D3–D4. FR-004..FR-009.
3. **Inferencia parametrizada**: cada clase de `com.extractor.inference` recibe su sección por constructor; los constructores actuales delegan a `InferenceConfig.defaults()` (pruebas existentes intactas). `MicroserviceNameGenerator` (estático) gana sobrecarga con `NamingConfig`. Mapeo literal → parámetro en [data-model.md](./data-model.md). FR-004, FR-005, FR-025.
4. **Separación de etapas** (`com.extractor.service`): `ExtractionResult` (grafo, dependencias de proyecto, ubicaciones de secretos, advertencias), `InferenceInput` (grafo, dependencias, secretos), `ExtractionService`, `InferenceService`; `MicroserviceRecommendationEngine` gana una sobrecarga que recibe las ubicaciones de secretos ya calculadas (el escaneo se mueve a la extracción, mismo resultado). `AnalysisService` compone; `AnalysisCache` solo con configuración por defecto (FR-011). FR-001..FR-003.
5. **Fuentes de grafo** (`GraphSource`): `fromPath(Path)` y `fromJob(String id, Path jobsDir)` (id `^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$`, ruta `<jobsDir>/<id>/out/output.json`, contención tras `toRealPath`). Lee con Jackson (`FAIL_ON_UNKNOWN_PROPERTIES=false`), exige `meta.schema_version == SchemaVersion.CURRENT` y `components` array; carga `project_metadata.external_dependencies` y `secrets_locations` del `<base>_architecture.json` hermano o advierte. FR-012..FR-016, research D6.
6. **Tools MCP nuevas**: `ReinferArchitectureTool`, `ScoreProposalTool`, `ToolSchemas.reinferArchitecture()/scoreProposal()`, `ToolArguments.config(request)` (config|configPath, mutuamente excluyentes); `McpServerMain.createToolSpecs(service, inferenceTools)`; `start()` lee `STATIC_INFERENCE_INFERENCE_TOOLS`. Advertencias en `_meta["static-inference/warnings"]` (mismo mecanismo de 007). Contrato: [contracts/engine-mcp.md](./contracts/engine-mcp.md). FR-012, FR-018, FR-027, FR-029.
7. **Evaluación de propuestas** (`ProposalScorer`): infiere clústeres del grafo con la config, intersecta la lista con cada clúster (orden de miembros del clúster) → fragmentos con métricas recalculadas por `MetricsCalculator`; `ViabilityScorer` + acciones + nombre con `MicroserviceNameGenerator` sobre los fragmentos. Research D10. FR-018..FR-020.
8. **Recursos MCP** (`McpResources`): `static-inference://algorithms` (text/markdown, `ALGORITHMS.md`), `static-inference://configuration` (text/markdown, `CONFIGURATION.md`), `static-inference://configuration/defaults` (application/json, `InferenceConfigLoader.toJson(defaults())`), `static-inference://schema` (application/json, paquete `{schema_version, schemas:{<ruta>: <esquema>}}`); los `.md` y `schema/1.0.0/**` se copian al JAR con un `<resource>` Maven sin filtrado bajo `static-inference/`. FR-021.
9. **Detección anidada**: `ProjectTypeDetector.detect(Path, int maxDepth)` → `Detection(type, moduleDirs)`; con raíz sin marcadores y `maxDepth>0`, recorrido limitado ignorando `target, build, bin, obj, node_modules, .git, .svn, .hg, .idea, .vs, out, dist`; resultado ordenado. Advertencia `Nested project markers found: <dirs>`. FR-023, FR-024.
10. **CLI**: `parseOptions` reconoce `--language=` y `--config=` en cualquier orden desde `args[2]`; error de config → mensaje y salida 1 antes de analizar. FR-006.
11. **Contrato** (`schema/1.0.0/`): `inference-config.schema.json`, `mcp/reinfer_architecture.response.schema.json` (`$ref` a arquitectura), `mcp/score_proposal.response.schema.json`; `ENTRIES` de `schema/gen/lib.mjs` y el registro Java ampliados; `schema/generated/` regenerado; fixtures válidos de las respuestas nuevas. FR-026, research D8.
12. **Web**: el entorno del proceso del motor incluye `STATIC_INFERENCE_INFERENCE_TOOLS=true` y `STATIC_INFERENCE_JOBS_DIR=<dataDir>/jobs` (prueba `node:test`). Sin UI. FR-027.
13. **SpotBugs**: eliminar las 3 entradas "feature 008" de `spotbugs-exclude.xml` corrigiendo `DLS_DEAD_LOCAL_STORE`, `UC_USELESS_CONDITION`, `WMI_WRONG_MAP_ITERATOR` sin cambio de comportamiento (la regresión lo garantiza). FR-028.
14. **Documentación**: `CONFIGURATION.md` reescrita (tabla de parámetros con nombre/defecto/rango/efecto/etapa, formato, CLI/MCP, herramientas nuevas, correcciones opt-in, recursos); `ALGORITHMS.md` referencia parámetros por nombre; `MCP.md` y `CHANGELOG.md` actualizados. FR-022.

## Project Structure

```text
engine/
├── src/main/java/com/extractor/
│   ├── inference/config/        # NEW InferenceConfig + section records, InferenceConfigLoader, InvalidConfigException
│   ├── inference/               # MOD ClusteringAlgorithm, InterClusterGraph, ClusterConsolidator, ViabilityScorer,
│   │                            #     MicroserviceNameGenerator, MicroserviceRecommendationEngine, InferenceEngine
│   ├── service/                 # NEW ExtractionService, ExtractionResult, InferenceService, InferenceInput, GraphSource,
│   │                            #     LoadedGraph, ProposalScorer, ProposalScore; MOD AnalysisService, AnalysisOptions
│   ├── analyzer/                # MOD ProjectTypeDetector (+Detection)
│   ├── mcp/                     # MOD McpServerMain, ToolSchemas; NEW McpResources
│   ├── mcp/tools/               # NEW ReinferArchitectureTool, ScoreProposalTool; MOD AnalyzeProjectTool, ToolArguments
│   └── MicroserviceInferenceMain.java   # MOD --config
├── src/test/java/com/extractor/configbdd/   # NEW Cucumber-JVM steps + runner for 008
├── src/test/resources/baseline-v1.2.0/      # NEW regression baseline (6 × 3)
├── spotbugs-exclude.xml                     # MOD −3 legacy entries
├── pom.xml                                  # MOD unfiltered resources (docs + schema)
├── ALGORITHMS.md, CONFIGURATION.md, MCP.md  # MOD
schema/1.0.0/inference-config.schema.json, schema/1.0.0/mcp/{reinfer_architecture,score_proposal}.response.schema.json
schema/gen/lib.mjs, schema/generated/*, schema/fixtures/valid/mcp/*
web/src/server/engine/engine-locator.ts (+test)      # env of the engine process
specs/008-configurable-inference/tests/features/*.feature
```

## Complexity Tracking

| Riesgo / desviación | Por qué | Mitigación |
|---------------------|---------|------------|
| Herramientas nuevas tras variable de entorno | Aserciones bloqueadas de 001 (TS-016) y 005 exigen exactamente 5 herramientas | Pendiente de confirmar (spec Clarifications); la web siempre las habilita; documentado en MCP.md |
| Grafo deserializado ≠ grafo en memoria | La re-inferencia debe reproducir byte a byte | Prueba SC-002 en los 6 proyectos; Jackson con setters existentes; `interface` duplicado aceptado |
| Orden de iteración de `Set.of` en `InterClusterGraph` | Elegir el rol por iteración de `Set.of` es sensible al orden de inserción | Construir con `Set.of(array)` en el orden vigente (research D3); regresión |
| Tiempo de reinfer en 500 componentes | `ClusterConsolidator`/`InterClusterGraph` tienen búsquedas lineales | Medición temprana con grafo sintético; optimizar con índices `clusterId → Cluster` sin cambiar el orden si supera 2 s |

## Requirement Traceability

| Requirement | Design notes / tasks |
|---|---|
| FR-001, FR-002, FR-003 | DN 4 (stage split, facade, secrets in extraction) — T008, T009 |
| FR-004, FR-005 | DN 2, DN 3, DN 1 — T004..T007, T010 |
| FR-006 | DN 10 — T014 |
| FR-007, FR-008, FR-009 | DN 2, DN 6 (config xor configPath, partial merge, validation) — T004, T005, T013 |
| FR-010, FR-011 | research D9 (parity, cache only with defaults) — T009, T012 |
| FR-012, FR-013, FR-014, FR-015, FR-016, FR-017 | DN 5, DN 6 — T016..T021 |
| FR-018, FR-019, FR-020 | DN 7 — T022..T025 |
| FR-021 | DN 8 — T026..T028 |
| FR-022 | DN 14 — T015, T035 |
| FR-023, FR-024 | DN 9 — T029, T030 |
| FR-025 | research D7 — T031, T032 |
| FR-026 | DN 11 — T020, T025, T028 |
| FR-027 | DN 6, DN 12 — T011, T033 |
| FR-028 | DN 13 — T034 |
| FR-029 | DN 6 — T019, T024 |
| SC-001 | DN 1 — T001, T010 |
| SC-002 | DN 5 — T016, T019 |
| SC-003 | research D13 — T003, T021 |
| SC-004 | DN 2, DN 14 — T013, T015 |
| SC-005 | DN 3 — T006, T031 |
| SC-006 | DN 2 — T004, T012 |
| SC-007 | DN 7 — T022, T023 |
| SC-008 | DN 8 — T026, T027 |
| SC-009 | DN 13, Constraints — T034, T036 |
| SC-010 | DN 9 — T029, T030 |
