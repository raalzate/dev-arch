# Implementation Plan: Puente MCP para agentes e identidad visual

**Branch**: `013-agent-mcp-bridge` | **Date**: 2026-10-23 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/013-agent-mcp-bridge/spec.md`

## Summary

(1) **Servidor MCP de la web** en `POST /api/mcp` (mismo puerto 9002, transporte HTTP "streamable" del SDK
`@modelcontextprotocol/sdk` ya presente en `web`, sin estado, respuestas JSON). Las herramientas viven en
`web/src/server/agent-mcp/` y son adaptadores delgados sobre lo existente: almacén de trabajos y runtime (007),
servicio de inferencia (008) y las funciones puras de `web/src/lib/modernization/` que ya usan los pasos de la web
(`technologyProfile`, `summarize`, `orderProposals`, `allIssues`/`groupIssues`, `buildPlan`, `planToMarkdown`).
(2) **Puente local** `web/public/dev-arch-mcp.mjs`: un único archivo Node ≥ 20 **sin dependencias** que Claude Code
lanza por stdio. Reenvía cada mensaje JSON-RPC a `/api/mcp` y resuelve localmente `analyze_project` con `path`:
empaqueta la carpeta en ZIP en memoria (exclusiones FR-003, sin seguir enlaces simbólicos), la sube con
`POST /api/analyses` y espera con la herramienta remota `get_analysis`. Al estar en `public/`, el propio servidor
(local o contenedor) lo sirve en `/dev-arch-mcp.mjs`. (3) **Enlace directo** `/?analysis=<id>` en la web, que
selecciona el análisis activo. (4) **Diagnóstico**: el endpoint de salud informa `agentMcp` (FR-020).
(5) **UI**: espacio superior en el encabezado y marca `BrandMark` (SVG en línea) + `web/src/app/icon.svg` como
ícono de la pestaña. (6) `docs/AGENTS-MCP.md` y sección en `docs/INSTALL.md`.

## Technical Context

**Language/Version**: TypeScript 5 (web, Next.js 15.3.8, Node 20+); JavaScript ESM sin dependencias para el puente
**Primary Dependencies**: `@modelcontextprotocol/sdk` 1.32.1 (ya dependencia de `web`; `McpServer` +
`WebStandardStreamableHTTPServerTransport`), `zod` (ya presente). Ninguna dependencia nueva.
**Storage**: almacén de trabajos existente (`ARCHVIEW_DATA_DIR`); sin almacenamiento nuevo
**Testing**: `node:test` + `tsx` (web, umbral de cobertura 85 %), `node --test` para el puente, Cucumber-JS para
los escenarios de 013 (`@slow` contra la web construida y el motor real)
**Target Platform**: macOS / Linux / Windows con Node ≥ 20 en la máquina del agente; servidor local o contenedor
**Project Type**: monorepo de producto (`apps/dev-arch`: `engine`, `web`, `schema`, `scripts`, `docker`, `docs`)
**Performance Goals**: empaquetado + subida del proyecto de demostración < 5 s; respuesta de partes < 1 s sobre un
análisis completado
**Constraints**: límites de carga 007 (tamaño, entradas, ratio); respuestas deterministas; token de API opcional
igual que la API REST; sin cambios en Compose, motor ni herramientas MCP del motor
**Scale/Scope**: ~10 herramientas MCP; 1 archivo puente; 1 ruta nueva; cambios menores de UI

## Constitution Check

| Principio | Estado | Nota |
|---|---|---|
| I. Compatibilidad | PASS | Rutas REST, documentos, CLI y herramientas MCP del motor sin cambios. `/api/health` solo añade un campo |
| II. Fuente única | PASS | Las herramientas no calculan nada propio: reutilizan `lib/modernization`, el almacén y `inference-service`. El puente no analiza: empaqueta y reenvía |
| III. TDD | PASS | Escenarios 013 y pruebas unitarias de herramientas, puente y UI en rojo antes de implementar |
| IV. Determinismo | PASS | Serialización con claves en orden fijo; sin marcas de tiempo nuevas (solo `finishedAt` del trabajo); ZIP con entradas ordenadas y fecha fija |
| V. Errores claros | PASS | Errores MCP `isError` con código (`NOT_FOUND`, `NOT_READY`, `ANALYSIS_FAILED`, `INVALID_INPUT`, `UNAUTHORIZED`, `UNREACHABLE`, `TOO_LARGE`) y acción sugerida |
| VI. Huella mínima | PASS | Sin dependencias nuevas; puente de un archivo sin dependencias; ningún servicio ni puerto extra |

## Project Structure

### Documentation (this feature)

```text
specs/013-agent-mcp-bridge/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── agent-mcp-tools.md
│   └── bridge-cli.md
├── checklists/requirements.md
└── tests/features/*.feature      (testify)
```

### Source Code (repository root = apps/dev-arch)

```text
web/src/server/agent-mcp/
├── tools.ts            # definición de herramientas (nombre, esquema zod, handler) — adaptadores delgados
├── views.ts            # documentos del trabajo → AnalysisView → partes (summary/proposals/findings/plan)
├── errors.ts           # errores tipados → resultado MCP isError
├── links.ts            # URL pública del análisis (DEVARCH_PUBLIC_URL o origen de la petición)
└── server.ts           # McpServer + transporte web estándar sin estado
web/src/app/api/mcp/route.ts        # POST/GET/DELETE → server.ts (token igual que REST)
web/public/dev-arch-mcp.mjs         # puente stdio sin dependencias (zip + proxy)
web/src/components/brand-mark.tsx   # ícono SVG
web/src/app/icon.svg                # ícono de pestaña (reemplaza favicon.ico)
web/src/components/app-shell.tsx    # espacio superior + marca
web/src/components/software-architecture-analyzer.tsx  # ?analysis=<id>
web/src/server/health/health.ts     # campo agentMcp
docs/AGENTS-MCP.md, docs/INSTALL.md
tests/acceptance/steps/agent-mcp*.steps.ts
```

**Structure Decision**: todo dentro de las áreas existentes (`web`, `docs`, `tests`); el puente vive en
`web/public` para que cualquier instancia lo sirva sin cambiar la imagen ni Compose (012 TS-028 intacto).

## Architecture

```text
┌──────────────┐ stdio ┌──────────────────────┐  HTTP  ┌──────────────────────────────────────────┐
│ Claude Code  │──────▶│ dev-arch-mcp.mjs     │───────▶│ dev-arch web (Next.js :9002)              │
│ (agente)     │◀──────│ (puente local)       │◀───────│  POST /api/analyses  (ZIP, 007)           │
└──────────────┘       │ zip carpeta + proxy  │        │  POST /api/mcp       (herramientas 013)    │
       │               └──────────────────────┘        │   └ lib/modernization (summary/plan/...)  │
       │  HTTP directo (consultas / ruta local en dev)  │   └ job store + engine runtime (007/008)  │
       └───────────────────────────────────────────────▶│                                            │
                                                        └───────────────┬──────────────────────────┘
                                                                        │ stdio MCP (007)
                                                                ┌───────▼────────┐
                                                                │ Engine (JAR)   │
                                                                └────────────────┘
```

## Complexity Tracking

| Decisión | Por qué | Alternativa descartada |
|---|---|---|
| Puente local además del endpoint HTTP | Un servidor en contenedor no ve el disco del usuario (FR-002); el modelo no puede adjuntar un ZIP grande en los argumentos | Solo HTTP con `localPath` (no funciona en contenedor/remoto) |
| Escritor ZIP propio (~80 líneas, `node:zlib`) en el puente | Mantener el puente sin dependencias e instalable con una descarga | `adm-zip`/`archiver` (obligaría a `npm install` en la máquina del agente) |
