# Research: 010-modernization-ux

## D1. Perfil tecnológico calculado en la web a partir del contrato

- **Decision**: función pura `technologyProfile(graph)` en `web/src/lib/modernization/technology.ts`: `meta.source = spoon` → `java`; `roslyn | roslyn-fallback` → según extensiones de `components[].files[]` (`.cs`, `.vb`): solo cs → `csharp`, solo vb → `vb`, ambos → `dotnet-mixed`, ninguno → `dotnet`. `reducedFidelity = source === 'roslyn-fallback'`.
- **Rationale**: el contrato 1.0.0 no declara lenguaje; `meta.source` y las extensiones de archivo son datos ya emitidos por el motor. No es lógica de análisis (principio II): es presentación de metadatos.
- **Alternatives**: añadir `meta.language` al contrato (requiere bump de contrato y cambios del motor — rechazado, principio I); usar el `language` solicitado del trabajo (es `auto` casi siempre — insuficiente).

## D2. Registro declarativo de secciones

- **Decision**: `web/src/lib/modernization/sections.ts` con un registro `SectionDef { id, step, title, appliesTo: Technology[] | 'all', items(data) }`; `resolveSections(step, profile, data)` devuelve `{ visible, empty }`. La interfaz renderiza solo `visible` y una línea "Sin hallazgos: …" con `empty`.
- **Rationale**: hace verificable FR-003..005 sin navegador (pruebas unitarias y escenarios de aceptación rápidos) y elimina la causa raíz del defecto (secciones cableadas en JSX).
- **Alternatives**: condiciones `if` dispersas en componentes (causa del defecto actual).

## D3. Re-etiquetado de capas por tecnología

- **Decision**: `layerLabel(layer, profile)`: tabla por tecnología; VB: `Web` → "Presentación (formularios y reportes)", `Compartida` → "Módulos compartidos", `Datos` → "Acceso a datos (ADO.NET)"; C#: `Datos` → "Acceso a datos", `Web` → "Presentación web"; Java: etiquetas actuales. Los datos no cambian.
- **Rationale**: 009 clasifica formularios y reportes VB como `Web` (data-model 009 §Capas VB); el término correcto para el usuario es de escritorio.

## D4. Re-inferencia y puntuación a través del cliente MCP existente

- **Decision**: `EngineClient` gana `callTool(name, args, timeoutMs)` y `readResource(uri)`; nuevas rutas `POST /api/analyses/{id}/reinfer`, `POST /api/analyses/{id}/score`, `GET /api/inference/defaults`. Se pasa `jobId` (el proceso del motor de la web ya tiene `STATIC_INFERENCE_JOBS_DIR` y `STATIC_INFERENCE_INFERENCE_TOOLS=true`, 008). Respuestas validadas con `reinferArchitectureResponseSchema` / `scoreProposalResponseSchema` generados.
- **Rationale**: reutiliza el proceso de motor de larga vida de 007 (latencia baja, SC-004 < 3 s); no reanaliza código.
- **Alternatives**: llamar al CLI por cada recálculo (lento, arranque JVM); recalcular en TypeScript (duplica lógica — viola principio II).

## D5. Límites de los parámetros desde el esquema del contrato

- **Decision**: el servidor lee `schema/1.0.0/inference-config.schema.json` (paquete `@static-inference/schema`) y extrae `minimum`/`maximum` por ruta JSON de los 7 parámetros del panel; los valores por defecto vienen del recurso MCP `static-inference://configuration/defaults`. El cliente limita (clamp) antes de enviar.
- **Rationale**: única fuente de verdad para rangos (contrato) y defaults (motor).

## D6. Estado de la página

- **Decision**: el navegador conserva solo `devarch.activeJobId` (007) y `devarch.theme` (`light|dark`). Escenario de inferencia, propuestas editadas y comparación viven en memoria (React state). El historial se pide al servidor (`GET /api/analyses`).
- **Rationale**: compatible con TS-015 de 007 (valores < 512 caracteres, sin resultados).

## D7. Exportación PDF sin dependencias

