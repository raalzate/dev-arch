# Research: 007-native-engine-runtime

**Date**: 2026-10-08 | **Spec**: [spec.md](./spec.md)

## Evidencia levantada (solo lectura)

Fuente: worktree del monorepo `/Users/raul.alzate/Documents/maestria/maestria-devarch`, producto `apps/dev-arch` (rama `feature/dev-arch-monorepo`, commit `889c95a`, feature 006 cerrada).

| # | Hallazgo | Impacto en el diseño |
|---|----------|----------------------|
| E1 | `web/src/app/api/analyze/route.ts` (006): `formData()` → `mkdtemp(os.tmpdir()/archview-)` → `AdmZip.extractAllTo` (sin validación de entradas) → `execFile(java, ['-jar', jar, projectRoot, 'output.json'])` **sin `cwd`** → lee `output.json`/`output_architecture.json` de `process.cwd()`; nunca borra el temporal | Defectos 2 y 4 confirmados. El CLI deriva `*_architecture.json`/`*_entrypoints.json` de `outputFile` (`MicroserviceInferenceMain`, `outputFile.replace(".json", ...)`), así que lanzar el CLI con `cwd` = área propia aísla la ruta síncrona sin cambiar sus argumentos |
| E2 | Escenarios bloqueados de 006: TS-014/TS-019 (`POST /api/analyze` con ZIP real → `componentsData.meta.schema_version == "1.0.0"`), TS-015 (`Engine not built` + ruta + `make build`), TS-018 (un `java` falso registra **4 argumentos** `-jar <jar> <projectRoot> output.json` y escribe los JSON en **su cwd**); `web/src/server/engine/analyze-route.test.ts` afirma lo mismo | `/api/analyze` **no puede** pasar a MCP sin romper TS-018 (el `java` falso no habla MCP). Decisión D9: se conserva como adaptador CLI obsoleto con `cwd` aislado |
| E3 | `web/src/app/api/source/route.ts`: `fs.readFile(searchParams.get('path'))` sin restricción | Defecto 3; se reemplaza por lectura con `jobId` + ruta relativa (D7) |
| E4 | `web/src/components/software-architecture-analyzer.tsx` guarda `componentsData`/`archData` completos en `localStorage`; `code-viewer.tsx` llama `/api/source?path=<component.files[0]>` (ruta absoluta) | La UI pasa a guardar solo `jobId`; el visor relativiza `files[0]` contra `job.projectRoot` |
| E5 | `AnalysisService` (núcleo compartido) crea analizadores por invocación; `createAnalyzer` lanza `IllegalArgumentException("Ambiguous project type ... specify the target language explicitly")` para `AMBIGUOUS`, cae a Java para `UNKNOWN`; cada `get_*` re-analiza desde cero | Punto único para `language`, progreso y caché (principio II) |
| E6 | `AnalysisResult.warnings` existe; `AnalysisService.analyzeProject` añade `analyzer.getWarnings()`; solo `DotNetBridgeAnalyzer` produce advertencias (modo degradado); `JavaSpoonAnalyzer` no; nadie las expone | FR-026: poblar desde Java (archivos no parseados) y "sin archivos analizables"; exponer en MCP y CLI |
| E7 | `schema/1.0.0/mcp/analyze_project.response.schema.json`: objeto **cerrado** (`additionalProperties: false`), 6 campos requeridos. `docs/SCHEMA.md`: añadir un campo opcional = **minor**; `meta.schema_version` es `const` por versión | Añadir `warnings` al JSON validado obliga a contrato 1.1.0, lo que cambia `meta.schema_version` de todas las salidas y rompe aserciones bloqueadas que fijan `"1.0.0"` (005 `schema-version.feature`, 006 TS-014, `SchemaVersionContractTest`, `SchemaVersionTests.cs`) → D4 |
| E8 | MCP Java SDK `io.modelcontextprotocol.sdk:mcp` 1.1.0: `McpSyncServerExchange.progressNotification(ProgressNotification)`; `CallToolRequest.progressToken()` lee `_meta.progressToken`; `CallToolResult` tiene `_meta` (`Map<String,Object>`); `McpServer.sync(...)` descarga los handlers a un scheduler elástico salvo `immediateExecution(true)` (no se usa en `McpServerMain`) | Progreso y `_meta` sin dependencias nuevas; el servidor ya admite llamadas concurrentes (a validar con prueba, R1) |
| E9 | `ToolSchemas`: `analyze_project` {projectPath*, outputDir}; el resto {projectPath*, …}. `McpServerContractTest` solo comprueba presencia de propiedades (aditivo seguro) | Añadir `language` opcional (enum) no rompe contratos |
| E10 | `DotNetToolLocator`: busca `dotnet-analyzer` junto al jar, luego `DOTNET_ANALYZER_PATH` (propiedad o env), luego `PATH`. `web/engine-dist/` contiene `engine.jar` + `dotnet-analyzer` | El locator de la web solo propaga `DOTNET_ANALYZER_PATH` si está definida |
| E11 | Salidas del motor: `components[*].files` = ruta tal como se recorrió (absoluta si `projectPath` es absoluto, ej. fixtures `test-for-demo/java-standar/src/...`) | La paridad byte a byte web↔CLI se mide sobre la **misma ruta** (SC-007); el visor relativiza en el cliente |
| E12 | `npm view`: `@modelcontextprotocol/sdk` 1.32.1 (node ≥ 18; peer `zod ^3.25 \|\| ^4`), `playwright` 1.64.0. El workspace ya resuelve `zod` 3.25.76 (izado por `schema/`) | Compatible sin cambiar la versión efectiva de zod; la web declara `zod ^3.25` |
| E13 | CI (`.github/workflows/dev-arch.yml`): TS-025 de 006 calcula los "checks" de un cambio como los jobs cuyo `if` es **exactamente** `needs.changes.outputs.<filtro> == 'true'`; TS-030 exige ≤ 20 min a esos jobs; el filtro `acceptance` incluye `specs/006-*/tests/**` y `cucumber.mjs` | Un job nuevo con `if` de área simple rompería TS-025 (fila web = "exactamente web"). El job e2e usa una condición compuesta (D11) |
| E14 | `Makefile`: `e2e` imprime `[e2e] not implemented yet (feature 011)` — bloqueado por 006 TS-012 (Scenario Outline de marcadores) | La prueba de navegador de 007 no usa `make e2e`; nuevo objetivo `test-e2e-browser` (D11) |
| E15 | `cucumber.mjs` solo incluye `specs/006-*/tests/features`; `@slow` solo con `DEVARCH_E2E=true`. Motor: `RunSchemaContractFeaturesTest` (Cucumber-JVM, glue `com.extractor.bdd`, incluye subpaquetes) | 007 añade su ruta a `cucumber.mjs` excluyendo `@engine`, y un runner JVM propio con glue fuera de `com.extractor.bdd` (D12) |
| E16 | `next.config.ts` con `ignoreBuildErrors`/`ignoreDuringBuilds` (defecto 7, Fase 6) | Fuera de alcance; las rutas nuevas se tipan y se prueban igual |

