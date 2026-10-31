---
description: "Task list for 026-web-extraction-options"
---
# Tasks: Opciones de extracción al analizar desde el web
- [x] T001 Pasos de aceptación `tests/acceptance/steps/extraction-options.steps.ts`; stub engine acepta `config` y lo registra; `cucumber.mjs` incluye 026; rojo [TS-001..TS-006]
- [x] T002 Servidor: `Job.extractionConfig`, parseo en `POST /api/analyses` (400 `INVALID_CONFIG`), runner → `analyze_project.config`, `INFERENCE_CONFIG_INVALID`, vista de estado/historial [TS-001..TS-005]
- [x] T003 Cliente: `submitAnalysis(file, language, config)`, `ExtractionOptions`/`toExtractionConfig`, sección "Opciones de extracción" en `UploadControls`, línea en el resumen [TS-006]
- [x] T004 Pruebas unitarias web (route, runner/engine-client, analyses-client, toExtractionConfig); `npm test`; docs `web/README.md`, `CHANGELOG.md`
