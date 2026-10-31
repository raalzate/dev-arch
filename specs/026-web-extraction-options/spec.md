# Feature Specification: Opciones de extracción al analizar desde el web

**Feature Branch**: `026-web-extraction-options`
**Created**: 2026-10-31
**Status**: Draft
**Input**: User description: "Añadir al diálogo Analizar del web las opciones de extracción del motor (análisis extendido, carpeta de ensamblados de referencia, profundidad de búsqueda de proyectos) para que un análisis subido como .zip pueda usar las features 024/025 sin recurrir a la CLI."

## Contexto

El web solo expone configuración de **re-inferencia** (010): la extracción corre siempre con los valores por defecto, así que las pasadas opt-in del analizador .NET (024 `analysis.extended`, 025 `analysis.referenceAssemblies`) y la búsqueda de proyectos anidados (`detection.maxDepth`, necesaria cuando el .zip tiene varios proyectos en subcarpetas) no se pueden activar desde la interfaz. Esta feature permite enviar una **configuración de extracción** con el .zip, la conserva con el análisis y la muestra en el resumen. El motor la valida (misma configuración de inferencia de 008); el web no duplica reglas.

## User Stories *(mandatory)*

### User Story 1 — Elegir opciones de extracción al analizar (Priority: P1)

1. **Given** el formulario de análisis, **When** abro "Opciones de extracción", **Then** veo: análisis extendido (interruptor), profundidad de búsqueda de proyectos (0-5), carpeta de ensamblados de referencia .NET Framework (texto)
2. **Given** opciones distintas del valor por defecto, **When** analizo, **Then** la petición lleva la configuración y el motor la recibe en `analyze_project` como `config`
3. **Given** ninguna opción cambiada, **When** analizo, **Then** la petición no lleva configuración y el análisis es el de siempre
4. **Given** un análisis completado con opciones, **Then** el resumen muestra las opciones aplicadas y el historial las conserva

### User Story 2 — API y validación (Priority: P1)

1. **Given** `POST /api/analyses?config=<JSON>` (cuerpo .zip) o un cuerpo JSON con `config`, **Then** la configuración se guarda en el análisis (`extractionConfig`) y llega al motor
2. **Given** `config` que no es un objeto JSON o supera 8 KB, **Then** 400 `INVALID_CONFIG`
3. **Given** una configuración que el motor rechaza, **Then** el análisis termina `failed` con código `INFERENCE_CONFIG_INVALID` y el mensaje del motor

## Requirements *(mandatory)*

- **FR-001**: `POST /api/analyses` acepta `config` (query `config` con JSON, o `config` del cuerpo JSON): objeto, ≤ 8 192 caracteres; inválido → 400 `INVALID_CONFIG`.
- **FR-002**: El análisis guarda `extractionConfig` (objeto o null) y lo expone en `GET /api/analyses/{id}` y en el historial.
- **FR-003**: El runner pasa `config` a la herramienta `analyze_project` solo cuando existe.
- **FR-004**: Error de configuración del motor → `failed` con `INFERENCE_CONFIG_INVALID` y el mensaje del motor.
- **FR-010**: UI: sección plegable "Opciones de extracción" en el formulario (versión completa y compacta) con `analysis.extended` (on/off), `detection.maxDepth` (0-5) y `analysis.referenceAssemblies` (texto); solo los valores no por defecto viajan.
- **FR-011**: El resumen del análisis muestra "Opciones de extracción: …" cuando existen.
- **FR-020**: Sin opciones, peticiones y salidas idénticas a las actuales.

## Success Criteria *(mandatory)*

- **SC-001**: Desde el web, un .zip VB analizado con análisis extendido y ensamblados de referencia muestra issues `CA*` y `Maintainability:` (verificado manualmente sobre la referencia; pruebas automáticas con el motor stub comprueban la propagación de `config`).
- **SC-002**: Pruebas web existentes verdes; sin cambios de contrato (`extractionConfig` es un campo del estado de análisis del web, no del contrato 1.0.0).

## Clarifications

### Session 2026-10-31

- La carpeta de ensamblados de referencia es una ruta del servidor (el motor corre allí); se documenta en la UI.
- No se añade configuración de inferencia aquí (ya existe en 010); un mismo objeto `config` puede llevar ambas secciones y el motor las aplica.
