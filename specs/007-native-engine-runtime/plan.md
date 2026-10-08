# Implementation Plan: Integración runtime nativa del motor en dev-arch

**Branch**: `007-native-engine-runtime` | **Date**: 2026-10-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/007-native-engine-runtime/spec.md`

## Summary

La web pasa de lanzar `java -jar … output.json` por análisis y leer `output*.json` del `cwd` a mantener **un proceso del motor en modo MCP** (`java -jar engine.jar --mcp`) por servidor, controlado con `@modelcontextprotocol/sdk` (`StdioClientTransport`), y a exponer **jobs asíncronos** persistidos en disco (`.archview/jobs/<id>/`): `POST /api/analyses` → `202 {jobId}`, `GET /api/analyses/{id}`, `GET /api/analyses/{id}/graph|architecture|contracts`, `POST /api/analyses/import`. La carga se valida por streaming (límite 200 MB, zip-slip, symlinks, bomba ZIP), con cuota de concurrencia, TTL y limpieza. `/api/source` exige `jobId` + ruta relativa contenida tras `realpath` y extensión permitida. El motor recibe cambios mínimos y aditivos en el núcleo compartido: fases de progreso (`notifications/progress`), parámetro `language` (MCP y CLI), caché en memoria por `(realPath, language, huella mtime/tamaño)` y advertencias pobladas y expuestas en `_meta` del resultado MCP y en `stderr` del CLI, **sin cambiar el contrato 1.0.0**. `/api/analyze` (006) se conserva como adaptador CLI obsoleto con `cwd` aislado. Exposición (decisión A3): las respuestas de jobs no exponen rutas absolutas (raíz del proyecto relativa, rutas de `components[*].files` relativizadas al servir), token compartido opcional `DEVARCH_API_TOKEN` (`Authorization: Bearer`, 401 si falta o no coincide) y advertencia destacada al arrancar si la web escucha fuera de loopback sin token. Concurrencia (decisión A2): la prueba de motor concurrente vs secuencial (TS-064) pasa a la fase fundacional; el valor por defecto de `MAX_CONCURRENT_ANALYSES` es 1 hasta que pasa y 2 después. Criterio de salida verificado con Playwright (librería) dentro de Cucumber-JS.

## Technical Context

**Language/Version**: Java 17 (motor, Maven), C# .NET 8 (analizador; sin cambios de código previstos), TypeScript 5 / Node ≥ 20 (web Next.js 15.3.8 runtime Node, pruebas de aceptación)
**Primary Dependencies**: existentes (Spoon, Jackson, MCP Java SDK 1.1.0, Roslyn, Next.js, `adm-zip`, `@static-inference/schema`, zod 3.25); **nuevas**: `@modelcontextprotocol/sdk` 1.32.x (runtime web, research D1) y `playwright` 1.64.x (dev, raíz del producto, research D11)
**Storage**: sistema de archivos — `ARCHVIEW_DATA_DIR` (por defecto `web/.archview/`, ignorado por git); sin base de datos
**Testing**: JUnit 5 + Cucumber-JVM (motor; runner nuevo `@engine`), `node:test` + `tsx` (web unitarias), Cucumber-JS (aceptación 007 web; `@slow` con `DEVARCH_E2E=true`), Playwright vía Cucumber-JS (`@e2e`)
**Target Platform**: servidor Node de larga vida con JDK 17 (+ .NET 8 para proyectos .NET) — macOS/Linux en desarrollo y CI (`ubuntu-latest`); no serverless
**Project Type**: producto web + motor (monorepo de producto `apps/dev-arch`)
**Performance Goals**: registro de job < 2 s (SC-004); ZIP Java demo → propuestas en UI < 2 min (SC-003); segunda consulta MCP cacheada < 20 % del tiempo de la primera (SC-008); fallo por caída del motor < 10 s (SC-009)
**Constraints**: contrato 1.0.0 inmutable; salidas byte-idénticas sin opciones nuevas (I, IV); Checkstyle ≤ 4763, SpotBugs 0, `dotnet format` limpio (FR-028); escenarios y aserciones de 001–006 intactos (incluidos TS-012, TS-014..TS-019, TS-025, TS-030 de 006); `make e2e` sigue siendo marcador de 011; Constitución sin enmiendas
**Scale/Scope**: 9 historias, 37 FR, 15 SC; ~15 archivos nuevos en `web/src/server/**` y `web/src/app/api/**`, ~8 clases Java tocadas/nuevas, 1 job CI nuevo

## Constitution Check

*GATE: evaluado antes de research y re-evaluado tras el diseño.*

```
CONSTITUTION GATE ACTIVE — CONSTITUTION.md v1.0.0 (6 principios + Quality Standards + Workflow + Governance)
```

| Principio / regla | Evaluación | Estado |
|-------------------|------------|--------|
| I. CLI operativo; JSON = contrato público; misma salida CLI/MCP | `language` es opcional y aditivo en ambos modos (research D5); advertencias fuera del contenido validado (`_meta`, `stderr`) sin tocar el contrato 1.0.0 (D4); `/api/analyze` conserva petición/respuesta (D9). Pruebas existentes de paridad intactas (FR-027) | PASS |
| II. Lógica en el núcleo; adaptadores delgados | Fases, selección de lenguaje, caché y advertencias viven en `com.extractor.service`; MCP solo traduce a `notifications/progress`/`_meta`; CLI solo parsea `--language` e imprime advertencias; la web no duplica análisis | PASS |
| III. TDD; no modificar aserciones; pruebas existentes pasan | testify antes de tasks; cada tarea de producción va precedida de su prueba roja; SC-012 + verificación `git diff` de aserciones/`.feature`/`context.json` de 001–006 en analyze/implement | PASS |
| IV. Determinismo | Progreso y caché no alteran la serialización; pruebas byte a byte con/sin progreso, con/sin caché, secuencial vs concurrente, CLI vs MCP (SC-007) | PASS |
| V. Degradación con errores claros | Advertencias expuestas; errores con código + mensaje accionable (`ENGINE_NOT_BUILT`, `AMBIGUOUS_PROJECT`, `TIMEOUT`, …); MCP `isError` con mensaje | PASS |
| VI. Huella mínima; fat JAR; sin infraestructura extra | Motor: 0 dependencias nuevas, sigue siendo fat JAR + analizador .NET; caché solo en memoria. Web (alcance por extensión): 1 dependencia runtime (SDK MCP, aprobada en D2 del plan) y 1 dev (Playwright, criterio de salida) — justificadas en research D1/D11 | PASS (justificado) |
| Quality: contract tests de tools MCP | Nuevas pruebas de contrato para `language`, progreso y `_meta` (contracts/engine-mcp.md) | PASS |
| Quality: análisis estático resuelto | Umbrales sin cambio (FR-028) | PASS |
| Workflow: rama + PR, conventional commits; breaking schema ⇒ bump | Sin cambio breaking: no hay bump de contrato | PASS |
| Governance: no enmendar | Sin enmiendas | PASS |

**Post-design re-check**: PASS. Riesgos vigilados en Complexity Tracking: (a) reentrada del motor con 2 llamadas concurrentes (research R1), (b) dependencia transitiva amplia del SDK MCP.

## Architecture

```text
                Browser (UI: upload / progress / results / source viewer / import)
                   │  fetch (poll 1 s)                   ▲ localStorage: activeJobId only
                   ▼                                     │
 ┌──────────────────────────────────── Next.js server (Node runtime, long-lived) ───────────────────────────┐
 │  every /api/analyses*, /api/source, /api/analyze ──► API Token Guard (DEVARCH_API_TOKEN, 401)            │
 │  POST /api/analyses ──► Upload Guard (stream, limits, zip-slip) ──► Job Store (.archview/jobs/<id>/)      │
 │  GET  /api/analyses/{id}[/graph|architecture|contracts] ◄── Path Redactor (relative paths) ◄── Job Store │
 │  POST /api/analyses/import ──► Contract Validator (@static-inference/schema) ──► Job Store               │
 │  GET  /api/source?jobId&path ──► Source Sandbox (realpath containment, allowlist) ──► Job Store          │
 │  POST /api/analyze (deprecated) ──► CLI spawn (cwd=<job>/out) ──► Job Store                              │
 │                                                                                                          │
 │  Job Runner (semaphore 1→2 after TS-064, queue 10, per-project mutex, timeout, TTL Cleaner via instrumentation.ts)      │
 │        │ analyze_project{projectPath, outputDir, language} + progressToken                               │
 │        ▼                                                                                                 │
 │  Engine Client (MCP SDK, StdioClientTransport, singleton, restart/backoff, stderr → logs)                 │
 └────────┬─────────────────────────────────────────────────────────────────────────────────────────────────┘
          │ stdio JSON-RPC (notifications/progress, result._meta warnings)
          ▼
 ┌──────────────── Java Engine (java -jar engine.jar --mcp) ────────────────┐     ┌──────────────────────┐
 │ MCP adapter (AnalyzeProjectTool, get_* tools)                            │     │ CLI adapter          │
 │        ▼                                                                 │     │ (--language, stderr  │
 │ AnalysisService (core): phases · language · AnalysisCache · warnings     │◄────│  warnings)           │
 │        ▼                                     ▼                           │     └──────────────────────┘
 │ JavaSpoonAnalyzer                    DotNetBridgeAnalyzer ───────────────┼──► dotnet-analyzer (Roslyn)
 └──────────────────────────────────────────────────────────────────────────┘
```

## Design Notes

1. **Orden de implementación** (dependencias): motor (núcleo → adaptadores) ∥ web fundacional (configuración, job store, upload guard, locator) → engine client → job runner + API de jobs → visor → importación → UI → ruta obsoleta → CI/e2e. El cliente web se prueba contra un servidor MCP falso (script Node) para no depender del motor en pruebas unitarias.
2. **Motor — núcleo** (`engine/src/main/java/com/extractor/service/`): `AnalysisPhase`, `AnalysisProgressListener`, `AnalysisLanguage`, `AnalysisOptions`, `AnalysisCache`, `TreeFingerprint`; `AnalysisService` gana sobrecargas `analyzeProject(Path, AnalysisOptions, AnalysisProgressListener)` y equivalentes para `get_*` con `AnalysisOptions`; las firmas actuales delegan con `AUTO`/`NOOP` (compatibilidad de API interna y de pruebas existentes). `JavaSpoonAnalyzer.getWarnings()` reporta archivos no modelados. Detalle: [contracts/engine-mcp.md](./contracts/engine-mcp.md), research D3–D6. Cubre FR-023, FR-024, FR-025, FR-026, FR-027.
3. **Motor — adaptadores**: `ToolSchemas` (+`language` en 5 tools), `AnalyzeProjectTool` (token de progreso, fase WRITING, `_meta`), `Get*Tool` (`language`), `McpServerMain` (instancia `AnalysisService` con `AnalysisCache`), `MicroserviceInferenceMain` (`--language`, `[warning]` a stderr). Calidad: FR-028 (ratchet Checkstyle 4763 sin subir, SpotBugs 0).
4. **Web — configuración** (`web/src/server/config.ts`): lee y valida research D13 una vez; errores con nombre de variable. FR-005, FR-011, FR-012, FR-013, FR-015, FR-018, FR-030.
5. **Web — job store** (`web/src/server/jobs/job-store.ts`): [data-model.md](./data-model.md); escritura atómica; ids UUID validados. FR-001, FR-002, FR-008, FR-009.
6. **Web — upload guard** (`web/src/server/upload/`): `stream-to-file.ts` (conteo de bytes), `safe-extract.ts` (validación del directorio central + extracción manual con conteo real), `project-root.ts` (regla de 006). Research D8. FR-013, FR-014, FR-015, FR-016; SC-005.
7. **Web — engine** (`web/src/server/engine/`): `engine-locator.ts` (extiende `engine-path.ts` de 006 sin romper TS-016/TS-017), `engine-client.ts` ([contracts/engine-client.md](./contracts/engine-client.md)). FR-029, FR-031, FR-032; SC-009.
8. **Web — job runner** (`web/src/server/jobs/job-runner.ts`, `cleaner.ts`, `web/src/instrumentation.ts`): cola, semáforo, mutex por proyecto, extracción del ZIP, timeout, reciclado, recuperación al arrancar, limpieza TTL. FR-009, FR-010, FR-011, FR-012, FR-030; SC-011.
9. **Web — API** (`web/src/app/api/analyses/route.ts`, `[id]/route.ts`, `[id]/[doc]/route.ts`, `import/route.ts`, `source/route.ts`): [contracts/analyses-api.md](./contracts/analyses-api.md). FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-017, FR-018, FR-020, FR-021, FR-022; SC-004, SC-006, SC-010.
10. **Web — UI** (`software-architecture-analyzer.tsx`, `code-viewer.tsx`, `component-details.tsx`, nuevos `analysis-progress.tsx`, `import-dialog.tsx`, `web/src/lib/analyses-client.ts`): subida por cuerpo binario, selector de lenguaje, polling 1 s (máximo 2 s con backoff, para reflejar cambios en ≤ 3 s), fases en español (detección, extracción, inferencia, escritura), advertencias, `localStorage['devarch.activeJobId']` (sin datos de resultados), visor con `jobId` + ruta relativizada contra `projectRoot`, mensaje de caducidad. Atributos `data-testid` estables para Playwright (`upload-input`, `language-select`, `analysis-status`, `analysis-phase`, `proposal-card`, `component-node`, `analysis-warnings`, `import-input`). FR-007, FR-019; SC-001, SC-002, SC-003.
11. **Ruta obsoleta** (`web/src/app/api/analyze/route.ts`): research D9; `analyze-route.test.ts` y TS-014/TS-015/TS-018/TS-019 de 006 siguen verdes sin cambios. FR-033.
12. **Pruebas**: research D12. `.archview/` en `.gitignore` del producto. `cucumber.mjs` añade `specs/007-native-engine-runtime/tests/features/**/*.feature` con `not @engine` (y `not @e2e` salvo `make test-e2e-browser`). Runner JVM `RunNativeEngineRuntimeFeaturesTest` (tags `@engine`, glue `com.extractor.runtimebdd`). Catálogos: `tests/acceptance/support/zip-catalog.ts` (ZIP maliciosos generados en tiempo de prueba, sin binarios en git) y catálogo de escapes del visor.
13. **CI** (`.github/workflows/dev-arch.yml` en la raíz del monorepo): filtro `acceptance` + `apps/dev-arch/specs/007-*/tests/**`; job nuevo `e2e-browser` (research D11) con `if` compuesto, JDK 17/.NET 8/Node 20, `make build`, `npx playwright install --with-deps chromium`, `make test-e2e-browser`, `timeout-minutes: 30`. TS-025/TS-027/TS-028/TS-029/TS-030 de 006 no cambian de resultado.
14. **Determinismo y paridad (SC-007)** — la parte (e) concurrente vs secuencial (TS-064) es fundacional (decisión A2) y condiciona el valor por defecto de `MAX_CONCURRENT_ANALYSES` (1 hasta que pasa, 2 después; research D2): prueba de motor que compara byte a byte (a) CLI vs MCP sobre `java-standar` y `dotnet-ecommerce` con `language` explícito y `auto`, (b) dos ejecuciones consecutivas, (c) respuesta cacheada vs nueva, (d) con y sin `progressToken`, (e) dos llamadas concurrentes vs secuenciales; y prueba `@slow` web↔CLI sobre la misma `localPath`.
15. **Exposición de la API (decisión A3)** (`web/src/server/security/api-token.ts`, `web/src/server/security/path-redaction.ts`, `web/src/server/security/bind-warning.ts`): (a) **token** — `DEVARCH_API_TOKEN` (vacío o solo espacios = sin token); si existe, cada route handler de `/api/analyses*`, `/api/source` y `/api/analyze` llama a `requireApiToken(request)` como primera instrucción (antes de la cuota y de leer el cuerpo): exige `Authorization: Bearer <token>`, comparación en tiempo constante (`crypto.timingSafeEqual` sobre SHA-256 de ambos valores), si no → `401 {"error":{"code":"UNAUTHORIZED","message":"…"}}` + `WWW-Authenticate: Bearer realm="dev-arch"`; la respuesta 401 es idéntica exista o no el job. (b) **rutas** — `job.json` conserva `projectRoot` absoluto (uso interno del runner y del visor); la API expone `projectRoot` relativo (nombre de la carpeta raíz dentro de `source/`, `.` si la raíz es `source/`, o el nombre base de la carpeta local) y sirve `graph|architecture|contracts` aplicando sobre el texto del documento la relativización determinista `redactDocument(text, roots)`: elimina el prefijo `<raíz>/` (en forma JSON-escapada, para la ruta pasada al motor y su `realpath`) y sustituye la raíz exacta por `.`; así el formato de Jackson se conserva byte a byte y la comparación con el CLI (SC-007, TS-065) aplica la misma función. Advertencias y mensajes de error del job pasan por `redactText` (raíz → relativa, `ARCHVIEW_DATA_DIR` → `<data>`). Excepciones FR-034: `ENGINE_NOT_BUILT` (FR-032), `/api/analyze` (FR-033) y documentos importados. (c) **advertencia de exposición** — en `instrumentation.ts` `register()`: dirección de escucha = `HOSTNAME` de entorno, o argumento `-H`/`--hostname` de `process.argv`, o, si no hay ninguno, todas las interfaces (comportamiento por defecto de `next start`/`next dev`); si no es loopback (`localhost`, `127.0.0.0/8`, `::1`) y no hay token → `console.warn` de un bloque con marco `!!!` que dice "dev-arch API is NOT protected: listening on <host> without DEVARCH_API_TOKEN. Set DEVARCH_API_TOKEN=<secret> or bind to 127.0.0.1." (documentado en `web/docs/ENVIRONMENT.md`). (d) **UI** — `analyses-client.ts` añade `Authorization` si hay token en `sessionStorage['devarch.apiToken']`; ante 401 muestra un campo `data-testid="api-token-input"` para introducirlo y reintenta. FR-034, FR-035, FR-036; SC-013, SC-014.
16. **Fallos de almacenamiento (FR-037, SC-015)**: `stream-to-file`, `safe-extract` y la lectura de resultados capturan errores de E/S; `ENOSPC`/`EDQUOT` → código `STORAGE_FULL` ("Insufficient disk space while <fase>"), otros → `IO_ERROR`; el envío responde `507 STORAGE_FULL` (o el job pasa a `failed`) y se borra el área (envío) o `source/`/`out/` parciales (job). El runner y la ruta reciben las funciones de E/S por inyección (`JobRuntimeDeps`) para simular el fallo en pruebas sin llenar el disco.
17. **Fuera de alcance**: cuentas de usuario/autorización por análisis (solo token compartido), cancelación explícita por el usuario, contrato 1.1.0, separación extracción/inferencia (Fase 4, D4 del plan), `ignoreBuildErrors` (Fase 6), Docker (Fase 6b), enmienda constitucional (Fase 7).

## Requirement → design map

| Requisitos | Diseño |
|------------|--------|
| FR-001, FR-002, FR-003, FR-004, FR-006 | Notes 5, 8, 9; contracts/analyses-api.md |
| FR-005 | Notes 4 (`allowLocalPath`), 9 |
| FR-007, FR-019 | Note 10 |
| FR-008, FR-009, FR-010, FR-011, FR-012 | Notes 5, 8; research D2, D7 |
| FR-013, FR-014, FR-015, FR-016 | Note 6; research D8 |
| FR-017, FR-018 | Note 9; research D10 |
| FR-020, FR-021, FR-022 | Note 9; research D10 |
| FR-023, FR-024, FR-025, FR-026, FR-027, FR-028 | Notes 2, 3, 14; contracts/engine-mcp.md |
| FR-029, FR-030, FR-031, FR-032 | Notes 7, 8; research D1, D14 |
| FR-033 | Note 11; research D9 |
| FR-034, FR-035, FR-036 | Note 15; contracts/analyses-api.md (Authentication, Path exposure); research D15 |
| FR-037 | Note 16; research D7 |
| SC-001, SC-002, SC-003 | Notes 10, 12, 13 (Playwright `@e2e`) |
| SC-004 | Note 9 + nota abajo |
| SC-005, SC-006 | Notes 6, 9, 12 (catálogos) |
| SC-007, SC-008 | Note 14; research D6 |
| SC-009 | Note 7; research D14 |
| SC-010 | Note 9 (fixtures `schema/fixtures/valid` e `invalid`) |
| SC-011 | Note 8 |
| SC-012 | Constitution Check III; Notes 11, 13 |
| SC-013, SC-014 | Note 15 |
| SC-015 | Note 16 |

> SC-004: para responder en < 2 s, `POST` persiste el cuerpo por streaming y valida el directorio central del ZIP (rutas, symlinks, tamaños declarados, entradas); la extracción con conteo real y el análisis los hace el runner. Si la extracción detecta un tamaño real mayor al declarado, el job pasa a `failed` (`UNCOMPRESSED_TOO_LARGE`) y se borra su área.

## Project Structure

### Documentation (this feature)

```text
specs/007-native-engine-runtime/
  spec.md · plan.md · research.md · data-model.md · quickstart.md
  contracts/analyses-api.md · contracts/engine-mcp.md · contracts/engine-client.md
  checklists/requirements.md
  tests/features/*.feature      # /iikit-04-testify
  tasks.md                      # /iikit-05-tasks
```

### Source Code (producto `apps/dev-arch`)

```text
engine/src/main/java/com/extractor/
  MicroserviceInferenceMain.java            # --language, [warning] stderr
  service/AnalysisService.java              # options, listener, cache, warnings
  service/{AnalysisPhase,AnalysisProgressListener,AnalysisLanguage,AnalysisOptions,AnalysisCache,TreeFingerprint}.java   # nuevos
  analyzer/JavaSpoonAnalyzer.java           # getWarnings()
  mcp/ToolSchemas.java · mcp/McpServerMain.java · mcp/tools/*.java
engine/src/test/java/com/extractor/
  service/*Test.java · mcp/tools/*Test.java · integration/NativeRuntimeParityTest.java
  runtimebdd/{RunNativeEngineRuntimeFeaturesTest,*Steps}.java
web/src/
  instrumentation.ts
  server/config.ts · server/runtime.ts        # singleton por proceso: config, store, cliente del motor, runner
  server/engine/{engine-locator,engine-client}.ts (+ .test.ts)
  server/jobs/{job-store,job-runner,cleaner}.ts (+ .test.ts)
  server/upload/{stream-to-file,safe-extract,project-root}.ts (+ .test.ts)
  server/source/source-sandbox.ts (+ .test.ts)
  server/import/import-validator.ts (+ .test.ts)
  server/security/{api-token,path-redaction,bind-warning}.ts (+ .test.ts)
  app/api/analyses/route.ts · [id]/route.ts · [id]/[doc]/route.ts · import/route.ts
  app/api/source/route.ts · app/api/analyze/route.ts (obsoleta)
  lib/analyses-client.ts
  components/{software-architecture-analyzer,code-viewer,component-details,analysis-progress,import-dialog}.tsx
tests/acceptance/
  steps/native-runtime-*.steps.ts · support/{browser,fake-mcp-server,zip-catalog}.ts
cucumber.mjs · package.json (playwright, test:e2e) · Makefile (test-e2e-browser) · .gitignore (.archview/)
<monorepo>/.github/workflows/dev-arch.yml   # job e2e-browser, filtro acceptance
```

**Structure Decision**: se extiende la estructura de 006 (áreas `engine/`, `web/`, `schema/`, `tests/acceptance/`); el código de servidor de la web vive bajo `web/src/server/` (ya iniciado en 006) y las rutas en `web/src/app/api/`.

## Complexity Tracking

| Riesgo / desviación | Por qué | Alternativa más simple descartada |
|---------------------|---------|-----------------------------------|
| Dependencia runtime `@modelcontextprotocol/sdk` con transitivas amplias (express, hono, ajv) | Decisión D2 del plan aprobada; timeouts, cancelación y progreso probados | Cliente JSON-RPC propio — menos peso, pero reimplementa protocolo (research D1) |
| Dos llamadas concurrentes al mismo proceso del motor | Cuota 2 sin dos JVM (memoria); habilitada solo tras pasar TS-064 en la fase fundacional (decisión A2) | Concurrencia 1 (valor por defecto hasta TS-064 y fallback si R1 falla) |
| Ruta `/api/analyze` (CLI) junto al flujo MCP | Escenarios bloqueados de 006 (TS-018) | Eliminarla o fachada MCP — rompe aserciones bloqueadas |
| Advertencias en `_meta` en vez del JSON contractual | Contrato 1.0.0 cerrado + aserciones bloqueadas sobre `1.0.0` | Contrato 1.1.0 — requiere re-testify de 005/006 (propuesto para feature futura) |
| Job CI `e2e-browser` con `if` compuesto (no "job de área") | Debe correr con cambios de web o motor sin alterar TS-025/TS-030 | Paso dentro del job `web` (requiere JDK/.NET/build en ≤ 20 min) |