## Decisiones

### D1. Cliente del motor: `@modelcontextprotocol/sdk` + `StdioClientTransport`, proceso único con reinicio

- **Decision**: `web/src/server/engine/engine-client.ts` mantiene un `Client` del SDK TS (1.32.x, versión exacta fijada en el lock) conectado por `StdioClientTransport({ command: javaBin, args: [...JAVA_OPTS, '-jar', jarPath, '--mcp'], env, stderr: 'pipe' })`. Singleton en `globalThis.__devarchEngine` (sobrevive al HMR de `next dev`). Arranque perezoso en la primera llamada; `transport.onclose`/`onerror` → todas las llamadas en vuelo se rechazan con `EngineCrashedError` y el siguiente `callTool` relanza (backoff 1 s, 2 s, 4 s; más de 3 caídas en 60 s → `EngineUnavailableError` durante 60 s). `stderr` se lee por líneas: se registra con prefijo `[engine]` y se añade al `engine.log` de cada job en vuelo.
- **Rationale**: Decisión D2 del plan aprobada por el usuario; reutiliza los contratos MCP ya probados (`CliMcpParityTest`, `McpServerContractTest`); principio II (adaptador delgado). El SDK maneja framing JSON-RPC, timeouts, `onprogress` y cancelación.
- **Alternatives**: cliente JSON-RPC propio (~200 líneas, como `tests/acceptance/support/mcp.ts`) — menos dependencias transitivas (el SDK arrastra `express`, `hono`, `ajv`), pero reimplementa timeouts/cancelación/progreso: descartado por la decisión aprobada; spawn del CLI por job — sin progreso ni caché, mantiene el defecto de arranque de JVM por análisis; HTTP en el JAR — descartado en D2 del plan.
- **Justificación de dependencia (principio VI, por extensión a la web)**: única dependencia de runtime nueva de la web; sustituye la invocación por proceso suelto; versión exacta en lock.

