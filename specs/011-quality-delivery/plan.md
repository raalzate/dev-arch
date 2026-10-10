# Implementation Plan: Calidad, CI/CD y entrega de dev-arch

**Branch**: `011-quality-delivery` | **Date**: 2026-10-10 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/011-quality-delivery/spec.md`

## Summary

Cierra los huecos de calidad heredados sin tocar nada bloqueado de 001–010: (1) comprobación de tipos y lint
bloqueantes en la web, corrigiendo las firmas de producción que hoy producen 33 errores TS2345 y resolviendo los
35 TS5097 por configuración (`allowImportingTsExtensions`); (2) runners Cucumber-JVM nuevos para los `.feature`
de 001, 002 (incl. bugfix) y 003 con pasos en paquetes nuevos; (3) cobertura JaCoCo / coverlet / cobertura
integrada de Node con un resumen común; (4) pruebas unitarias de todas las rutas API, del cliente del motor y de
utilidades con umbral web ≥ 85 %; (5) release con comprobación tag↔`VERSION` y paquete de skills; (6) registro
estructurado por análisis (`events.jsonl`) y métricas de tiempo en el estado del análisis; (7) reutilización
segura del analizador .NET publicado (sello de publicación + comparación con fuentes).

## Technical Context

**Language/Version**: Java 17 (motor), C# / .NET 8 (analizador; SDK 10 local con runtime 8), TypeScript 5 / Node ≥ 20 (web, scripts), Bash (scripts del producto), YAML (GitHub Actions)
**Primary Dependencies**: existentes (Cucumber-JVM 7.14, JUnit 5, Next 15.3.8, Cucumber-JS 11, tsx); nuevas solo de desarrollo/build: `jacoco-maven-plugin` 0.8.12, `coverlet.collector` 6.0.2 (proyecto de pruebas), `eslint` 9, `eslint-config-next` 15.3.8, `@eslint/eslintrc` 3 (web devDependencies)
**Storage**: sistema de archivos (`<dataDir>/jobs/<id>/events.jsonl`, `job.json` con `metrics`)
**Testing**: Cucumber-JS (`cucumber.mjs`, escenarios de 011), Cucumber-JVM (runners nuevos en `mvn verify`), `node --test` + tsx (unitarias web), xUnit (.NET)
**Target Platform**: macOS / Linux (dev y CI ubuntu-latest)
**Project Type**: producto monorepo `apps/dev-arch` (engine + web + schema)
**Performance Goals**: trabajos de área de CI ≤ 20 min (006 TS-030); comprobación de tipos + lint < 2 min
**Constraints**: aditivo (HARD RULE): sin cambios en `.feature`, `context.json`, specs, pasos ni pruebas de 001–010; Checkstyle ≤ 4763, SpotBugs 0, `dotnet format`
**Scale/Scope**: 83 escenarios heredados (~330 pasos), 9 módulos de rutas API, ~30 módulos de servidor/utilidades

## Constitution Check

| Principio | Estado | Nota |
|---|---|---|
| I. Compatibilidad | PASS | Sin cambios de salida del motor ni del contrato; `metrics` es un campo aditivo del estado del análisis de la web (no del contrato del motor) |
| II. Fuente única | PASS | Los pasos ejercen el motor real (CLI, `McpServerMain`/herramientas, analizador .NET); no duplican lógica |
| III. TDD | PASS | Escenarios de 011 en rojo antes de implementar; pasos de 001–003 son pruebas sobre comportamiento existente; los defectos que revelen se corrigen en producción |
| IV. Determinismo | PASS | Las métricas viven en el estado de la web, nunca en las salidas del motor |
| V. Errores claros | PASS | Omisiones con motivo explícito; fallo de release con ambos valores; logging que nunca rompe el análisis |
| VI. Huella mínima | PASS (justificado) | Solo dependencias de build/desarrollo (ver Complexity Tracking); el JAR y la web en runtime no cambian |

## Project Structure

### Documentation (this feature)

```text
specs/011-quality-delivery/
├── spec.md · plan.md · research.md · data-model.md · quickstart.md
├── contracts/ (job-events.md, coverage.md, release.md, legacy-bdd.md)
├── checklists/ · tests/features/ (testify) · tasks.md
```

### Source Code (repository root = apps/dev-arch)

```text
engine/
├── pom.xml                                     # + jacoco-maven-plugin (prepare-agent, report en verify)
└── src/test/java/com/extractor/legacybdd/      # NUEVO
    ├── LegacySupport.java                      # analizador, CLI, MCP en proceso, proyectos demo
    ├── mcp/      Run…001…Test + steps          # specs/001-mcp-server-local
    ├── dotnet/   Run…002…Test + steps          # specs/002-dotnet-roslyn-analyzer (incl. bugfix)
    └── codeissues/ Run…003…Test + steps        # specs/003-dotnet-code-issues
