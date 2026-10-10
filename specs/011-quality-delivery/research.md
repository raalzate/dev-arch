# Research: 011-quality-delivery

## D1 — Errores de tipos de la web (FR-001..003)

- Estado medido (2026-10-10, `tsc --noEmit -p web`): 68 errores. 35 × TS5097 (importaciones con extensión `.ts` en pruebas y en `schema/generated`, `schema/extensions`), 33 × TS2345 (objetos literales pasados como `NodeJS.ProcessEnv`, que Next amplía con `NODE_ENV` obligatorio).
- **Decision**: `allowImportingTsExtensions: true` en `web/tsconfig.json` (válido con `noEmit`; Next/SWC ya compila esas importaciones). Para TS2345 se introduce `type Env = Readonly<Record<string, string | undefined>>` en `web/src/server/env.ts` y las funciones de producción (`loadConfig`, `locateEngine`, `resolveEngineJar`, `listenHost`, `exposureWarning`, `resolveLlmProvider`…) aceptan `Env`.
- **Rationale**: corrige el código de producción (firma demasiado estricta) sin tocar pruebas bloqueadas ni módulos generados.
- **Alternatives**: excluir pruebas del tsconfig (prohibido por FR-002); editar pruebas (prohibido por la regla aditiva); cambiar el generador de 005 para emitir `.js` (cambia artefactos generados bloqueados de 005).

## D2 — Lint (FR-004)

- **Decision**: ESLint 9 + `eslint-config-next@15.3.8` mediante `FlatCompat` en `web/eslint.config.mjs`, extendiendo `next/core-web-vitals`; `next lint --max-warnings=…` no se usa (solo errores bloquean, como `next build`). Ignora `.next/`, `engine-dist/`, `coverage/`.
- **Alternatives**: `next/typescript` (cientos de `no-explicit-any` en código heredado; default pendiente de confirmar); ESLint 8 (fin de soporte).

## D3 — Ejecución de escenarios heredados (FR-006..010)

- Runners JUnit Platform Suite como los de 005/007/008/009: `@SelectDirectories("../specs/00X-…/tests/features")`, glue en paquete propio (`com.extractor.legacybdd.{mcp,dotnet,codeissues}`) para aislar pasos homónimos; informe JSON en `target/cucumber-reports/legacy-00X.json`. Cucumber 7 es estricto por defecto (indefinido/pendiente ⇒ fallo).
- Los pasos ejercen: CLI (`MicroserviceInferenceMain` en proceso o `java -jar` según el escenario), herramientas MCP en proceso (clases de 001) y el analizador .NET localizado por `DotNetToolLocator` (`engine/target/dotnet-analyzer`).
- Analizador ausente ⇒ `ToolAvailability.requireDotnetAnalyzer()` (convención existente, omitido con motivo). La propiedad `legacybdd.analyzer=absent` simula la ausencia para verificar la omisión (TS de US2).
- CI `engine-java`: `actions/setup-dotnet` 8 + `bash scripts/engine-build.sh --dotnet-only` antes de `mvn verify`.
- Si un escenario heredado revela un defecto del motor se corrige el motor; si contradice una decisión posterior registrada se detiene y se reporta.

## D4 — Cobertura (FR-011..015)

- Java: `jacoco-maven-plugin` 0.8.12 (`prepare-agent` + `report` en `verify`) → `engine/target/site/jacoco/{jacoco.xml,index.html}`. Surefire no define `argLine`, por lo que el agente se inyecta sin conflicto.
- .NET: `coverlet.collector` 6.0.2 en el proyecto de pruebas; `dotnet test --collect "XPlat Code Coverage" --results-directory engine/target/coverage/dotnet` → `coverage.cobertura.xml`.
- TS: cobertura integrada de Node (`--experimental-test-coverage`, reporter `lcov`), funciona en Node 20.20 con tsx (mapas de fuente). Node 20 no expande globs en `--test`: `web/scripts/run-tests.mjs` enumera las pruebas (corrige además `npm test -w web` en el Node 20 de CI).
- `web/scripts/run-tests.mjs --coverage` escribe `web/coverage/lcov.info` y `web/coverage/summary.json`, comprueba que cada módulo objetivo aparece y que el agregado de líneas ≥ 85 %.
- Resumen común: `scripts/coverage.sh summary` lee jacoco.xml (contador LINE), cobertura.xml (`line-rate`) y summary.json e imprime `[coverage] <stack>: <pct>% lines (<ruta>)`.
- Línea base medida (Node 25, 2026-10-10): 94,8 % de líneas sobre los módulos cargados, pero 8 de 9 rutas API, `runtime.ts`, `inference/routes.ts`, `lib/utils.ts`, `lib/analyses-client.ts` no se cargan en ninguna prueba unitaria.

