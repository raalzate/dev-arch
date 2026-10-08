---
description: "Task list for 007-native-engine-runtime"
---

# Tasks: Integración runtime nativa del motor en dev-arch

**Input**: Design documents from `specs/007-native-engine-runtime/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md, tests/features/ (87 escenarios TS-001, TS-002, TS-003, TS-004, TS-005, TS-006, TS-007, TS-008, TS-009, TS-010, TS-011, TS-012, TS-013, TS-014, TS-015, TS-016, TS-017, TS-018, TS-019, TS-020, TS-021, TS-022, TS-023, TS-024, TS-025, TS-026, TS-027, TS-028, TS-029, TS-030, TS-031, TS-032, TS-033, TS-034, TS-035, TS-036, TS-037, TS-038, TS-039, TS-040, TS-041, TS-042, TS-043, TS-044, TS-045, TS-046, TS-047, TS-048, TS-049, TS-050, TS-051, TS-052, TS-053, TS-054, TS-055, TS-056, TS-057, TS-058, TS-059, TS-060, TS-061, TS-062, TS-063, TS-064, TS-065, TS-066, TS-067, TS-068, TS-069, TS-070, TS-071, TS-072, TS-073, TS-074, TS-075, TS-076, TS-077, TS-078, TS-079, TS-080, TS-081, TS-082, TS-083, TS-084, TS-085, TS-086, TS-087, hash LOCKED)

**Tests**: TDD obligatorio (CONSTITUTION.md principio III). Cada tarea de pruebas / step definitions DEBE ejecutarse y fallar antes de su tarea de implementación. Prohibido modificar `.feature`, aserciones existentes (001–006, `analyze-route.test.ts`, `engine-path.test.ts`) o `context.json` para pasar.

**Dónde se trabaja**: raíz del producto `apps/dev-arch` del worktree `/Users/raul.alzate/Documents/maestria/maestria-devarch` (rama `007-native-engine-runtime`). Rutas relativas a esa raíz salvo `<monorepo>/.github/workflows/dev-arch.yml`. Comandos con JDK 17 vía `JAVA_HOME`.

**Reutilización de steps de 006 (hallazgo A5)**: Cucumber-JS comparte las definiciones de steps entre features; los escenarios de 007 que usan el mismo texto que 006 **reutilizan** su definición (no se redefinen, lo que además provocaría pasos ambiguos): `the product is built`, `the product is built with the .NET analyzer staged next to the engine`, `the staged engine archive does not exist`, `no engine path override is configured`, `the environment has no ENGINE_JAR_PATH and no JAVA_HOME`, `the environment has JAVA_HOME {string}`, `the environment has ENGINE_JAR_PATH {string}`, `the web working directory is {string}` (TS-011, TS-072), `the product continuous integration definition`, `the engine jobs are inspected`, `static analysis runs with the SpotBugs exclude filter`, `Checkstyle runs with a maximum of {int} allowed violations`, `the .NET format verification runs without tolerating failure` (TS-077). Los steps nuevos de 007 leen y escriben el mismo `DevArchWorld` (`this.data.resolveEnv`, `resolveCwd`, `workflow`) que esas definiciones.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizable (archivos distintos, sin dependencias pendientes)
- **[USn]**: historia de usuario de spec.md
- Trazabilidad: listas explícitas `[TS-001, TS-002]`

---

## Phase 1: Setup

**Purpose**: dependencias, configuración de runners, soporte de pruebas y ancla estable de 006

- [x] T001 [P] Añadir `@modelcontextprotocol/sdk` (versión exacta 1.32.x) y `zod` `^3.25` a `web/package.json`; `npm install` en la raíz actualiza `package-lock.json` (research D1, E12)
- [x] T002 [P] Añadir `playwright` 1.64.x a `devDependencies` de `package.json` raíz, script `test:e2e` (`DEVARCH_E2E=true DEVARCH_E2E_BROWSER=true`, `--tags @e2e`) y objetivo `test-e2e-browser` en `Makefile` (sin tocar `e2e`, bloqueado por TS-012 de 006) (research D11, E14)
- [x] T003 [P] Añadir `.archview/` y `web/.archview/` a `.gitignore` del producto (research D7)
- [x] T004 Ampliar `cucumber.mjs`: rutas `specs/006-devarch-monorepo/...` y `specs/007-native-engine-runtime/tests/features/**/*.feature`; filtro de tags `not @engine`, `not @e2e` salvo `DEVARCH_E2E_BROWSER=true`, `not @slow` salvo `DEVARCH_E2E=true` (research D12)
- [x] T005 [P] Crear runner JVM `engine/src/test/java/com/extractor/runtimebdd/RunNativeEngineRuntimeFeaturesTest.java` (`@SelectDirectories("../specs/007-native-engine-runtime/tests/features")`, filtro `@engine`, glue `com.extractor.runtimebdd`) con `World.java`, `Hooks.java` y cliente MCP de prueba (`McpTestClient.java`, SDK Java `McpClient.sync` + `StdioClientTransport` sobre el jar o en proceso); ejecutar y ver escenarios `@engine` indefinidos (rojo)
- [x] T006 [P] Crear soporte de aceptación 007 en `tests/acceptance/support/`: `fake-mcp-server.ts` (servidor MCP stdio con SDK TS; comportamientos por env: retardo, fases, advertencias y fallos que nombran la ruta absoluta del proyecto, línea stderr, caída, error "No space left on device", archivo contador de lanzamientos, log de intervalos de llamada; escribe los tres JSON en `outputDir` con `meta.schema_version` 1.0.0 y `components[*].files` absolutos bajo `projectPath`), `zip-catalog.ts` (ZIP benignos y maliciosos generados en memoria: traversal, absoluta, letra de unidad, `\`, symlink, sobretamaño, bomba con tamaño declarado falso, exceso de entradas, duplicados, no-ZIP), `web-harness.ts` (invocación en proceso de route handlers con env y `ARCHVIEW_DATA_DIR` temporal, "reinicio" = recarga del runtime sobre el mismo directorio, reloj inyectable, inyección de E/S que falla con `ENOSPC`, cabecera `Authorization` opcional), `browser.ts` (Chromium, contextos aislados, `data-testid`)
- [x] T007 [P] Crear la etiqueta anotada `dev-arch-006-baseline` sobre `889c95a` (cierre de 006) como ancla estable de TS-076 que sobrevive a un squash (hallazgo A8) y documentarla en `docs/` del producto (`docs/BASELINES.md`: qué fija y cómo publicarla con `git push origin dev-arch-006-baseline`)

**Checkpoint**: dependencias instaladas; runners descubren los 87 escenarios (todos indefinidos/rojos).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: núcleo del motor (lenguaje, fases), adaptador MCP con `language`/progreso, **verificación de concurrencia del motor (decisión A2)**, y base del servidor web (configuración, almacén, carga segura, locator, seguridad de la API). Bloquea todas las historias.

### Motor

- [x] T008 [P] Escribir primero `engine/src/test/java/com/extractor/service/AnalysisLanguageTest.java` (parse `java|dotnet|auto|null`, mensaje `Invalid language '<x>'. Allowed: java, dotnet, auto`) y `AnalysisServiceLanguageTest.java` (JAVA/DOTNET no consultan el detector; AUTO mantiene error AMBIGUOUS con `language=java|dotnet` y fallback Java para UNKNOWN); verlas fallar
- [x] T009 Implementar `engine/src/main/java/com/extractor/service/{AnalysisLanguage,AnalysisOptions}.java` y sobrecargas con `AnalysisOptions` en `AnalysisService.java` (firmas actuales delegan con AUTO) hasta pasar T008 (research D5)
- [x] T010 [P] Escribir primero `engine/src/test/java/com/extractor/service/AnalysisServiceProgressTest.java` (DETECTION, EXTRACTION, INFERENCE en orden; NOOP por defecto; serialización idéntica con y sin listener); verla fallar
- [x] T011 Implementar `engine/src/main/java/com/extractor/service/{AnalysisPhase,AnalysisProgressListener}.java` y emisión en `AnalysisService.java` hasta pasar T010 (research D3)
- [x] T012 Escribir primero pruebas de contrato MCP en `engine/src/test/java/com/extractor/mcp/McpServerContractTest.java` (nuevos métodos, sin tocar los existentes) y `engine/src/test/java/com/extractor/mcp/tools/AnalyzeProjectToolTest.java`, y los steps JVM `engine/src/test/java/com/extractor/runtimebdd/{ProgressSteps,LanguageSteps}.java`: `language` opcional en las 5 tools con `required` intacto; con `progressToken` 4 notificaciones `detection/extraction/inference/writing` (1..4 de 4) antes del resultado; sin token ninguna y salida byte-idéntica; `language` inválido → `isError` con el mensaje exacto; ambiguo con `auto` → mensaje con `Ambiguous project type` y `language=java|dotnet` [TS-048, TS-049, TS-051, TS-053, TS-054]; verlas fallar
- [x] T013 Implementar `engine/src/main/java/com/extractor/mcp/ToolSchemas.java` (+`language`), `mcp/tools/AnalyzeProjectTool.java` (token de progreso vía `exchange`, fase WRITING, `language`) y `mcp/tools/{GetDependencyGraphTool,GetArchitectureTool,GetApiContractsTool,GetComponentMetricsTool}.java` (`language`) hasta pasar T012 (contracts/engine-mcp.md)
- [x] T014 Escribir el step JVM `engine/src/test/java/com/extractor/runtimebdd/ConcurrencySteps.java` y `engine/src/test/java/com/extractor/integration/NativeRuntimeConcurrencyTest.java` (dos `analyze_project` concurrentes sobre `java-standar` y `dotnet-ecommerce` en el mismo proceso MCP → salidas byte-idénticas a las secuenciales; dos secuenciales consecutivas byte-idénticas) [TS-064]; ejecutarlos: si fallan, corregir la no reentrancia en el núcleo (`com.extractor.service`/`analyzer`) hasta verde. Resultado registrado en research D2: verde ⇒ el valor por defecto de `MAX_CONCURRENT_ANALYSES` es 2; rojo sin corrección ⇒ queda en 1 (decisión A2)

### Web

- [x] T015 [P] Escribir primero `web/src/server/config.test.ts` (defaults de research D13 — `MAX_CONCURRENT_ANALYSES` según el resultado de T014 —; valores inválidos nombran la variable; `allowLocalPath` true solo en desarrollo o por `DEVARCH_ALLOW_LOCAL_PATH`; `DEVARCH_API_TOKEN` vacío o en blanco = sin token); verla fallar
- [x] T016 Implementar `web/src/server/config.ts` hasta pasar T015 (depende de T014 para el valor por defecto de concurrencia)
- [x] T017 [P] Escribir primero `web/src/server/jobs/job-store.test.ts` (UUID, rechazo de ids inválidos incluido `../`, escritura atómica, transiciones de data-model.md, `paths(id)`, `list`, `delete`); verla fallar
- [x] T018 Implementar `web/src/server/jobs/job-store.ts` hasta pasar T017 (data-model.md)
- [x] T019 [P] Escribir primero `web/src/server/upload/{stream-to-file,safe-extract,project-root}.test.ts` con el catálogo de `zip-catalog.ts` (conteo y corte por límite, `Content-Length` previo, validación del directorio central: `..`, absoluta, unidad, `\`, NUL, symlink, duplicados/colisión de mayúsculas, Σ declarado, nº entradas; extracción manual con conteo real; raíz = carpeta única de primer nivel; error de escritura `ENOSPC` → `STORAGE_FULL` y sin restos); verlas fallar
- [x] T020 Implementar `web/src/server/upload/{stream-to-file,safe-extract,project-root}.ts` hasta pasar T019 (research D8, FR-037)
- [x] T021 [P] Escribir primero `web/src/server/engine/engine-locator.test.ts` (reglas de 006 intactas + `ENGINE_JAVA_OPTS`, `DOTNET_ANALYZER_PATH`, args `[...opts, -jar, jar, --mcp]`); verla fallar
- [x] T022 Implementar `web/src/server/engine/engine-locator.ts` reutilizando `resolveEngine` de `engine-path.ts` (sin modificar `engine-path.test.ts`) hasta pasar T021 (contracts/engine-client.md)
- [x] T023 [P] Escribir primero `web/src/server/security/{api-token,path-redaction}.test.ts` (sin token configurado todo pasa; con token: falta, formato distinto de `Bearer`, valor distinto → 401 `UNAUTHORIZED` + `WWW-Authenticate`, correcto → pasa; `redactDocument` elimina `<raíz>/` en forma JSON-escapada para la ruta y su `realpath`, la raíz exacta → `.`, resto byte a byte; `redactText` relativiza raíz y `ARCHVIEW_DATA_DIR`; `publicProjectRoot`); verlas fallar
- [x] T024 Implementar `web/src/server/security/{api-token,path-redaction}.ts` hasta pasar T023 (plan nota 15, research D15)

**Checkpoint**: motor acepta `language`, emite progreso y es reentrante (TS-064 verde); base web probada en unitarias.

---

## Phase 3: User Story 1 — Analizar un proyecto sin esperar (P1) 🎯 MVP

**Goal**: `POST /api/analyses` → 202; estado con fases; tres documentos; UI asíncrona Java y .NET.
**Independent Test**: TS-001, TS-002, TS-003, TS-004, TS-005, TS-006, TS-007, TS-008, TS-009, TS-010, TS-011, TS-012, TS-013, TS-014, TS-015.

- [x] T025 [US1] Escribir step definitions `tests/acceptance/steps/native-runtime-async.steps.ts` para [TS-001, TS-002, TS-003, TS-004, TS-005, TS-006, TS-007, TS-008, TS-009, TS-010, TS-011, TS-012] (web-harness + fake MCP; `@slow` con motor real; TS-011 reutiliza los Given de 006); ejecutar y verlas fallar
- [x] T026 [P] [US1] Escribir primero `web/src/server/engine/engine-client.test.ts` contra `fake-mcp-server.ts`: arranque perezoso singleton, `analyze` con `onPhase` (ignora regresiones), advertencias desde `_meta`, `isError` → `EngineToolError`/`AMBIGUOUS_PROJECT`, respuesta validada con `parseAnalyzeProjectResponse`; verla fallar
- [x] T027 [US1] Implementar `web/src/server/engine/engine-client.ts` (camino feliz y errores de tool) hasta pasar T026 (research D1, contracts/engine-client.md)
- [x] T028 [P] [US1] Escribir primero `web/src/server/jobs/job-runner.test.ts` (submit inmediato; extracción → `analyze_project` con `outputDir=<job>/out` → validación de los tres documentos con `@static-inference/schema` → `completed`; documento inválido → `failed/ENGINE_ERROR`; fases persistidas; semáforo `maxConcurrent`); verla fallar
- [x] T029 [US1] Implementar `web/src/server/jobs/job-runner.ts` (pipeline, semáforo, cola FIFO, dependencias de E/S inyectables `JobRuntimeDeps`) y `web/src/server/runtime.ts` (singleton por proceso: config, store, cliente, runner) hasta pasar T028 (research D2, D7)
- [x] T030 [US1] Implementar rutas `web/src/app/api/analyses/route.ts` (POST binario/multipart/JSON `localPath`, `language`, `ENGINE_NOT_BUILT`, `LOCAL_PATH_DISABLED`), `web/src/app/api/analyses/[id]/route.ts` (estado con `projectRoot` relativo, `no-store`) y `web/src/app/api/analyses/[id]/[doc]/route.ts` (`graph|architecture|contracts` con `redactDocument`, `NOT_READY`, `ANALYSIS_FAILED`, `NOT_FOUND`) hasta pasar [TS-001, TS-002, TS-005, TS-006, TS-007, TS-010, TS-011, TS-012] (contracts/analyses-api.md)
- [x] T031 [US1] Verificar con motor real (`DEVARCH_E2E=true`) [TS-003, TS-004, TS-008, TS-009]
- [x] T032 [US1] Escribir step definitions `tests/acceptance/steps/native-runtime-browser.steps.ts` para [TS-013, TS-014, TS-015] (Playwright, `data-testid`); ejecutar con `make test-e2e-browser` y verlas fallar
- [x] T033 [US1] Implementar `web/src/lib/analyses-client.ts` (subida binaria, polling 1 s / máx. 2 s, documentos) y adaptar `web/src/components/software-architecture-analyzer.tsx` + nuevo `web/src/components/analysis-progress.tsx` (selector de lenguaje, fases en español, `localStorage['devarch.activeJobId']` sin resultados, `data-testid` de plan nota 10) hasta pasar [TS-013, TS-014, TS-015]

**Checkpoint**: MVP — subir ZIP Java/.NET y ver propuestas vía jobs asíncronos.

---

## Phase 4: User Story 2 — Análisis concurrentes aislados que sobreviven a la recarga (P1)

**Goal**: aislamiento, persistencia, recuperación al reiniciar, serialización por proyecto, reanudación en el navegador.
**Independent Test**: TS-016, TS-017, TS-018, TS-019, TS-020, TS-021, TS-022.

- [x] T034 [US2] Escribir step definitions `tests/acceptance/steps/native-runtime-isolation.steps.ts` para [TS-016, TS-017, TS-018, TS-019, TS-020, TS-021, TS-022]; ejecutar y verlas fallar
- [x] T035 [P] [US2] Ampliar primero `web/src/server/jobs/job-runner.test.ts` con `recoverOnStart` (`queued|running` → `failed/INTERRUPTED`) y mutex por `realpath(projectRoot)`; verla fallar
- [x] T036 [US2] Implementar recuperación y mutex en `web/src/server/jobs/job-runner.ts` y crear `web/src/instrumentation.ts` (`register()` en runtime Node: recuperación + arranque del runner) hasta pasar T035 y [TS-018, TS-020, TS-021, TS-022]
- [x] T037 [US2] Implementar reanudación en `web/src/components/software-architecture-analyzer.tsx` (al cargar, si existe `devarch.activeJobId`, consultar estado y retomar polling/resultados; mensaje de caducidad con opción de reanalizar) hasta pasar [TS-019]
- [x] T038 [US2] Verificar con motor real [TS-016, TS-017] (`DEVARCH_E2E=true`, `make test-e2e-browser`) con la concurrencia por defecto fijada en T014/T016

**Checkpoint**: criterio de salida "dos análisis concurrentes no interfieren; recargar no pierde el job".

---

## Phase 5: User Story 3 — Carga segura y acotada (P1)

**Goal**: límites, zip-slip, cuota previa a la carga, registro de rechazos, TTL, disco lleno.
**Independent Test**: TS-023, TS-024, TS-025, TS-026, TS-027, TS-028, TS-029, TS-030, TS-031, TS-032, TS-033, TS-086, TS-087.

- [x] T039 [US3] Escribir step definitions `tests/acceptance/steps/native-runtime-upload-security.steps.ts` para [TS-023, TS-024, TS-025, TS-026, TS-027, TS-028, TS-029, TS-030, TS-031, TS-032, TS-033, TS-086, TS-087]; ejecutar y verlas fallar
- [x] T040 [US3] Integrar en `web/src/app/api/analyses/route.ts` la verificación de cuota **antes** de leer el cuerpo (429 + `Retry-After`), los errores de `safe-extract` (400/413 con `entry`/`limit`), `507 STORAGE_FULL` al guardar la carga, borrado del área en todo rechazo y registro de rechazos de seguridad sin contenido hasta pasar [TS-023, TS-024, TS-025, TS-027, TS-028, TS-029, TS-030, TS-031, TS-086]
- [x] T041 [US3] Manejar en `web/src/server/jobs/job-runner.ts` el tamaño real mayor al declarado durante la extracción (`failed/UNCOMPRESSED_TOO_LARGE`, borrado de `source/`) y los fallos de almacenamiento en extracción y resultados (`failed/STORAGE_FULL`, mensaje "disk space" sin trazas, borrado de `source/` y `out/` parciales) hasta pasar [TS-026, TS-087]
- [x] T042 [P] [US3] Escribir primero `web/src/server/jobs/cleaner.test.ts` (reloj inyectable; borra terminales con `finishedAt + TTL < now`, nunca activos, huérfanos > 1 h); verla fallar
- [x] T043 [US3] Implementar `web/src/server/jobs/cleaner.ts` y su programación en `web/src/instrumentation.ts` hasta pasar T042 y [TS-032, TS-033]

**Checkpoint**: SC-005, SC-011 y SC-015 verificables.

---

## Phase 6: User Story 4 — Visor de código restringido (P1)

**Goal**: `/api/source?jobId&path` contenido en la raíz del job.
**Independent Test**: TS-034, TS-035, TS-036, TS-037, TS-038, TS-039.

- [x] T044 [US4] Escribir step definitions `tests/acceptance/steps/native-runtime-source.steps.ts` para [TS-034, TS-035, TS-036, TS-037, TS-038, TS-039]; ejecutar y verlas fallar
- [x] T045 [P] [US4] Escribir primero `web/src/server/source/source-sandbox.test.ts` (catálogo de escapes: absoluta, `..`, `%2e%2e`, `\`, NUL, unidad, symlink saliente, otro job, directorio, inexistente, extensión, tamaño; respuesta 404 uniforme fuera de la raíz); verla fallar
- [x] T046 [US4] Implementar `web/src/server/source/source-sandbox.ts` y reescribir `web/src/app/api/source/route.ts` (forma heredada `?path=` → 400) hasta pasar T045 y [TS-034, TS-035, TS-036, TS-037, TS-038] (research D10)
- [x] T047 [US4] Adaptar `web/src/components/code-viewer.tsx` y `web/src/components/component-details.tsx` (prop `jobId`, rutas ya relativas servidas por la API) hasta pasar [TS-039]

**Checkpoint**: SC-006 verificable.

---

## Phase 7: User Story 5 — Importar resultados validados (P2)

**Goal**: `POST /api/analyses/import` validado contra el contrato 1.0.0.
**Independent Test**: TS-040, TS-041, TS-042, TS-043, TS-044, TS-045, TS-046, TS-047.

- [x] T048 [US5] Escribir step definitions `tests/acceptance/steps/native-runtime-import.steps.ts` para [TS-040, TS-041, TS-042, TS-043, TS-044, TS-045, TS-046, TS-047]; ejecutar y verlas fallar
- [x] T049 [P] [US5] Escribir primero `web/src/server/import/import-validator.test.ts` (fixtures `schema/fixtures/valid/*` aceptadas; `schema/fixtures/invalid/*` → violaciones con `document`/`pointer`/`message`; versión presente ≠ 1.0.0 → `UNSUPPORTED_SCHEMA_VERSION`; versión ausente → `SCHEMA_VIOLATION`; documento obligatorio ausente); verla fallar
- [x] T050 [US5] Implementar `web/src/server/import/import-validator.ts` y `web/src/app/api/analyses/import/route.ts` (cuerpo por streaming con límite, job `origin: import` completado sin `source/`, `NO_SOURCES` en el visor) hasta pasar T049 y [TS-040, TS-041, TS-042, TS-043, TS-044, TS-045, TS-046]
- [x] T051 [US5] Crear `web/src/components/import-dialog.tsx` (dos/tres archivos JSON, errores con puntero de campo) e integrarlo en el analizador hasta pasar [TS-047]

**Checkpoint**: SC-010 verificable; defecto 6 cerrado.

---

## Phase 8: User Story 6 — Progreso, advertencias, lenguaje y reutilización en el motor (P2)

**Goal**: caché, advertencias, `--language` en CLI, paridad y determinismo (la parte concurrente, TS-064, ya se verificó en T014).
**Independent Test**: TS-048, TS-049, TS-050, TS-051, TS-052, TS-053, TS-054, TS-055, TS-056, TS-057, TS-058, TS-059, TS-060, TS-061, TS-062, TS-063, TS-065.

- [x] T052 [US6] Escribir step definitions JVM `engine/src/test/java/com/extractor/runtimebdd/{CacheSteps,WarningsSteps,ParitySteps}.java` para [TS-050, TS-052, TS-055, TS-056, TS-057, TS-058, TS-059, TS-060, TS-061]; ejecutar y ver fallar los no cubiertos por Foundational
- [x] T053 [P] [US6] Escribir primero `engine/src/test/java/com/extractor/service/{TreeFingerprintTest,AnalysisCacheTest}.java` (exclusión de `output*.json` raíz; cambios de mtime/tamaño/alta/baja cambian la huella; LRU con capacidad; `0` desactiva; clave con lenguaje; cómputo único concurrente; no mutación tras `minViability`); verlas fallar
- [x] T054 [US6] Implementar `engine/src/main/java/com/extractor/service/{TreeFingerprint,AnalysisCache}.java`, uso en `AnalysisService.java` para todas las vistas y wiring en `engine/src/main/java/com/extractor/mcp/McpServerMain.java` (`static-inference.cache.size` / `STATIC_INFERENCE_CACHE_SIZE`, 8) hasta pasar T053 y [TS-055, TS-056, TS-057, TS-058] (research D6)
- [x] T055 [P] [US6] Escribir primero pruebas de advertencias: `engine/src/test/java/com/extractor/analyzer/JavaSpoonAnalyzerWarningsTest.java` (archivo no parseable → advertencia con ruta relativa), `AnalysisServiceWarningsTest.java` (0 componentes → `No analyzable source files found`), `AnalyzeProjectToolTest` (`_meta["static-inference/warnings"]` solo si hay; `content[0]` valida contra `analyze_project.response.schema.json` 1.0.0); verlas fallar
- [x] T056 [US6] Implementar advertencias en `engine/src/main/java/com/extractor/analyzer/JavaSpoonAnalyzer.java`, `service/AnalysisService.java` y `mcp/tools/AnalyzeProjectTool.java` hasta pasar T055 y [TS-059, TS-060, TS-061] (research D4)
- [x] T057 [P] [US6] Escribir primero `engine/src/test/java/com/extractor/cli/CliLanguageAndWarningsTest.java` (`--language=java|dotnet|auto`; inválido → exit 1, mensaje exacto, sin archivos; `[warning]` en stderr; sin la opción, salidas byte-idénticas); verla fallar
- [x] T058 [US6] Implementar `--language` y advertencias en stderr en `engine/src/main/java/com/extractor/MicroserviceInferenceMain.java` hasta pasar T057 y [TS-050, TS-052, TS-053]
- [x] T059 [US6] Escribir y pasar `engine/src/test/java/com/extractor/integration/NativeRuntimeParityTest.java` (CLI vs MCP con `language` explícito y `auto`; consecutivas; cacheada vs nueva; con/sin token sobre `java-standar` y `dotnet-ecommerce`) (SC-007)
- [x] T060 [US6] Escribir step definitions `tests/acceptance/steps/native-runtime-warnings.steps.ts` para [TS-062, TS-063, TS-065]; verlas fallar; implementar el panel de advertencias (`data-testid="analysis-warnings"`) en `web/src/components/analysis-progress.tsx` y la copia `_meta` → `job.warnings` (con `redactText`) en `job-runner.ts` hasta pasar

**Checkpoint**: SC-007 y SC-008 verificables; FR-023..FR-027 completos.

---

## Phase 9: User Story 7 — Servicio del motor resistente a fallos (P2)

**Goal**: proceso único, reinicio con backoff, indisponibilidad temporal, timeout con reciclado, stderr por job.
**Independent Test**: TS-066, TS-067, TS-068, TS-069, TS-070, TS-071, TS-072.

- [x] T061 [US7] Escribir step definitions `tests/acceptance/steps/native-runtime-resilience.steps.ts` para [TS-066, TS-067, TS-068, TS-069, TS-070, TS-071, TS-072] (TS-072 reutiliza los Given de entorno y directorio de trabajo de 006); ejecutar y verlas fallar
- [x] T062 [P] [US7] Ampliar primero `web/src/server/engine/engine-client.test.ts` (un solo lanzamiento para N análisis; caída → `EngineCrashedError` < 1 s y relanzamiento; > 3 caídas en 60 s → `EngineUnavailableError`; espera durante reinicio; timeout → `EngineTimeoutError` y `recycleWhenIdle`; stderr → `[engine]` y `onStderr` por job en vuelo); verla fallar
- [x] T063 [US7] Implementar ciclo de vida, backoff, timeout/reciclado y stderr en `web/src/server/engine/engine-client.ts`, y en `job-runner.ts` el mapeo a `ENGINE_CRASHED`/`ENGINE_UNAVAILABLE`/`TIMEOUT` con mensaje resumido y `engine.log` del job, hasta pasar T062 y [TS-066, TS-067, TS-068, TS-069, TS-070, TS-071, TS-072] (research D14)

**Checkpoint**: SC-009 verificable.

---

## Phase 10: User Story 8 — Compatibilidad del análisis síncrono (P3)

**Goal**: `/api/analyze` igual hacia fuera, aislado por petición, obsoleto; UI no la usa; artefactos bloqueados intactos.
**Independent Test**: TS-073, TS-074, TS-075, TS-076, TS-077 + escenarios 006 TS-014, TS-015, TS-016, TS-017, TS-018, TS-019 + `analyze-route.test.ts`.

- [x] T064 [US8] Escribir step definitions `tests/acceptance/steps/native-runtime-compat.steps.ts` para [TS-073, TS-074, TS-075, TS-076] (TS-076 compara contra la etiqueta `dev-arch-006-baseline` de T007, nunca contra un hash de commit; TS-077 se cubre íntegramente con steps de 006); ejecutar y verlas fallar
- [x] T065 [US8] Reescribir `web/src/app/api/analyze/route.ts` (job `origin: sync`, `safe-extract`, `execFile` con `cwd=<job>/out`, lectura desde `<job>/out`, cabeceras `Deprecation`/`Link`) manteniendo verdes, sin modificarlos, `web/src/server/engine/analyze-route.test.ts` y los escenarios 006 [TS-073, TS-074] (research D9)
- [ ] T066 [US8] Verificar [TS-075] (la UI solo llama a `/api/analyses`), [TS-076] (diff contra `dev-arch-006-baseline` de `.feature`, `context.json` y aserciones de 001–006) y [TS-077] (Checkstyle 4763, SpotBugs con exclusiones, `dotnet format` sin tolerancia)

**Checkpoint**: compatibilidad hacia atrás verificada.

---

## Phase 11: User Story 9 — API sin rutas del servidor y con token opcional (P2)

**Goal**: FR-034..FR-036 en todas las rutas y en la UI (decisión A3).
**Independent Test**: TS-078, TS-079, TS-080, TS-081, TS-082, TS-083, TS-084, TS-085.

- [x] T067 [US9] Escribir step definitions `tests/acceptance/steps/native-runtime-exposure.steps.ts` para [TS-078, TS-079, TS-080, TS-081, TS-082, TS-083, TS-084, TS-085]; ejecutar y verlas fallar
- [x] T068 [US9] Aplicar `requireApiToken` como primera instrucción en `web/src/app/api/analyses/route.ts`, `analyses/[id]/route.ts`, `analyses/[id]/[doc]/route.ts`, `analyses/import/route.ts`, `source/route.ts` y `analyze/route.ts`, y completar la relativización (`projectRoot`, documentos, advertencias, motivos de fallo) hasta pasar [TS-078, TS-079, TS-080, TS-081, TS-082, TS-083]
- [x] T069 [P] [US9] Escribir primero `web/src/server/security/bind-warning.test.ts` (`HOSTNAME`/`-H`/`--hostname`; sin dirección = todas las interfaces; loopback `localhost`, `127.0.0.0/8`, `::1` sin aviso; con token sin aviso); verla fallar
- [x] T070 [US9] Implementar `web/src/server/security/bind-warning.ts` y llamarlo desde `register()` de `web/src/instrumentation.ts` hasta pasar T069 y [TS-084]
- [x] T071 [US9] Añadir en `web/src/lib/analyses-client.ts` la cabecera `Authorization` desde `sessionStorage['devarch.apiToken']` y en la UI el campo `data-testid="api-token-input"` mostrado ante 401, con reintento, hasta pasar [TS-085]

**Checkpoint**: SC-013 y SC-014 verificables.

---

## Phase 12: Polish & Cross-Cutting Concerns

- [x] T072 Actualizar `<monorepo>/.github/workflows/dev-arch.yml`: filtro `acceptance` + `apps/dev-arch/specs/007-*/tests/**`; job `e2e-browser` (`if` compuesto web/engine-java/engine-dotnet/acceptance, JDK 17, .NET 8, Node 20, `make build`, `npx playwright install --with-deps chromium`, `make test-e2e-browser`, `timeout-minutes: 30`); confirmar que TS-025, TS-026, TS-027, TS-028, TS-029, TS-030 de 006 siguen verdes (research D11, E13)
- [x] T073 [P] Documentar variables y flujo en `web/docs/ENVIRONMENT.md` (incluidos `DEVARCH_API_TOKEN`, la advertencia de exposición y `HOSTNAME`) y `web/docs/DEVELOPERS.md` (research D13, D15), `language`/progreso/`_meta`/caché en `engine/MCP.md` y `--language` en `engine/README.md`; entrada en `CHANGELOG.md` (sin bump de contrato)
- [x] T074 [P] Eliminar del frontend el almacenamiento de resultados en `localStorage` y código muerto de la subida síncrona en `web/src/components/software-architecture-analyzer.tsx`
- [ ] T075 Gates completos con JDK 17: `make test` (incluye `mvn -B verify`, `dotnet format --verify-no-changes`, `schema-check`, web, aceptación sin `@slow`), Checkstyle ≤ 4763 y SpotBugs 0 con los comandos de CI, `DEVARCH_E2E=true make test-acceptance`, `make test-e2e-browser`; `testify-tdd.sh verify-hash` para 001–007 [TS-076, TS-077]
- [ ] T076 Ejecutar `specs/007-native-engine-runtime/quickstart.md` de punta a punta y regenerar el tablero iikit

---

## Dependencies & Execution Order

- **Setup (T001–T007)**: T001 ∥ T002 ∥ T003 ∥ T005 ∥ T006 ∥ T007; T004 tras T002.
- **Foundational (T008–T024)**: depende de Setup. Motor: T008 → T009; T010 → T011; T009, T011 → T012 → T013 → T014. Web: T014 → T015 → T016 (valor por defecto de concurrencia, decisión A2); T017 → T018; T019 → T020; T021 → T022; T023 → T024; las cadenas web T017–T024 en paralelo con el motor. Bloquea todas las historias.
- **US1 (T025–T033)**: T025 primero (rojo); T026 → T027; T028 → T029 (requiere T018, T020, T027); T030 requiere T016, T024, T029; T031 requiere T013 + `make build`; T032 → T033 (requiere T030).
- **US2 (T034–T038)**: depende de US1 (T029, T030, T033). T035 → T036; T037 tras T033.
- **US3 (T039–T043)**: depende de US1 (T030). T040, T041 tras T039; T042 → T043 (T043 requiere T036 por `instrumentation.ts`).
- **US4 (T044–T047)**: depende de Foundational (T018) y US1 (T030). T045 → T046 → T047.
- **US5 (T048–T051)**: depende de Foundational (T018) y de T046 (`NO_SOURCES`). T049 → T050 → T051.
- **US6 (T052–T060)**: depende de Foundational (T013, T014). T053 → T054; T055 → T056; T057 → T058; T059 tras T054, T056, T058; T060 requiere T029, T033.
- **US7 (T061–T063)**: depende de US1 (T027, T029). T062 → T063.
- **US8 (T064–T066)**: depende de Foundational (T018, T020) y de T007. T065 tras T064; T066 tras T033.
- **US9 (T067–T071)**: depende de US1 (T030), US4 (T046), US5 (T050), US8 (T065). T068 tras T067; T069 → T070 (requiere T036); T071 tras T033.
- **Polish (T072–T076)**: tras todas las historias; T075 → T076.

**Critical path**: T001 → T006 → T017 → T018 → T028 → T029 → T030 → T032 → T033 → T034 → T036 → T038 → T072 → T075 → T076 (motor en paralelo: T008 → T009 → T012 → T013 → T014 → T016).

### Parallel batches

- Setup: [T001, T002, T003, T005, T006, T007]
- Foundational: [T008, T010, T017, T019, T021, T023]; luego [T009, T011, T018, T020, T022, T024]
- US1: [T026, T028]
- Tras US1: US3 (T039–T043), US4 (T044–T047), US6 motor (T052–T059) y US7 (T061–T063) en paralelo con US2
- US6: [T053, T055, T057]
- Polish: [T073, T074]

## Implementation Strategy

1. **MVP** = Setup + Foundational (incluida la verificación de concurrencia TS-064) + US1 + US2 → criterio de salida de la Fase 3 (SC-001, SC-002, SC-003).
2. Incremento 2 (seguridad, obligatorio antes de exponer la web): US3 + US4 + US9.
3. Incremento 3: US6 (motor completo) + US7 (resiliencia).
4. Incremento 4: US5 (importación) + US8 (compatibilidad verificada) + Polish.

## Notes

- No se modifican `.feature` ni aserciones (001–007); si un escenario parece incorrecto, re-ejecutar `/iikit-04-testify`.
- `make e2e` sigue imprimiendo el marcador de la feature 011 (TS-012 de 006); la prueba de navegador usa `make test-e2e-browser`.
- El contrato de datos permanece en 1.0.0; las advertencias viajan en `_meta` (decisión A1, confirmada).
- La concurrencia por defecto del motor depende de TS-064 (decisión A2): 1 hasta que pasa, 2 después; con 1 el segundo análisis queda en cola y SC-001 se cumple.