### D2. Concurrencia: cola en la web + llamadas concurrentes al mismo proceso

- **Decision**: `JobRunner` en la web con semáforo `MAX_CONCURRENT_ANALYSES` (2) y cola FIFO `MAX_QUEUED_ANALYSES` (10); por encima → 429 + `Retry-After: 30`. Mutex por `realpath(projectRoot)` (solo relevante para `localPath`; los ZIP tienen raíces únicas). Las ≤ 2 llamadas `analyze_project` en vuelo comparten el proceso del motor (el servidor Java descarga handlers a un scheduler elástico, E8).
- **Rationale**: FR-010/FR-011; riesgo de memoria de la sección 5 (concurrencia 1-2); un solo JVM.
- **Riesgo R1**: estado estático no reentrante en analizadores. Mitigación: prueba de motor "dos `analyze_project` concurrentes sobre `java-standar` y `dotnet-ecommerce` producen salidas byte-idénticas a las secuenciales" (TS de US2/US6). Si falla y no se corrige en el núcleo, `MAX_CONCURRENT_ANALYSES=1` es el fallback documentado (sin cambiar contratos).

### D3. Progreso: listener en el núcleo, `notifications/progress` en el adaptador MCP

- **Decision**: Núcleo: `enum AnalysisPhase { DETECTION, EXTRACTION, INFERENCE, WRITING }` y `interface AnalysisProgressListener { void onPhase(AnalysisPhase phase); }` (`NOOP` por defecto). `AnalysisService.analyzeProject(Path, AnalysisOptions, AnalysisProgressListener)` emite DETECTION (antes de detectar tipo), EXTRACTION (antes de `analyzer.analyzeProject`), INFERENCE (antes de `InferenceEngine`); el adaptador `AnalyzeProjectTool` emite WRITING antes de escribir los tres archivos. Adaptador MCP: si `request.progressToken() != null`, `exchange.progressNotification(new ProgressNotification(token, ordinal+1, 4.0, phaseName))` con `phaseName` ∈ {`detection`,`extraction`,`inference`,`writing`}; sin token, no envía nada. En reutilización de caché se emiten igualmente las 4 fases (orden estable). CLI: listener NOOP.
- **Rationale**: FR-023; lógica de fases en el núcleo (II), transporte en el adaptador; la salida no cambia (IV).
- **Alternatives**: progreso con porcentaje intra-fase (Spoon no lo expone; falso progreso); `notifications/message` de logging (no es progreso tipado).

### D4. Advertencias en `_meta` del resultado MCP; contrato 1.0.0 intacto

