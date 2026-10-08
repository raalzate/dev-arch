# Requirements Checklist: 008-configurable-inference

**Purpose**: Validar la calidad de los requisitos (completitud, claridad, consistencia, medibilidad) antes de testify/tasks
**Created**: 2026-10-08 (`/iikit-01-specify`)
**Feature**: [spec.md](../spec.md)

> Modo no interactivo: los gaps se resolvieron con defaults conservadores registrados en spec.md *Clarifications* como "(default elegido por agente — pendiente confirmar)". Ninguno cambia las salidas existentes.

## Content Quality

- [x] **CQ-001**: ¿La spec describe QUÉ y POR QUÉ sin clases, bibliotecas, nombres de herramientas del protocolo ni rutas de código? [Clarity] — sí; nombres de clases, herramientas MCP, variables de entorno y formato de archivo viven en plan.md
- [x] **CQ-002**: ¿Las 7 historias (US1–US7) tienen prioridad, prueba independiente y escenarios Given/When/Then? [Completeness]
- [x] **CQ-003**: ¿Los criterios de éxito (SC-001..SC-010) son medibles (conteos, igualdad byte a byte, tiempos)? [Measurability]
- [x] **CQ-004**: ¿Quedan marcadores `[NEEDS CLARIFICATION]`? [Ambiguity] — no; 13 defaults del agente pendientes de confirmar
- [x] **CQ-005**: ¿Los edge cases cubren grafo vacío, llamadas a componentes ausentes, grafos .NET, pesos que no suman 1, listas vacías, identificadores con rutas, propuestas extremas y caché del modo servidor? [Edge Case Coverage]

## Requirement Completeness

- [x] **CHK001**: ¿Cada punto de la Fase 4/008 del plan tiene al menos un FR? [Completeness] — refactor → FR-001..FR-003; InferenceConfig → FR-004..FR-011; reinfer → FR-012..FR-017; score → FR-018..FR-020; detección anidada → FR-023..FR-024; recursos → FR-021; CONFIGURATION.md → FR-022
- [x] **CHK002**: ¿Se cubren los problemas conocidos (listas de palabras clave, `data_jaccard`, soporte solo raíz, exclusiones de análisis estático)? [Completeness] — FR-025, FR-028, US7
- [x] **CHK003**: ¿Se define el criterio de salida (< 2 s / 500 componentes) de forma verificable? [Measurability] — FR-017, SC-003 + Clarification de medición
- [x] **CHK004**: ¿Se define la regresión byte a byte (qué proyectos, qué documentos, qué modos)? [Clarity] — SC-001, US3

## Requirement Consistency

- [x] **CHK005**: ¿FR-026 (contrato sin cambio de versión) es consistente con FR-012/FR-018 (respuestas nuevas)? [Consistency] — sí: definiciones nuevas añadidas sin tocar las existentes (Clarification)
- [x] **CHK006**: ¿FR-027 (operaciones nuevas habilitadas explícitamente) es consistente con las aserciones bloqueadas de 001/005 (exactamente 5 operaciones)? [Consistency] — sí: por defecto 5
- [x] **CHK007**: ¿FR-023 (detección anidada) es consistente con el principio I? [Consistency] — sí: profundidad 0 por defecto
- [x] **CHK008**: ¿FR-011 (sin reutilización con configuración) es consistente con la reutilización de 007 (FR-025 de 007)? [Consistency] — sí: solo el análisis por defecto se reutiliza

## Feature Readiness

- [x] **FR-READY-001**: Todos los FR tienen escenario o criterio de éxito asociado
- [x] **FR-READY-002**: Defaults del agente registrados para confirmación del usuario
