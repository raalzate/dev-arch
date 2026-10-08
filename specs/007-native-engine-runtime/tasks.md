---
description: "Task list for 007-native-engine-runtime"
---

# Tasks: Integración runtime nativa del motor en dev-arch

**Input**: Design documents from `specs/007-native-engine-runtime/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md, tests/features/ (77 escenarios TS-001..TS-077, hash LOCKED)

**Tests**: TDD obligatorio (CONSTITUTION.md principio III). Cada tarea de pruebas / step definitions DEBE ejecutarse y fallar antes de su tarea de implementación. Prohibido modificar `.feature`, aserciones existentes (001–006, `analyze-route.test.ts`, `engine-path.test.ts`) o `context.json` para pasar.

**Dónde se trabaja**: raíz del producto `apps/dev-arch` del worktree `/Users/raul.alzate/Documents/maestria/maestria-devarch` (rama `007-native-engine-runtime`). Rutas relativas a esa raíz salvo `<monorepo>/.github/workflows/dev-arch.yml`. Comandos con JDK 17 vía `JAVA_HOME`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizable (archivos distintos, sin dependencias pendientes)
- **[USn]**: historia de usuario de spec.md
- Trazabilidad: listas explícitas `[TS-001, TS-002]`

---

## Phase 1: Setup

**Purpose**: dependencias, configuración de runners y soporte de pruebas

- [ ] T001 [P] Añadir `@modelcontextprotocol/sdk` (versión exacta 1.32.x) y `zod` `^3.25` a `web/package.json`; `npm install` en la raíz actualiza `package-lock.json` (research D1, E12)
- [ ] T002 [P] Añadir `playwright` 1.64.x a `devDependencies` de `package.json` raíz, script `test:e2e` (`DEVARCH_E2E=true DEVARCH_E2E_BROWSER=true`, `--tags @e2e`) y objetivo `test-e2e-browser` en `Makefile` (sin tocar `e2e`, bloqueado por TS-012 de 006) (research D11, E14)
- [ ] T003 [P] Añadir `.archview/` y `web/.archview/` a `.gitignore` del producto (research D7)
- [ ] T004 Ampliar `cucumber.mjs`: rutas `specs/006-devarch-monorepo/...` y `specs/007-native-engine-runtime/tests/features/**/*.feature`; filtro de tags `not @engine`, `not @e2e` salvo `DEVARCH_E2E_BROWSER=true`, `not @slow` salvo `DEVARCH_E2E=true` (research D12)
- [ ] T005 [P] Crear runner JVM `engine/src/test/java/com/extractor/runtimebdd/RunNativeEngineRuntimeFeaturesTest.java` (`@SelectDirectories("../specs/007-native-engine-runtime/tests/features")`, filtro `@engine`, glue `com.extractor.runtimebdd`) con `World.java`, `Hooks.java` y cliente MCP de prueba (`McpTestClient.java`, SDK Java `McpClient.sync` + `StdioClientTransport` sobre el jar o en proceso); ejecutar y ver escenarios `@engine` indefinidos (rojo)
- [ ] T006 [P] Crear soporte de aceptación 007 en `tests/acceptance/support/`: `fake-mcp-server.ts` (servidor MCP stdio con SDK TS; comportamientos por env: retardo, fases, advertencias, línea stderr, caída, archivo contador de lanzamientos, log de intervalos de llamada; escribe los tres JSON en `outputDir` con `meta.schema_version` 1.0.0), `zip-catalog.ts` (ZIP benignos y maliciosos generados en memoria: traversal, absoluta, letra de unidad, `\`, symlink, sobretamaño, bomba con tamaño declarado falso, exceso de entradas, duplicados, no-ZIP), `web-harness.ts` (invocación en proceso de route handlers con env y `ARCHVIEW_DATA_DIR` temporal, "reinicio" = recarga de módulos sobre el mismo directorio, reloj inyectable), `browser.ts` (Chromium, contextos aislados, `data-testid`)

**Checkpoint**: dependencias instaladas; runners descubren los 77 escenarios (todos indefinidos/rojos).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: núcleo del motor (lenguaje, fases), adaptador MCP con `language`/progreso, y base del servidor web (configuración, almacén, carga segura, locator). Bloquea todas las historias.

### Motor

- [ ] T007 [P] Escribir primero `engine/src/test/java/com/extractor/service/AnalysisLanguageTest.java` (parse `java|dotnet|auto|null`, mensaje `Invalid language '<x>'. Allowed: java, dotnet, auto`) y `AnalysisServiceLanguageTest.java` (JAVA/DOTNET no consultan el detector; AUTO mantiene error AMBIGUOUS con `language=java|dotnet` y fallback Java para UNKNOWN); verlas fallar
- [ ] T008 Implementar `engine/src/main/java/com/extractor/service/{AnalysisLanguage,AnalysisOptions}.java` y sobrecargas con `AnalysisOptions` en `AnalysisService.java` (firmas actuales delegan con AUTO) hasta pasar T007 (research D5)
- [ ] T009 [P] Escribir primero `engine/src/test/java/com/extractor/service/AnalysisServiceProgressTest.java` (DETECTION, EXTRACTION, INFERENCE en orden; NOOP por defecto; serialización idéntica con y sin listener); verla fallar
- [ ] T010 Implementar `engine/src/main/java/com/extractor/service/{AnalysisPhase,AnalysisProgressListener}.java` y emisión en `AnalysisService.java` hasta pasar T009 (research D3)
- [ ] T011 Escribir primero pruebas de contrato MCP en `engine/src/test/java/com/extractor/mcp/McpServerContractTest.java` (nuevos métodos, sin tocar los existentes) y `engine/src/test/java/com/extractor/mcp/tools/AnalyzeProjectToolTest.java`: `language` opcional en las 5 tools con `required` intacto; con `progressToken` 4 notificaciones `detection/extraction/inference/writing` (1..4 de 4) antes del resultado; sin token ninguna y salida byte-idéntica; `language` inválido → `isError` con el mensaje exacto; ambiguo con `auto` → mensaje con `Ambiguous project type` y `language=java|dotnet` [TS-048, TS-049, TS-051, TS-053, TS-054]; verlas fallar
- [ ] T012 Implementar `engine/src/main/java/com/extractor/mcp/ToolSchemas.java` (+`language`), `mcp/tools/AnalyzeProjectTool.java` (token de progreso vía `exchange`, fase WRITING, `language`) y `mcp/tools/{GetDependencyGraphTool,GetArchitectureTool,GetApiContractsTool,GetComponentMetricsTool}.java` (`language`) hasta pasar T011 (contracts/engine-mcp.md)

### Web

- [ ] T013 [P] Escribir primero `web/src/server/config.test.ts` (defaults de research D13; valores inválidos nombran la variable; `allowLocalPath` true solo en desarrollo o por `DEVARCH_ALLOW_LOCAL_PATH`); verla fallar
- [ ] T014 Implementar `web/src/server/config.ts` hasta pasar T013
- [ ] T015 [P] Escribir primero `web/src/server/jobs/job-store.test.ts` (UUID, rechazo de ids inválidos incluido `../`, escritura atómica, transiciones de data-model.md, `paths(id)`, `list`, `delete`); verla fallar
- [ ] T016 Implementar `web/src/server/jobs/job-store.ts` hasta pasar T015 (data-model.md)
- [ ] T017 [P] Escribir primero `web/src/server/upload/{stream-to-file,safe-extract,project-root}.test.ts` con el catálogo de `zip-catalog.ts` (conteo y corte por límite, `Content-Length` previo, validación del directorio central: `..`, absoluta, unidad, `\`, NUL, symlink, duplicados/colisión de mayúsculas, Σ declarado, nº entradas; extracción manual con conteo real; raíz = carpeta única de primer nivel); verlas fallar
- [ ] T018 Implementar `web/src/server/upload/{stream-to-file,safe-extract,project-root}.ts` hasta pasar T017 (research D8)
- [ ] T019 [P] Escribir primero `web/src/server/engine/engine-locator.test.ts` (reglas de 006 intactas + `ENGINE_JAVA_OPTS`, `DOTNET_ANALYZER_PATH`, args `[...opts, -jar, jar, --mcp]`); verla fallar
- [ ] T020 Implementar `web/src/server/engine/engine-locator.ts` reutilizando `resolveEngine` de `engine-path.ts` (sin modificar `engine-path.test.ts`) hasta pasar T019 (contracts/engine-client.md)

**Checkpoint**: motor acepta `language` y emite progreso; base web probada en unitarias.

---

## Phase 3: User Story 1 — Analizar un proyecto sin esperar (P1) 🎯 MVP

**Goal**: `POST /api/analyses` → 202; estado con fases; tres documentos; UI asíncrona Java y .NET.
**Independent Test**: TS-001..TS-015.

- [ ] T021 [US1] Escribir step definitions `tests/acceptance/steps/native-runtime-async.steps.ts` para [TS-001, TS-002, TS-003, TS-004, TS-005, TS-006, TS-007, TS-008, TS-009, TS-010, TS-011, TS-012] (web-harness + fake MCP; `@slow` con motor real); ejecutar y verlas fallar
- [ ] T022 [P] [US1] Escribir primero `web/src/server/engine/engine-client.test.ts` contra `fake-mcp-server.ts`: arranque perezoso singleton, `analyze` con `onPhase` (ignora regresiones), advertencias desde `_meta`, `isError` → `EngineToolError`/`AMBIGUOUS_PROJECT`, respuesta validada con `parseAnalyzeProjectResponse`; verla fallar
- [ ] T023 [US1] Implementar `web/src/server/engine/engine-client.ts` (camino feliz y errores de tool) hasta pasar T022 (research D1, contracts/engine-client.md)
- [ ] T024 [P] [US1] Escribir primero `web/src/server/jobs/job-runner.test.ts` (submit inmediato; extracción → `analyze_project` con `outputDir=<job>/out` → validación de los tres documentos con `@static-inference/schema` → `completed`; documento inválido → `failed/ENGINE_ERROR`; fases persistidas; semáforo `maxConcurrent`); verla fallar
- [ ] T025 [US1] Implementar `web/src/server/jobs/job-runner.ts` (pipeline, semáforo, cola FIFO) hasta pasar T024 (research D2, D7)
- [ ] T026 [US1] Implementar rutas `web/src/app/api/analyses/route.ts` (POST binario/multipart/JSON `localPath`, `language`, `ENGINE_NOT_BUILT`, `LOCAL_PATH_DISABLED`), `web/src/app/api/analyses/[id]/route.ts` (estado, `no-store`) y `web/src/app/api/analyses/[id]/[doc]/route.ts` (`graph|architecture|contracts`, `NOT_READY`, `ANALYSIS_FAILED`, `NOT_FOUND`) hasta pasar [TS-001, TS-002, TS-005, TS-006, TS-007, TS-010, TS-011, TS-012] (contracts/analyses-api.md)
- [ ] T027 [US1] Verificar con motor real (`DEVARCH_E2E=true`) [TS-003, TS-004, TS-008, TS-009]
- [ ] T028 [US1] Escribir step definitions `tests/acceptance/steps/native-runtime-browser.steps.ts` para [TS-013, TS-014, TS-015] (Playwright, `data-testid`); ejecutar con `make test-e2e-browser` y verlas fallar
- [ ] T029 [US1] Implementar `web/src/lib/analyses-client.ts` (subida binaria, polling 1 s / máx. 2 s, documentos) y adaptar `web/src/components/software-architecture-analyzer.tsx` + nuevo `web/src/components/analysis-progress.tsx` (selector de lenguaje, fases en español, `localStorage['devarch.activeJobId']` sin resultados, `data-testid` de plan nota 10) hasta pasar [TS-013, TS-014, TS-015]

**Checkpoint**: MVP — subir ZIP Java/.NET y ver propuestas vía jobs asíncronos.

---

## Phase 4: User Story 2 — Análisis concurrentes aislados que sobreviven a la recarga (P1)

**Goal**: aislamiento, persistencia, recuperación al reiniciar, serialización por proyecto, reanudación en el navegador.
**Independent Test**: TS-016..TS-022.

- [ ] T030 [US2] Escribir step definitions `tests/acceptance/steps/native-runtime-isolation.steps.ts` para [TS-016, TS-017, TS-018, TS-019, TS-020, TS-021, TS-022]; ejecutar y verlas fallar
- [ ] T031 [P] [US2] Ampliar primero `web/src/server/jobs/job-runner.test.ts` con `recoverOnStart` (`queued|running` → `failed/INTERRUPTED`) y mutex por `realpath(projectRoot)`; verla fallar
- [ ] T032 [US2] Implementar recuperación y mutex en `web/src/server/jobs/job-runner.ts` y crear `web/src/instrumentation.ts` (`register()` en runtime Node: recuperación + arranque del runner) hasta pasar T031 y [TS-018, TS-020, TS-021, TS-022]
- [ ] T033 [US2] Implementar reanudación en `web/src/components/software-architecture-analyzer.tsx` (al cargar, si existe `devarch.activeJobId`, consultar estado y retomar polling/resultados; mensaje de caducidad con opción de reanalizar) hasta pasar [TS-019]
- [ ] T034 [US2] Verificar con motor real [TS-016, TS-017] (`DEVARCH_E2E=true`, `make test-e2e-browser`); si [TS-017] o TS-064 revelan no reentrancia del motor, corregir en el núcleo o aplicar el fallback `MAX_CONCURRENT_ANALYSES=1` documentado (research R1)

**Checkpoint**: criterio de salida "dos análisis concurrentes no interfieren; recargar no pierde el job".

---

## Phase 5: User Story 3 — Carga segura y acotada (P1)

**Goal**: límites, zip-slip, cuota previa a la carga, registro de rechazos, TTL.
**Independent Test**: TS-023..TS-033.

- [ ] T035 [US3] Escribir step definitions `tests/acceptance/steps/native-runtime-upload-security.steps.ts` para [TS-023, TS-024, TS-025, TS-026, TS-027, TS-028, TS-029, TS-030, TS-031, TS-032, TS-033]; ejecutar y verlas fallar
- [ ] T036 [US3] Integrar en `web/src/app/api/analyses/route.ts` la verificación de cuota **antes** de leer el cuerpo (429 + `Retry-After`), los errores de `safe-extract` (400/413 con `entry`/`limit`), borrado del área en todo rechazo y registro de rechazos de seguridad sin contenido hasta pasar [TS-023, TS-024, TS-025, TS-027, TS-028, TS-029, TS-030, TS-031]
- [ ] T037 [US3] Manejar en `web/src/server/jobs/job-runner.ts` el tamaño real mayor al declarado durante la extracción (`failed/UNCOMPRESSED_TOO_LARGE`, borrado de `source/`) hasta pasar [TS-026]
- [ ] T038 [P] [US3] Escribir primero `web/src/server/jobs/cleaner.test.ts` (reloj inyectable; borra terminales con `finishedAt + TTL < now`, nunca activos, huérfanos > 1 h); verla fallar
- [ ] T039 [US3] Implementar `web/src/server/jobs/cleaner.ts` y su programación en `web/src/instrumentation.ts` hasta pasar T038 y [TS-032, TS-033]

**Checkpoint**: SC-005 y SC-011 verificables.

---

## Phase 6: User Story 4 — Visor de código restringido (P1)

**Goal**: `/api/source?jobId&path` contenido en la raíz del job.
**Independent Test**: TS-034..TS-039.

- [ ] T040 [US4] Escribir step definitions `tests/acceptance/steps/native-runtime-source.steps.ts` para [TS-034, TS-035, TS-036, TS-037, TS-038, TS-039]; ejecutar y verlas fallar
- [ ] T041 [P] [US4] Escribir primero `web/src/server/source/source-sandbox.test.ts` (catálogo de escapes: absoluta, `..`, `%2e%2e`, `\`, NUL, unidad, symlink saliente, otro job, directorio, inexistente, extensión, tamaño; respuesta 404 uniforme fuera de la raíz); verla fallar
- [ ] T042 [US4] Implementar `web/src/server/source/source-sandbox.ts` y reescribir `web/src/app/api/source/route.ts` (forma heredada `?path=` → 400) hasta pasar T041 y [TS-034, TS-035, TS-036, TS-037, TS-038] (research D10)
- [ ] T043 [US4] Adaptar `web/src/components/code-viewer.tsx` y `web/src/components/component-details.tsx` (prop `jobId`, ruta relativizada contra `projectRoot`) hasta pasar [TS-039]

**Checkpoint**: SC-006 verificable.

---

## Phase 7: User Story 5 — Importar resultados validados (P2)

**Goal**: `POST /api/analyses/import` validado contra el contrato 1.0.0.
**Independent Test**: TS-040..TS-047.

- [ ] T044 [US5] Escribir step definitions `tests/acceptance/steps/native-runtime-import.steps.ts` para [TS-040, TS-041, TS-042, TS-043, TS-044, TS-045, TS-046, TS-047]; ejecutar y verlas fallar
- [ ] T045 [P] [US5] Escribir primero `web/src/server/import/import-validator.test.ts` (fixtures `schema/fixtures/valid/*` aceptadas; `schema/fixtures/invalid/*` → violaciones con `document`/`pointer`/`message`; versión presente ≠ 1.0.0 → `UNSUPPORTED_SCHEMA_VERSION`; versión ausente → `SCHEMA_VIOLATION`; documento obligatorio ausente); verla fallar
- [ ] T046 [US5] Implementar `web/src/server/import/import-validator.ts` y `web/src/app/api/analyses/import/route.ts` (cuerpo por streaming con límite, job `origin: import` completado sin `source/`, `NO_SOURCES` en el visor) hasta pasar T045 y [TS-040, TS-041, TS-042, TS-043, TS-044, TS-045, TS-046]
- [ ] T047 [US5] Crear `web/src/components/import-dialog.tsx` (dos/tres archivos JSON, errores con puntero de campo) e integrarlo en el analizador hasta pasar [TS-047]

**Checkpoint**: SC-010 verificable; defecto 6 cerrado.

---

## Phase 8: User Story 6 — Progreso, advertencias, lenguaje y reutilización en el motor (P2)

**Goal**: caché, advertencias, `--language` en CLI, paridad y determinismo.
**Independent Test**: TS-048..TS-065.

- [ ] T048 [US6] Escribir step definitions JVM `engine/src/test/java/com/extractor/runtimebdd/{ProgressSteps,LanguageSteps,CacheSteps,WarningsSteps,ParitySteps}.java` para [TS-048, TS-049, TS-050, TS-051, TS-052, TS-053, TS-054, TS-055, TS-056, TS-057, TS-058, TS-059, TS-060, TS-061, TS-064]; ejecutar y ver fallar los no cubiertos por Foundational
- [ ] T049 [P] [US6] Escribir primero `engine/src/test/java/com/extractor/service/{TreeFingerprintTest,AnalysisCacheTest}.java` (exclusión de `output*.json` raíz; cambios de mtime/tamaño/alta/baja cambian la huella; LRU con capacidad; `0` desactiva; clave con lenguaje; cómputo único concurrente; no mutación tras `minViability`); verlas fallar
- [ ] T050 [US6] Implementar `engine/src/main/java/com/extractor/service/{TreeFingerprint,AnalysisCache}.java`, uso en `AnalysisService.java` para todas las vistas y wiring en `engine/src/main/java/com/extractor/mcp/McpServerMain.java` (`static-inference.cache.size` / `STATIC_INFERENCE_CACHE_SIZE`, 8) hasta pasar T049 y [TS-055, TS-056, TS-057, TS-058] (research D6)
- [ ] T051 [P] [US6] Escribir primero pruebas de advertencias: `engine/src/test/java/com/extractor/analyzer/JavaSpoonAnalyzerWarningsTest.java` (archivo no parseable → advertencia con ruta relativa), `AnalysisServiceWarningsTest.java` (0 componentes → `No analyzable source files found`), `AnalyzeProjectToolTest` (`_meta["static-inference/warnings"]` solo si hay; `content[0]` valida contra `analyze_project.response.schema.json` 1.0.0); verlas fallar
- [ ] T052 [US6] Implementar advertencias en `engine/src/main/java/com/extractor/analyzer/JavaSpoonAnalyzer.java`, `service/AnalysisService.java` y `mcp/tools/AnalyzeProjectTool.java` hasta pasar T051 y [TS-059, TS-060, TS-061] (research D4)
- [ ] T053 [P] [US6] Escribir primero `engine/src/test/java/com/extractor/cli/CliLanguageAndWarningsTest.java` (`--language=java|dotnet|auto`; inválido → exit 1, mensaje exacto, sin archivos; `[warning]` en stderr; sin la opción, salidas byte-idénticas); verla fallar
- [ ] T054 [US6] Implementar `--language` y advertencias en stderr en `engine/src/main/java/com/extractor/MicroserviceInferenceMain.java` hasta pasar T053 y [TS-050, TS-052, TS-053]
- [ ] T055 [US6] Escribir y pasar `engine/src/test/java/com/extractor/integration/NativeRuntimeParityTest.java` (CLI vs MCP con `language` explícito y `auto`; consecutivas; cacheada vs nueva; con/sin token; concurrente vs secuencial sobre `java-standar` y `dotnet-ecommerce`) [TS-064]
- [ ] T056 [US6] Escribir step definitions `tests/acceptance/steps/native-runtime-warnings.steps.ts` para [TS-062, TS-063, TS-065]; verlas fallar; implementar el panel de advertencias (`data-testid="analysis-warnings"`) en `web/src/components/analysis-progress.tsx` y la copia `_meta` → `job.warnings` en `job-runner.ts` hasta pasar

**Checkpoint**: SC-007 y SC-008 verificables; FR-023..FR-027 completos.

---

## Phase 9: User Story 7 — Servicio del motor resistente a fallos (P2)

**Goal**: proceso único, reinicio con backoff, indisponibilidad temporal, timeout con reciclado, stderr por job.
**Independent Test**: TS-066..TS-072.

- [ ] T057 [US7] Escribir step definitions `tests/acceptance/steps/native-runtime-resilience.steps.ts` para [TS-066, TS-067, TS-068, TS-069, TS-070, TS-071, TS-072]; ejecutar y verlas fallar
- [ ] T058 [P] [US7] Ampliar primero `web/src/server/engine/engine-client.test.ts` (un solo lanzamiento para N análisis; caída → `EngineCrashedError` < 1 s y relanzamiento; > 3 caídas en 60 s → `EngineUnavailableError`; espera durante reinicio; timeout → `EngineTimeoutError` y `recycleWhenIdle`; stderr → `[engine]` y `onStderr` por job en vuelo); verla fallar
- [ ] T059 [US7] Implementar ciclo de vida, backoff, timeout/reciclado y stderr en `web/src/server/engine/engine-client.ts`, y en `job-runner.ts` el mapeo a `ENGINE_CRASHED`/`ENGINE_UNAVAILABLE`/`TIMEOUT` con mensaje resumido y `engine.log` del job, hasta pasar T058 y [TS-066, TS-067, TS-068, TS-069, TS-070, TS-071, TS-072] (research D14)

**Checkpoint**: SC-009 verificable.

---

## Phase 10: User Story 8 — Compatibilidad del análisis síncrono (P3)

**Goal**: `/api/analyze` igual hacia fuera, aislado por petición, obsoleto; UI no la usa; artefactos bloqueados intactos.
**Independent Test**: TS-073..TS-077 + escenarios 006 TS-014..TS-019 + `analyze-route.test.ts`.

- [ ] T060 [US8] Escribir step definitions `tests/acceptance/steps/native-runtime-compat.steps.ts` para [TS-073, TS-074, TS-075, TS-076, TS-077]; ejecutar y verlas fallar
- [ ] T061 [US8] Reescribir `web/src/app/api/analyze/route.ts` (job `origin: sync`, `safe-extract`, `execFile` con `cwd=<job>/out`, lectura desde `<job>/out`, cabeceras `Deprecation`/`Link`) manteniendo verdes, sin modificarlos, `web/src/server/engine/analyze-route.test.ts` y los escenarios 006 [TS-073, TS-074] (research D9)
- [ ] T062 [US8] Verificar [TS-075] (la UI solo llama a `/api/analyses`) y [TS-076, TS-077] (diff contra `889c95a` de `.feature`, `context.json` y aserciones de 001–006; Checkstyle 4763, SpotBugs, `dotnet format` sin tolerancia)

**Checkpoint**: compatibilidad hacia atrás verificada.

---

## Phase 11: Polish & Cross-Cutting Concerns

- [ ] T063 Actualizar `<monorepo>/.github/workflows/dev-arch.yml`: filtro `acceptance` + `apps/dev-arch/specs/007-*/tests/**`; job `e2e-browser` (`if` compuesto web/engine-java/engine-dotnet/acceptance, JDK 17, .NET 8, Node 20, `make build`, `npx playwright install --with-deps chromium`, `make test-e2e-browser`, `timeout-minutes: 30`); confirmar que TS-025..TS-030 de 006 siguen verdes (research D11, E13)
- [ ] T064 [P] Documentar variables y flujo en `web/docs/ENVIRONMENT.md` y `web/docs/DEVELOPERS.md` (research D13), `language`/progreso/`_meta`/caché en `engine/MCP.md` y `--language` en `engine/README.md`; entrada en `CHANGELOG.md` (sin bump de contrato)
- [ ] T065 [P] Eliminar del frontend el almacenamiento de resultados en `localStorage` y código muerto de la subida síncrona en `web/src/components/software-architecture-analyzer.tsx`
- [ ] T066 Gates completos con JDK 17: `make test` (incluye `mvn -B verify` con Checkstyle ≤ 4763 y SpotBugs 0, `dotnet format --verify-no-changes`, `schema-check`, web, aceptación sin `@slow`), `DEVARCH_E2E=true make test-acceptance`, `make test-e2e-browser`; `testify-tdd.sh verify-hash` para 001–007 [TS-076, TS-077]
- [ ] T067 Ejecutar `specs/007-native-engine-runtime/quickstart.md` de punta a punta y regenerar el tablero iikit

---

## Dependencies & Execution Order

- **Setup (T001–T006)**: T001 ∥ T002 ∥ T003 ∥ T005 ∥ T006; T004 tras T002. 
- **Foundational (T007–T020)**: depende de Setup. Motor: T007 → T008; T009 → T010; T008, T010 → T011 → T012. Web: T013 → T014; T015 → T016; T017 → T018; T019 → T020; las cuatro cadenas web en paralelo con el motor. Bloquea todas las historias.
- **US1 (T021–T029)**: T021 primero (rojo); T022 → T023; T024 → T025 (requiere T016, T018, T023); T026 requiere T014, T025; T027 requiere T012 + `make build`; T028 → T029 (requiere T026).
- **US2 (T030–T034)**: depende de US1 (T025, T026, T029). T031 → T032; T033 tras T029.
- **US3 (T035–T039)**: depende de US1 (T026). T036, T037 tras T035; T038 → T039 (T039 requiere T032 por `instrumentation.ts`).
- **US4 (T040–T043)**: depende de Foundational (T016) y US1 (T026 para jobs completados). T041 → T042 → T043.
- **US5 (T044–T047)**: depende de Foundational (T016) y de T042 (respuesta `NO_SOURCES`). T045 → T046 → T047.
- **US6 (T048–T056)**: depende de Foundational (T012). T049 → T050; T051 → T052; T053 → T054; T055 tras T050, T052, T054; T056 requiere T025, T029.
- **US7 (T057–T059)**: depende de US1 (T023, T025). T058 → T059.
- **US8 (T060–T062)**: depende de Foundational (T016, T018). T061 tras T060; T062 tras T029.
- **Polish (T063–T067)**: tras todas las historias; T066 → T067.

**Critical path**: T001 → T006 → T015 → T016 → T024 → T025 → T026 → T028 → T029 → T030 → T032 → T034 → T063 → T066 → T067 (motor en paralelo: T007 → T008 → T011 → T012 → T027).

### Parallel batches

- Setup: [T001, T002, T003, T005, T006]
- Foundational: [T007, T009, T013, T015, T017, T019]; luego [T008, T010, T014, T016, T018, T020]
- US1: [T022, T024]
- Tras US1: US3 (T035–T039), US4 (T040–T043), US6 motor (T048–T055) y US7 (T057–T059) en paralelo con US2
- US6: [T049, T051, T053]
- Polish: [T064, T065]

## Implementation Strategy

1. **MVP** = Setup + Foundational + US1 + US2 → criterio de salida de la Fase 3 (SC-001, SC-002, SC-003).
2. Incremento 2 (seguridad, obligatorio antes de exponer la web): US3 + US4.
3. Incremento 3: US6 (motor completo) + US7 (resiliencia).
4. Incremento 4: US5 (importación) + US8 (compatibilidad verificada) + Polish.

## Notes

- No se modifican `.feature` ni aserciones (001–007); si un escenario parece incorrecto, re-ejecutar `/iikit-04-testify`.
- `make e2e` sigue imprimiendo el marcador de la feature 011 (TS-012 de 006); la prueba de navegador usa `make test-e2e-browser`.
- El contrato de datos permanece en 1.0.0; las advertencias viajan en `_meta` (pendiente de confirmación del usuario, research D4).
