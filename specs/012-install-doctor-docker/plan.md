# Implementation Plan: Instalación guiada — doctor e imagen Docker / Compose

**Branch**: `012-install-doctor-docker` | **Date**: 2026-10-10 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/012-install-doctor-docker/spec.md`

## Summary

(1) Doctor en Node 20 sin dependencias en `scripts/doctor/` (definición única `requirements.mjs`, verificaciones
puras `checks.mjs` sobre un sistema inyectable, sondas reales `system.mjs`, salida `format.mjs`, comando
`doctor.mjs`, entrada `cli.mjs`), expuesto como `npm run doctor`, `bin.dev-arch` del paquete raíz (`npx dev-arch
doctor`) y `make check-env`; `make doctor` sin cambios. (2) Motor: clase nueva `com.extractor.EngineDoctor` y rama
`--doctor` en `MicroserviceInferenceMain` (una línea JSON; reutiliza `DotNetToolLocator`, `SchemaVersion` y la
versión del servidor MCP). (3) Web: `src/server/health/health.ts` + `src/app/api/health/route.ts` que ejecutan el
doctor (`--json --only …`) con caché de 30 s y añaden el PID del proceso MCP. (4) `docker/Dockerfile` multi-etapa,
`docker/Dockerfile.dockerignore`, `docker/compose.yaml` (perfil por defecto + `dev`), `docker/smoke-test.sh`,
salida `standalone` de Next solo con `NEXT_OUTPUT=standalone`. (5) Trabajo de CI `docker` (build, `compose up`,
salud, doctor, análisis de demo, push a GHCR en tags). (6) `docs/INSTALL.md` con la tabla generada entre marcadores.

## Technical Context

**Language/Version**: Node 20 ESM (`.mjs`, doctor), TypeScript 5 (web, pasos), Java 17 (motor), YAML (Compose, Actions), Dockerfile (BuildKit 1.7), Bash (smoke)
**Primary Dependencies**: solo existentes (Next 15.3.8, Jackson, Cucumber-JS 11, tsx, `yaml` 2.9 para validar Compose/Workflow en las pruebas); imágenes base `maven:3.9-eclipse-temurin-17`, `mcr.microsoft.com/dotnet/sdk:8.0`, `node:20-bookworm-slim`, `eclipse-temurin:17-jre`, `mcr.microsoft.com/dotnet/runtime:8.0-bookworm-slim`, `node:20-bookworm`
**Storage**: N/A (volumen Docker `dev-arch-data` montado en `ARCHVIEW_DATA_DIR=/data`)
**Testing**: `node --test` (doctor: `scripts/doctor/*.test.mjs`), `node --test` + tsx (web, `run-tests.mjs` con umbral 85 %), JUnit 5 (motor, `EngineDoctorTest`), Cucumber-JS (escenarios de 012), CI real para la imagen
**Target Platform**: macOS / Linux / Windows (doctor), linux/amd64 y linux/arm64 (imagen)
**Project Type**: producto monorepo `apps/dev-arch`
**Performance Goals**: doctor local < 15 s (incluye `java -jar --doctor`); salud cacheada < 50 ms
**Constraints**: aditivo (001–011 intactos); 006 TS-001 (entradas raíz permitidas), TS-012 (`make doctor`), TS-013 (workspaces `web`,`schema`), TS-025/TS-029/TS-030 (CI); Checkstyle ≤ 4589 (sun_checks), SpotBugs 0; cobertura web ≥ 85 %
**Scale/Scope**: 12 requisitos, 2 modos, 4 gestores de sugerencias

## Constitution Check

| Principio | Estado | Nota |
|---|---|---|
| I. Compatibilidad | PASS | `--doctor` es una rama nueva antes de la validación de argumentos; las salidas de análisis, el uso de 2 argumentos y `--mcp` no cambian |
| II. Fuente única | PASS | `EngineDoctor` no analiza; reutiliza `DotNetToolLocator`, `SchemaVersion.CURRENT` y la versión del recurso filtrado. El doctor de Node consulta al motor en lugar de duplicar su localización |
| III. TDD | PASS | Escenarios de 012 y pruebas unitarias (doctor, salud, `EngineDoctor`) en rojo antes de implementar |
| IV. Determinismo | PASS | `--doctor` no toca la salida de análisis; claves en orden fijo |
| V. Errores claros | PASS | Cada verificación con detalle y sugerencia; salud 503 con motivo |
| VI. Huella mínima | PASS | Sin dependencias nuevas; el JAR sigue siendo un único artefacto; la imagen es un empaquetado opcional |

## Project Structure

### Documentation (this feature)

```text
specs/012-install-doctor-docker/
├── spec.md · plan.md · research.md · data-model.md · quickstart.md · tasks.md
├── contracts/ (doctor-cli.md, health-api.md, engine-doctor.md, container.md)
├── checklists/requirements.md
└── tests/features/*.feature
```

### Source Code (repository root = apps/dev-arch)

```text
scripts/doctor/          requirements.mjs · checks.mjs · system.mjs · format.mjs · doctor.mjs · cli.mjs · *.test.mjs   (NUEVO)
package.json             + scripts.doctor, + bin.dev-arch                                                         (MOD)
Makefile                 + check-env (doctor intacto)                                                             (MOD)
scripts/test.sh          + subconjunto doctor (node --test) en `all`                                              (MOD)
engine/src/main/java/com/extractor/EngineDoctor.java                                                              (NUEVO)
engine/src/main/java/com/extractor/MicroserviceInferenceMain.java   + rama --doctor                               (MOD)
engine/src/main/java/com/extractor/mcp/McpServerMain.java           serverVersion() pública                       (MOD)
engine/src/test/java/com/extractor/EngineDoctorTest.java                                                          (NUEVO)
web/src/server/health/health.ts · health.test.ts                                                                  (NUEVO)
web/src/app/api/health/route.ts · route.test.ts                                                                   (NUEVO)
web/next.config.ts       output 'standalone' + outputFileTracingRoot solo con NEXT_OUTPUT=standalone              (MOD)
docker/Dockerfile · Dockerfile.dockerignore · compose.yaml · smoke-test.sh · README.md                            (NUEVO/MOD)
docs/INSTALL.md                                                                                                   (NUEVO)
tests/acceptance/steps/install-*.steps.ts                                                                         (NUEVO)
cucumber.mjs             + specs/012-…/tests/features                                                             (MOD)
.github/workflows/dev-arch.yml   + filtro `docker` y `specs/012-*` en acceptance; + trabajo `docker`              (MOD, raíz del monorepo)
```

**Structure Decision**: `tools/doctor/` (pedido por el usuario) y `compose.yaml` en la raíz violarían 006 TS-001
(lista cerrada de entradas raíz) y añadir un workspace violaría TS-013; se usan `scripts/doctor/` (orquestación,
permitido) y `docker/compose.yaml` (área `docker`). Registrado como default pendiente de confirmar en la spec.

## Architecture

```text
npm run doctor ─┐
npx dev-arch ───┼─► scripts/doctor/cli.mjs ─► doctor.mjs (args) ─► checks.runDoctor(sys, {mode, only})
make check-env ─┘                                                    │  REQUIREMENTS (requirements.mjs)
                                                                     ├─ sys.exec(java -version | mvn -v | dotnet --list-* | npm -v | docker …)
                                                                     └─ java -jar engine.jar --doctor ─► EngineDoctor (DotNetToolLocator)
GET /api/health ─► server/health.ts ─► node scripts/doctor/cli.mjs --json --only jdk,dotnet-runtime,engine-jar,dotnet-analyzer,env,resources
                                   └─► runtime.engine.pid()  (cache 30 s del informe; PID siempre actual)
docker/Dockerfile: engine(maven) · analyzer(sdk8, RID por TARGETARCH) · web(node20, standalone) ─► runtime(dotnet runtime 8 + JRE17 + node, USER app, HEALTHCHECK) · dev
docker/compose.yaml: web (sin perfil = default) · web-dev (profile dev, puerto 9003, fuentes montadas)
CI docker job: compose build → up -d → smoke-test.sh (healthy, doctor --mode docker, doctor en contenedor, análisis java-standar) → push GHCR (tags)
```

## Complexity Tracking

| Elemento | Justificación |
|---|---|
| Trabajo de CI `docker` con condición compuesta (no es de área) | 006 TS-025 exige disparo exacto por área; el trabajo de contenedor no puede ser de área sin cambiar los ejemplos bloqueados |
| Salida `standalone` condicionada por variable | El modo por defecto (`next start`, e2e de 007/010) no cambia; solo la imagen usa `standalone` |
| Doctor como proceso hijo desde la web | Reutiliza exactamente el mismo módulo sin copiarlo dentro del bundle de Next ni configurar `externalDir` |