## D5 — Release (FR-019..022)

- `scripts/release-check.sh <tag>`: acepta `dev-arch-v<VERSION>` exacto; si no, sale 1 con `tag X.Y.Z != VERSION A.B.C` (o `malformed tag`).
- Workflow: trabajo `release-version-check` (solo tags) del que dependen `release` y `release-skills`; la condición de `release` se mantiene (pasa con `skipped` en `main`). `release-skills` empaqueta `skills/` como `dev-arch-skills-<tag>.zip` + `.sha256` y lo adjunta a la misma release con `softprops/action-gh-release@v2`.

## D6 — Observabilidad (FR-023..028)

- `JobEventLog` (nuevo, `web/src/server/jobs/job-events.ts`) añade líneas JSON a `<job dir>/events.jsonl` (`ts`, `jobId`, `event`, `phase?`, `durationMs?`, `status?`, `code?`); escritura `appendFile` encadenada y con errores tragados (FR-027).
- Métricas en `Job.metrics = { queueMs, totalMs, phases: { detection?, extraction?, inference?, writing? } }` calculadas con un reloj inyectable y `Math.max(0, …)`; `publicJob` las expone (campo aditivo).
- Consola: `console.info(JSON.stringify({ level, msg: 'analysis finished', jobId, status, code, totalMs }))`.
- Rutas absolutas: los mensajes ya pasan por `redactText`; los eventos solo llevan identificadores, fases, códigos y duraciones.

## D7 — Analizador obsoleto (FR-029..030)

- Causa: `scripts/test.sh` solo publica si falta `engine/target/dotnet-analyzer`; `schema-check.sh` con `SCHEMA_CHECK_SKIP_BUILD=1` (valor por defecto dentro de `make test`) reutiliza `target/schema-check/dotnet-analyzer` sin mirar las fuentes.
- **Decision**: `scripts/dotnet-analyzer-freshness.sh <stamp> <src-dir> [--force]` imprime `reuse`, `rebuild: missing`, `rebuild: forced` o `rebuild: <archivo> is newer`; considera `*.cs`, `*.vb`, `*.csproj`, `*.props`, `*.targets`, `*.json` fuera de `bin/` y `obj/`. Tras publicar se escribe un sello `.published`. `test.sh` y `schema-check.sh` lo usan; `SCHEMA_CHECK_SKIP_BUILD=0` sigue forzando.

## D8 — BUG-007 (FR-032)

- Coste estimado de reproducción: alto (2 fallos en ~5 `mvn verify` completos de ~10 min; 0 en 40+ ejecuciones dirigidas).
- **Decision**: no se invierte en reproducción en 011. Hallazgo nuevo de la revisión: la comparación de TS-017 usa dos ejecuciones del analizador en el mismo directorio de proyecto; una hipótesis barata a verificar en la siguiente ocurrencia es la escritura concurrente en `obj/` del proyecto analizado por la carga de diseño de MSBuild mientras `dotnet test` corre en paralelo. Siguiente paso: capturar el diff con `-Djunit.jupiter.tempdir.cleanup.mode.default=NEVER` y analizar en copias aisladas. Permanece documentado en `specs/002-dotnet-roslyn-analyzer/bugs.md` (no se edita: regla aditiva).