- **Decision**: vista imprimible `PrintReport` (mismo modelo que el Markdown) + hoja de estilos `@media print` que oculta la interfaz; el botón invoca `window.print()` ("Guardar como PDF" del navegador).
- **Rationale**: principio VI (0 dependencias nuevas); el contenido es idéntico al Markdown.
- **Alternatives**: `jspdf`/`pdfmake`/`puppeteer` (dependencias pesadas, rechazado).

## D8. Markdown determinista

- **Decision**: `planToMarkdown(model)` puro; sin fechas de reloj (usa `finishedAt` del análisis), orden estable (FR-033), números con formato fijo (`toFixed(2)`), `\n` final.

## D9. Mapa del sistema (d3 existente)

- **Decision**: se reescribe `component-graph.tsx` sobre d3 7 (ya dependencia) con un modelo puro `graph-model.ts`: `edgeTypes(edge)` (split por `,`), `legend(edges)`, `visibleEdges(edges, enabled)`, `strokeWidth(weight, max)` (1–6 px, escala raíz), `groupKey(component, mode, proposals)`, `meetsSeverity(component, min)`. Agrupación con fuerzas `forceX/forceY` hacia centros de grupo y casco convexo por grupo.
- **Rationale**: lógica de filtrado testeable sin DOM; d3 ya está en el proyecto.

## D10. Proveedor LLM

- **Decision**: `web/src/ai/llm/provider.ts`: `resolveLlmProvider(env)` → `{ provider: 'gemini' | 'anthropic', model }` o error `LLM_PROVIDER '<v>' is not supported. Allowed: gemini, anthropic`. Gemini: Genkit actual (`LLM_MODEL`, por defecto `gemini-2.5-flash`). Anthropic: SDK oficial `@anthropic-ai/sdk`, modelo por defecto según la guía vigente del skill `claude-api` (sobrescribible con `LLM_MODEL`); `ANTHROPIC_API_KEY` requerido (error "ANTHROPIC_API_KEY is not set" sin valores).
- **Rationale**: decisión del usuario; el SDK oficial es la forma soportada (dependencia opcional en tiempo de uso, justificada por FR-040).
- **Alternatives**: plugin comunitario de Genkit para Anthropic (no oficial, rechazado); `fetch` manual (re-implementa reintentos/errores).

## D11. Plantillas de prompt por tecnología

- **Decision**: `web/src/ai/prompts/` con `java-spring-jee.ts`, `aspnet-core.ts`, `vb-desktop.ts` y `selectPromptTemplate(profile)` (mixto → VB). Entrada compacta: resumen del análisis (no el JSON completo) para no exceder contexto.

## D12. Tipos generados para 008

- **Decision**: añadir a `ENTRIES` de `schema/gen/lib.mjs`: `inference-config` (`InferenceConfig`, `parseInferenceConfig`), `mcp/reinfer_architecture` (alias de `ConsolidatedArchitecture`), `mcp/score_proposal` (`ScoreProposalResponse`). Re-testify de 005 TS-028 (aprobado por el usuario) + actualización de los pasos Java/TS que enumeran los tipos. La web importa tipos solo de `@static-inference/schema`; se elimina `web/src/lib/types.ts`.

## D13. Pruebas

- **Decision**: (a) `node:test` en `web/src/**/*.test.ts` para módulos puros y rutas; (b) Cucumber-JS para `specs/010-modernization-ux/tests/features` — escenarios `@acceptance` rápidos (módulos puros con las fixtures del contrato y salida VB sintética; API con el motor simulado `fake-mcp-server.mjs` ampliado con `reinfer_architecture`, `score_proposal` y el recurso de defaults) y `@e2e @slow` (Playwright, motor real) para los flujos Java/C#/VB; (c) capturas Playwright en `specs/010-modernization-ux/screenshots/`.
- **VB en e2e**: ZIP con los archivos versionados de `engine/src/test/dotnet/DotNetAnalyzer.Tests/Fixtures/VbLegacy/SyntheticDesktop`.

## D14. Tipografía y tema

- **Decision**: IBM Plex Sans (texto) + IBM Plex Mono (identificadores de código), cargadas desde Google Fonts con pila de respaldo del sistema; tokens CSS en `globals.css` (`:root` y `.dark`); tema aplicado antes de pintar con un script inline mínimo para evitar parpadeo.