engine/src/test/dotnet/DotNetAnalyzer.Tests/DotNetAnalyzer.Tests.csproj   # + coverlet.collector
web/
├── next.config.ts                              # sin ignoreBuildErrors / ignoreDuringBuilds
├── tsconfig.json                               # + allowImportingTsExtensions
├── eslint.config.mjs                           # NUEVO (next/core-web-vitals)
├── package.json                                # devDeps eslint; scripts test/coverage
├── scripts/run-tests.mjs                       # NUEVO: lista explícita de pruebas (Node 20) + cobertura
├── src/server/env.ts                           # NUEVO: tipo Env (corrige TS2345)
├── src/server/jobs/job-events.ts               # NUEVO: registro estructurado + métricas
└── src/**/*.test.ts                            # NUEVAS pruebas de rutas, cliente, utilidades
scripts/
├── lib.sh                                      # + dotnet_analyzer_freshness
├── dotnet-analyzer-freshness.sh                # NUEVO (decisión reuse/rebuild)
├── coverage.sh                                 # NUEVO (make coverage, resumen)
├── release-check.sh                            # NUEVO (tag ↔ VERSION)
├── test.sh · schema-check.sh                   # usan la frescura; typecheck/lint/cobertura
Makefile                                        # + coverage, typecheck, lint
cucumber.mjs                                    # + specs/011
tests/acceptance/steps/quality-*.steps.ts       # NUEVO (escenarios 011)
.github/workflows/dev-arch.yml (raíz monorepo)  # cobertura, analizador en engine-java, release-check, skills
```

**Structure Decision**: todo nuevo código de pruebas va en archivos/paquetes nuevos; los únicos archivos existentes que cambian son de producción, configuración o build (permitidos por la regla aditiva).

## Architecture

```text
 make test / CI ──► scripts/test.sh ──► freshness ──► engine-build --dotnet-only (si obsoleto)
                         │                                   │
                         ├─► mvn verify ──► surefire: JUnit + Cucumber (005,007,008,009 + 001,002,003 NUEVOS)
                         │        └─► JaCoCo report (target/site/jacoco)
                         ├─► dotnet test --collect (coverlet) ──► target/coverage/dotnet
                         ├─► web: typecheck · lint · run-tests --coverage ──► web/coverage
                         └─► cucumber-js (006,007,010,011)
 web JobRunner ──► JobEventLog (events.jsonl) ──► metrics en job.json ──► GET /api/analyses/{id}
 tag dev-arch-vX.Y.Z ──► release-check ──► release (matriz) + release-skills ──► GitHub Release
```

### Legacy exclusions (FR-033, user decision 2026-10-09)

`specs/011-quality-delivery/legacy-exclusions.md` is the single, versioned, machine-readable list of excluded legacy
scenarios (markdown table: feature, `@TS-XXX`, locked assertion, superseding decision, date). A shared test helper
`com.extractor.legacybdd.LegacyExclusions` parses it; each legacy glue package registers a first-order `@Before` hook
that aborts a listed scenario (`Assumptions.abort`, reported as skipped) with the reason
`excluded-by-decision: …`. The runners carry no tag filter. The cucumber-js steps of TS-007/TS-008/TS-009/TS-035
parse the same file: stale entries, undocumented skips and tag filters in the runners fail the verification.

## Complexity Tracking

| Adición | Por qué | Alternativa descartada |
|---|---|---|
| `jacoco-maven-plugin` (build) | Cobertura Java (FR-011) | Ninguna sin plugin |
| `coverlet.collector` (pruebas .NET) | Cobertura .NET (FR-012); ya en caché NuGet | `dotnet-coverage` global tool: requiere instalación aparte |
| `eslint` + `eslint-config-next` + `@eslint/eslintrc` (dev web) | `next lint` necesita ESLint (FR-004) | ESLint 8 + `.eslintrc` (fin de soporte) |