- **Decision**: `AnalyzeProjectTool` devuelve el mismo `content[0]` (JSON validado por `analyze_project.response.schema.json`, sin cambios) y, **solo si hay advertencias**, `CallToolResult._meta = { "static-inference/warnings": [ "<texto>", ... ] }` (orden de aparición, determinista). CLI: cada advertencia a `stderr` como `[warning] <texto>` tras escribir los archivos. Fuentes: `DotNetBridgeAnalyzer` (existente), `JavaSpoonAnalyzer` (archivos `.java` que Spoon no pudo modelar, con ruta relativa a la raíz y motivo), `AnalysisService` ("No analyzable source files found in '<rel>'" cuando hay 0 componentes). Web: el runner copia `_meta["static-inference/warnings"]` a `job.warnings`.
- **Rationale**: FR-026 sin bump de contrato: bumpear a 1.1.0 cambiaría `meta.schema_version` de todas las salidas y rompería aserciones bloqueadas de 005/006 (E7), lo que exigiría re-testify de features cerradas. `_meta` es metadato de protocolo, fuera del contenido validado. Respuestas sin advertencias quedan byte-idénticas (FR-027).
- **Alternatives**: contrato 1.1.0 con `warnings` opcional (correcto semánticamente; se propone para una feature de contrato futura con re-testify de 005/006); segundo `TextContent` (rompe consumidores que asumen un solo bloque); campo nuevo en 1.0.0 sin bump (viola la política de `docs/SCHEMA.md`).
- **Pendiente de confirmar por el usuario** (Clarifications de spec.md).

### D5. Parámetro `language` (`java|dotnet|auto`) en el núcleo, MCP y CLI

- **Decision**: `AnalysisOptions(language)`; `AnalysisService.createAnalyzer` respeta `JAVA`/`DOTNET` sin consultar el detector (fase DETECTION se emite igual); `AUTO` = comportamiento actual (incluido el fallback a Java para `UNKNOWN` y el error `AMBIGUOUS`, cuyo mensaje añade "use language=java|dotnet"). MCP: propiedad opcional `language` (enum) en las **cinco** tools (`analyze_project` exigida por el plan; las `get_*` para coherencia con la caché y con proyectos ambiguos). Valor inválido → `isError: true` "Invalid language 'x'. Allowed: java, dotnet, auto". CLI: tercer argumento opcional `--language=<java|dotnet|auto>`; sin él, comportamiento idéntico.
- **Rationale**: FR-024, paridad (I, II). Aditivo en los esquemas de entrada (E9).
- **Alternatives**: solo MCP (rompe paridad de entradas entre modos).

### D6. Caché en memoria por (ruta real, lenguaje, huella del árbol)

- **Decision**: `AnalysisCache` en el núcleo (`com.extractor.service`): LRU con `LinkedHashMap` sincronizado, capacidad `static-inference.cache.size` (propiedad de sistema) o `STATIC_INFERENCE_CACHE_SIZE` (env), por defecto 8, `0` desactiva. Clave = `realPath` + `language` + huella SHA-256 de la lista ordenada `(rutaRelativa, tamaño, mtimeMillis)` de todos los archivos regulares del árbol, **excluyendo** `output.json`, `output_architecture.json` y `output_entrypoints.json` en la raíz del proyecto (los escribe el propio `analyze_project` cuando no hay `outputDir`). Valor = `AnalysisResult` completo (grafo, arquitectura, contratos, advertencias). Todas las tools usan `analyzeProject` cacheado y derivan su vista (`getArchitectureProposal` filtra sobre una copia; nada muta el valor cacheado). Llamadas concurrentes con la misma clave: un único cómputo (`computeIfAbsent` sobre `CompletableFuture`). Solo el modo MCP instancia la caché; el CLI usa `AnalysisService` sin caché.
- **Rationale**: FR-025, SC-008; determinismo (IV): mismo objeto serializado con el mismo `ObjectMapper` ⇒ bytes idénticos (prueba explícita).
- **Riesgos**: memoria (acotada por capacidad); objetos mutables (prueba de no-mutación: serializar antes/después de `get_architecture_proposal` con `minViability`).
- **Alternatives**: caché en disco (persistencia no pedida, invalida determinismo si cambia el jar); huella por contenido (hash de bytes de todos los archivos: más costosa; mtime+tamaño es lo aprobado).

