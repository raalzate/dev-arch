# Research: 012-install-doctor-docker

## D1 — Ubicación del doctor y de Compose (restricciones bloqueadas de 006)

- **Decision**: `scripts/doctor/` y `docker/compose.yaml`; `npx dev-arch` vía `bin` del `package.json` raíz.
- **Rationale**: 006 TS-001 limita las entradas de la raíz del producto a las áreas (`web`, `engine`, `schema`, `skills`, `docs`, `docker`) y a una lista cerrada (`scripts`, `Makefile`, `package.json`, …); `tools/` y `compose.yaml` en la raíz la romperían. 006 TS-013 exige exactamente los workspaces `web` y `schema`, así que el doctor no puede ser un workspace. `npm exec` (npm ≥ 7) ejecuta el binario del propio proyecto cuando su nombre coincide (verificado con npm 11 en un proyecto temporal: `npx --offline dev-arch doctor` → ejecuta `bin/cli.mjs`).
- **Alternatives**: `tools/doctor/` (rompe TS-001); workspace `tools/doctor` (rompe TS-013); binario en `web/package.json` (acopla el doctor a la web).

## D2 — Detección de versiones

- **Decision**: `java -version` (stderr, `version "X"`; `1.8` → 8) con `JAVA_HOME/bin/java` si está definido; `mvn -v` o `engine/mvnw`; `dotnet --list-sdks` / `--list-runtimes` (`Microsoft.NETCore.App 8.*`) con `DOTNET_ROOT/dotnet` si existe; `process.version` + `npm -v`; `docker version --format {{.Server.Version}}` (daemon) con respaldo `docker --version`; `docker compose version --short`; Windows: `vswhere -latest -requires Microsoft.Component.MSBuild -property installationVersion`.
- **Rationale**: son las fuentes del plan; `--list-runtimes` distingue SDK 10 de runtime 8 (el analizador es `net8.0` dependiente del framework y no avanza de versión mayor).
- **Alternatives**: `dotnet --info` (texto no estable).

## D3 — Versión del analizador .NET

- **Decision**: leer `dotnet-analyzer.deps.json` (clave `"dotnet-analyzer/<versión>"`) junto al ejecutable o en `dotnet-analyzer-publish/`.
- **Rationale**: el analizador no tiene opción `--version` y añadirla tocaría el contrato del analizador; el manifiesto de publicación lleva la versión del proyecto (`<Version>` sincronizada con `VERSION`).

## D4 — Autodiagnóstico del motor

- **Decision**: `java -jar engine.jar --doctor` → una línea JSON `{"engine","version","schema_version","java_version","dotnet_analyzer":{"found","path"}}` con `LinkedHashMap` (orden fijo), código 0. Clase `com.extractor.EngineDoctor` (paquete existente: sin `package-info` nuevo para Checkstyle) y `McpServerMain.serverVersion()` pública para la versión.
- **Rationale**: Constitución II (sin duplicar la localización), I y IV (no toca análisis ni herramientas MCP; 001/005 bloquean la lista de herramientas).
- **Alternatives**: herramienta MCP nueva (cambiaría `tools/list`, bloqueado).

## D5 — Endpoint de salud

- **Decision**: la ruta ejecuta `node <producto>/scripts/doctor/cli.mjs --json --mode local --only jdk,dotnet-runtime,engine-jar,dotnet-analyzer,env,resources` (ruta sobreescribible con `DEVARCH_DOCTOR_CLI`), cachea el informe 30 s y añade `mcpProcess` según `EngineClient.pid()`. 200 sin FAIL, 503 con FAIL o doctor roto.
- **Rationale**: reutiliza exactamente el mismo módulo; importar `.mjs` de fuera de `web/` exigiría `experimental.externalDir` y trazado de archivos en `standalone`.

## D6 — Imagen

- **Decision**: etapas `engine` (Maven, `-Dmaven.test.skip=true package`), `analyzer` (`dotnet publish -r linux-x64|linux-arm64 --self-contained false`, lanzador `dotnet-analyzer` + `dotnet-analyzer-publish/` como `scripts/engine-build.sh`), `web` (`npm ci`, `NEXT_OUTPUT=standalone npm run build -w web`), `runtime` sobre `dotnet/runtime:8.0-bookworm-slim` + JRE 17 copiado de `eclipse-temurin:17-jre` + `node` copiado de `node:20-bookworm-slim`, `USER app`, `HEALTHCHECK` con `fetch` de Node (sin curl), y `dev` sobre `node:20-bookworm` + JRE + runtime .NET.
- **Rationale**: "imagen final con JRE 17 + runtime .NET 8 + Next standalone, sin SDKs" (plan). La base de runtime .NET aporta las dependencias nativas (ICU, libstdc++) que necesitan .NET y Node.
- **Consecuencia**: sin SDK, `MSBuildWorkspace` no está disponible y el analizador usa `AdhocWorkspace` (menor precisión semántica .NET); documentado en INSTALL.
- **`.dockerignore`**: `docker/Dockerfile.dockerignore` (BuildKit lo usa con `-f docker/Dockerfile`), porque un `.dockerignore` en la raíz del producto rompería TS-001.

## D7 — Validación local sin Docker

- **Decision**: pruebas Cucumber-JS de 012 que parsean el Dockerfile (instrucciones, etapas, `FROM`, `USER`, `HEALTHCHECK`, `COPY --from`) y Compose / Workflow con `yaml`; `hadolint`/`docker compose config` no están disponibles sin Docker (se documenta). El trabajo de CI ejecuta la construcción y la prueba de humo reales.

## D8 — Trabajo de CI `docker`

- **Decision**: filtro `docker` (`docker/**`, `scripts/doctor/**`, `web/src/app/api/health/**`, `web/src/server/health/**`, `web/next.config.ts`); `if: needs.changes.outputs.docker == 'true' || github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/tags/dev-arch-v')` (condición compuesta → no es trabajo de área para 006 TS-025/TS-030); `timeout-minutes: 45`; `permissions: packages: write`; push a `ghcr.io/<owner>/dev-arch:<VERSION>` y `:latest` solo en tags.

## D9 — Pruebas del doctor

- **Decision**: `node --test scripts/doctor/*.test.mjs` con un `sys` simulado por plataforma (darwin/linux/win32) y por requisito ausente; añadido a `scripts/test.sh all` (subconjunto `doctor`).
