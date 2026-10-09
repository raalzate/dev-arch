# Requirements Checklist: 008-configurable-inference

**Purpose**: Validar la calidad de los requisitos (completitud, claridad, consistencia, medibilidad) antes de testify/tasks
**Created**: 2026-10-08 (`/iikit-01-specify`)
**Feature**: [spec.md](../spec.md)

> Modo no interactivo: los gaps se resolvieron con defaults conservadores registrados en spec.md *Clarifications* como "(default elegido por agente — confirmado por usuario 2026-10-09)". Ninguno cambia las salidas existentes.

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

## Requirement Clarity (iikit-03)

- [x] **CHK009**: ¿Está definido qué ocurre con un filtro de viabilidad mínima inválido en la re-inferencia? [Gap → resuelto ampliando FR-012]
- [x] **CHK010**: ¿Está claro si la configuración de inferencia altera el grafo o los contratos de API? [Gap → resuelto en Edge Cases: solo la profundidad de detección puede cambiar el analizador]
- [x] **CHK011**: ¿Se define el modelo de confianza de la ruta del archivo de configuración en el modo servidor? [Gap → resuelto en Edge Cases: igual que la ruta del proyecto]
- [x] **CHK012**: ¿"Mismas fórmulas" (FR-019) es verificable sin la puntuación numérica en la salida? [Clarity] — sí: SC-007 compara viabilidad y justificación, que expresa las submétricas
- [x] **CHK013**: ¿Están acotados los rangos de cada parámetro? [Clarity, FR-009] — rangos por parámetro en data-model.md; la spec exige rechazo con nombre y motivo

## Acceptance Criteria Quality

- [x] **CHK014**: ¿Cada SC tiene un umbral numérico o de igualdad? [Measurability] — SC-001 18/18, SC-002 6/6, SC-003 < 2 s ×5, SC-004 100 %, SC-006 100 %, SC-007 100 %, SC-008 4/4, SC-009 ≤ 4655, SC-010 6 + 4 casos
- [x] **CHK015**: ¿US1-AS3 tiene dirección esperada verificable? [Clarity] — umbral de evidencia inalcanzable ⇒ número de grupos ≥ por defecto

## Scenario & Edge Case Coverage

- [x] **CHK016**: ¿Se cubren los caminos de error de las dos operaciones nuevas (ruta, documento, versión, identificador, lista vacía, desconocidos)? [Coverage, US1-AS7, US4-AS3/AS4]
- [x] **CHK017**: ¿Se cubre el grafo .NET en la re-inferencia? [Edge Case] — sí (Edge Cases; SC-002 incluye los 3 proyectos .NET)
- [x] **CHK018**: ¿Se cubre la reutilización del modo servidor con configuración? [Edge Case, FR-011]

## Non-Functional Requirements

- [x] **CHK019**: ¿El rendimiento tiene método de medición definido? [Clarity, FR-017 + Clarification]
- [x] **CHK020**: ¿Determinismo de las operaciones nuevas exigido? [NFR, US1-AS8, US4-AS6, FR-010]
- [x] **CHK021**: ¿Se exige no añadir dependencias? [NFR] — principio VI; plan: 0 dependencias nuevas

## Dependencies & Assumptions

- [x] **CHK022**: ¿Se documenta la dependencia con las aserciones bloqueadas de 001/005/007? [Assumption, FR-027 + Clarification]
- [x] **CHK023**: ¿Se documenta la convivencia con la feature 009? [Assumption]