### D7. Jobs en disco: `.archview/jobs/<id>/`

- **Decision**: Raíz `ARCHVIEW_DATA_DIR` (por defecto `<cwd de la web>/.archview`, ignorado por git). Por job: `job.json` (metadatos, escritura atómica `tmp` + `rename`), `upload.zip` (borrado tras extraer), `source/` (extracción; `projectRoot` = única carpeta de primer nivel si existe, como en 006), `out/` (`output.json`, `output_architecture.json`, `output_entrypoints.json`, escritos por el motor vía `outputDir`), `engine.log`. Id = `crypto.randomUUID()` validado con regex en cada ruta (impide traversal por id). Al arrancar (`instrumentation.ts` → `register()`): jobs `queued|running` → `failed` motivo `interrupted`; se programa la limpieza (`setInterval` cada `ARCHVIEW_CLEANUP_INTERVAL_MS`, 10 min) que borra jobs terminales con `finishedAt + TTL < now` (TTL `ARCHVIEW_JOB_TTL_HOURS`, 24) y directorios huérfanos sin `job.json` de más de 1 h. Comparación de caducidad usa `finishedAt` (nunca jobs activos; un reloj hacia atrás solo retrasa).
- **Rationale**: FR-008, FR-009, FR-012; sin base de datos (aprobado).
- **Alternatives**: SQLite (dependencia nativa, no pedido); memoria (pierde jobs al reiniciar).

### D8. Carga segura

