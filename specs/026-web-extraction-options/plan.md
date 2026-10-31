# Implementation Plan: Opciones de extracción al analizar desde el web

**Branch**: `026-web-extraction-options` | **Date**: 2026-10-31 | **Spec**: [spec.md](./spec.md)

## Summary
Web (Next.js, TS): `Job.extractionConfig`, parseo de `config` en `POST /api/analyses` (query o cuerpo JSON; 400 `INVALID_CONFIG`), `AnalyzeRequest.config` → argumento `config` de `analyze_project`, mapeo del error de configuración del motor a `INFERENCE_CONFIG_INVALID`, `extractionConfig` en la vista de estado/historial; cliente `submitAnalysis(file, language, config?)`; `UploadControls` con sección "Opciones de extracción" (`ExtractionOptions` → objeto parcial); resumen con la línea de opciones. Stub engine acepta `config` y lo registra en `callsLog`.

## Constitution Check
I PASS (sin opciones nada cambia) · II PASS (validación en el motor) · III/IV PASS · V PASS (error del motor → análisis fallido con mensaje) · VI PASS (sin dependencias) · VII PASS.

## Design
1. `web/src/server/jobs/job-store.ts`: `extractionConfig?: Record<string, unknown> | null`.
2. `web/src/app/api/analyses/route.ts`: `parseExtractionConfig(query, body)`; `store.create({..., extractionConfig})`.
3. `job-runner.ts`: `config: job.extractionConfig ?? undefined`; `engine-client.ts`: `arguments.config` si existe; error cuyo texto contiene `Invalid inference configuration` → `JobFailure('INFERENCE_CONFIG_INVALID', text)`.
4. `job-view.ts`: `extractionConfig`; `analyses-client.ts`: tipo + `submitAnalysis(file, language, config)`.
5. `landing.tsx`: `ExtractionOptions { extended: boolean; maxDepth: number; referenceAssemblies: string }` + `toExtractionConfig()`; `software-architecture-analyzer.tsx`: estado y paso al resumen; `summary-step.tsx`: línea de opciones.
6. Pruebas: `route.test.ts` (config en query y cuerpo, 400), `job-runner`/`engine-client` (argumento `config`), `analyses-client.test.ts` (URL), `landing` helper test (`toExtractionConfig`); stub `fake-mcp-server.mjs` con `config` y `callsLog` en `analyze_project`; feature de aceptación con pasos API in-process.

## Requirement Coverage
FR-001/002 → 2, 4 · FR-003/004 → 3 · FR-010/011 → 5 · FR-020 → pruebas existentes.