- **Decision**: `POST /api/analyses` acepta el ZIP como **cuerpo binario** (`Content-Type: application/zip` u `application/octet-stream`; `?language=`), leído por streaming desde `request.body` hacia `upload.zip` contando bytes: si `Content-Length` > límite → 413 sin leer; si el conteo supera el límite → aborta, borra y 413. `multipart/form-data` también se acepta (compatibilidad con clientes de formulario) con la misma comprobación previa de `Content-Length` y conteo. Validación previa a la extracción con `adm-zip` (dependencia existente): cada entrada se normaliza (`\` → `/`), se rechaza si es absoluta, tiene letra de unidad, contiene `..` como segmento, contiene byte nulo, es enlace simbólico (`(attr >>> 16) & 0o170000 === 0o120000`) o `path.resolve(dest, name)` no empieza por `dest + sep`; Σ tamaños declarados ≤ `MAX_UNCOMPRESSED_BYTES` (1 GiB) y nº entradas ≤ `MAX_ZIP_ENTRIES` (100 000). Extracción manual entrada a entrada (no `extractAllTo`) contando los bytes reales escritos (defensa ante tamaños declarados falsos). Entradas duplicadas o que colisionan solo en mayúsculas → rechazo determinista del ZIP ("duplicate entry"). Cualquier rechazo → 400/413 con `{ error: { code, message, entry? } }` y borrado del área.
- **Rationale**: FR-013..FR-016; sin dependencias nuevas.
- **Alternatives**: `yauzl`/`unzipper` streaming (dependencia nueva; `adm-zip` ya está y el límite de 200 MB acota memoria); `formData()` de Next (bufferiza todo en memoria sin control de límite).

### D9. `/api/analyze` (006) se conserva como adaptador CLI obsoleto con `cwd` aislado

- **Decision**: Misma petición (multipart `file`) y misma respuesta `{ componentsData, archData }` y mismos errores; cambios: crea un job de origen `sync` en el almacén (área propia, TTL), extrae con el validador de D8, ejecuta `execFile(javaBin, ['-jar', jar, projectRoot, 'output.json'], { cwd: <job>/out })` y lee los resultados de `<job>/out`. Cabeceras `Deprecation: true` y `Link: </api/analyses>; rel="successor-version"`. La UI deja de usarla.
- **Rationale**: FR-033 y escenarios bloqueados TS-014/TS-015/TS-018/TS-019 de 006 + `analyze-route.test.ts` (4 argumentos, JSON escritos en el cwd del proceso). Pasarla a MCP rompería TS-018.
- **Alternatives**: fachada síncrona sobre el job MCP (rompe TS-018); eliminarla (rompe 006).

### D10. Visor de fuentes y importación

- **Decision visor**: `GET /api/source?jobId=<uuid>&path=<relativa>` (sustituye la forma `?path=<absoluta>`, que pasa a 400). Pasos: validar `jobId`; job sin `source/` (importado) → 409 `NO_SOURCES`; rechazar `path` vacío, absoluto, con letra de unidad, `\`, byte nulo o segmento `..` tras `decodeURIComponent` único; `candidate = path.resolve(root, rel)`; `real = fs.realpath(candidate)`; exigir `real.startsWith(realpath(root) + sep)`; `lstat` ⇒ archivo regular; extensión (minúsculas) en la lista blanca: `.java .kt .groovy .gradle .kts .xml .properties .yml .yaml .json .cs .vb .csproj .vbproj .sln .config .cshtml .razor .xaml .resx .settings .sql .md .txt .jsp .html .js .ts`; tamaño ≤ `MAX_SOURCE_VIEW_BYTES` (2 MiB). Todo fallo de contención o inexistencia responde 404 `NOT_FOUND` uniforme (no revela existencia). Respuesta `{ content, path }`.
- **Decision importación**: `POST /api/analyses/import` con JSON `{ graph, architecture, entrypoints? }` (cuerpo ≤ límite de carga, leído por streaming). Valida con `@static-inference/schema` (`parseDependencyGraph`, `parseConsolidatedArchitecture`, `parseEntrypointsDocument`, zod generado): si `meta.schema_version` ≠ `1.0.0` → 422 `UNSUPPORTED_SCHEMA_VERSION` con `found`/`supported`; violaciones → 422 `SCHEMA_VIOLATION` con `violations: [{ document, pointer, message }]` (JSON Pointer desde `issue.path`). Éxito → 201 `{ jobId }`, job `origin: "import"`, `status: "completed"`, sin `source/`.
- **Rationale**: FR-017..FR-022; reutiliza el paquete de contrato (D3 del plan), sin validador nuevo.

### D11. Prueba en navegador: Playwright (librería) dentro de Cucumber-JS

- **Decision**: Dependencia **dev** en la raíz del producto `playwright` 1.64.x (solo Chromium, `npx playwright install --with-deps chromium` en CI). Los escenarios `@e2e @slow` de 007 se ejecutan con Cucumber-JS (mismo runner que 006) y sus steps usan `chromium.launch()`; dos `BrowserContext` independientes = dos sesiones (SC-001); `page.reload()` (SC-002). Script raíz `test:e2e` y objetivo `make test-e2e-browser` (`DEVARCH_E2E=true`, `--tags @e2e`); `make e2e` **no se toca** (bloqueado por 006 hasta 011). CI: job nuevo `e2e-browser` con `if` compuesto `needs.changes.outputs.web == 'true' || needs.changes.outputs.engine-java == 'true' || needs.changes.outputs.engine-dotnet == 'true' || needs.changes.outputs.acceptance == 'true'` (el e2e depende de web y motor; no es un "job de área" en el sentido de TS-025/TS-030), JDK 17 + .NET 8 + Node 20, `make build`, timeout 30 min. Filtro `acceptance` añade `apps/dev-arch/specs/007-*/tests/**`.
- **Rationale (justificación de la dependencia nueva)**: el criterio de salida exige verificar la **interfaz** (subir, ver propuestas, recargar, dos sesiones), lo que una prueba sobre la API no cubre; Playwright es el único driver de navegador del producto, solo dev, y se ejecuta con el runner BDD existente (sin segundo runner `@playwright/test`).
- **Alternatives**: `@playwright/test` (segundo runner y reportes paralelos a Cucumber); Puppeteer (solo Chromium, API similar, menos soporte de contexts aislados); prueba solo de API (no cumple el criterio de salida).

### D12. Organización de las pruebas BDD de 007

- **Decision**: `.feature` en `specs/007-native-engine-runtime/tests/features/`. Escenarios del motor etiquetados `@engine` → Cucumber-JVM `RunNativeEngineRuntimeFeaturesTest` (`@SelectDirectories("../specs/007-native-engine-runtime/tests/features")`, `FILTER_TAGS = "@engine"`, glue `com.extractor.runtimebdd` — fuera de `com.extractor.bdd` para no mezclarse con 005). Resto → Cucumber-JS (`cucumber.mjs` añade la ruta con `not @engine`); `@slow` (motor real/web real) solo con `DEVARCH_E2E=true`; `@e2e` (navegador) solo con `make test-e2e-browser`. Unitarias: `node:test` + `tsx` (web) y JUnit 5 (motor).
- **Rationale**: cada escenario se ejecuta en el stack de lo que verifica; TDD (III) con escenarios rojos antes del código.

### D13. Configuración (variables de entorno de la web)

| Variable | Defecto | FR |
|----------|---------|----|
| `ENGINE_JAR_PATH`, `JAVA_HOME` | 006 (`engine-dist/engine.jar`, `java` del PATH) | FR-032 |
| `DOTNET_ANALYZER_PATH` | sin definir (motor busca junto al jar) | — |
| `ENGINE_JAVA_OPTS` | vacío (ej. `-Xmx2g`, riesgo de memoria sección 5) | FR-029 |
| `ARCHVIEW_DATA_DIR` | `<cwd>/.archview` | FR-009 |
| `MAX_UPLOAD_BYTES` | 209715200 (200 MiB) | FR-013 |
| `MAX_UNCOMPRESSED_BYTES` | 1073741824 (1 GiB) | FR-015 |
| `MAX_ZIP_ENTRIES` | 100000 | FR-015 |
| `MAX_CONCURRENT_ANALYSES` | 2 | FR-011 |
| `MAX_QUEUED_ANALYSES` | 10 | FR-011 |
| `ARCHVIEW_JOB_TTL_HOURS` | 24 | FR-012 |
| `ARCHVIEW_CLEANUP_INTERVAL_MS` | 600000 | FR-012 |
| `ANALYSIS_TIMEOUT_MS` | 1800000 (30 min) | FR-030 |
| `MAX_SOURCE_VIEW_BYTES` | 2097152 (2 MiB) | FR-018 |
| `DEVARCH_ALLOW_LOCAL_PATH` | `true` solo si `NODE_ENV=development` | FR-005 |
| Motor: `STATIC_INFERENCE_CACHE_SIZE` | 8 | FR-025 |

Valores inválidos (no numéricos, ≤ 0 salvo caché) → error de arranque explícito con el nombre de la variable.

### D14. Tiempo máximo y recuperación

- **Decision**: `client.callTool(..., { timeout: ANALYSIS_TIMEOUT_MS, onprogress })` (sin `resetTimeoutOnProgress`). Al vencer: job `failed` motivo `timeout`, se libera el turno; el SDK envía `notifications/cancelled`; como el handler Java no es cancelable, si el proceso sigue ocupado se marca "reciclar al quedar ocioso" (se reinicia cuando no quedan llamadas en vuelo) para no matar análisis concurrentes sanos. Caída del proceso → jobs en vuelo `failed` motivo `engine_crashed` en < 1 s (evento `close` del transporte) — SC-009 (< 10 s).
- **Rationale**: FR-029, FR-030, FR-031.

## Tessl Tiles

No se instalan tiles nuevas en esta fase (sin acceso de instalación en modo no interactivo); los tiles existentes de `.tessl/` (intent-integrity-kit) cubren el flujo. Tecnologías sin tile: `@modelcontextprotocol/sdk`, `playwright`, MCP Java SDK. Sin resultados de evals.
