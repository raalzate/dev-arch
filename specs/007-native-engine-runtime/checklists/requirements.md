# Requirements Checklist: 007-native-engine-runtime

**Purpose**: Validar la calidad de los requisitos (completitud, claridad, consistencia, medibilidad) antes de testify/tasks
**Created**: 2026-10-08 (`/iikit-01-specify`), extendido por `/iikit-03-checklist` el 2026-10-08
**Feature**: [spec.md](../spec.md)

> Modo no interactivo: los gaps se resolvieron con defaults conservadores registrados en spec.md *Clarifications* como "(default elegido por agente — pendiente confirmar)". La confirmación del usuario sigue pendiente y se reporta, pero no bloquea el checklist (los defaults están documentados y son reversibles).

## Content Quality

- [x] **CQ-001**: ¿La spec describe QUÉ y POR QUÉ sin frameworks, bibliotecas, rutas de código, protocolos de transporte ni códigos de estado? [Clarity] — sí; SDK MCP, rutas `/api/*`, Playwright, `_meta` y estructura de archivos viven en plan.md/research.md
- [x] **CQ-002**: ¿Las 8 historias (US1–US8) tienen prioridad, prueba independiente y escenarios Given/When/Then? [Completeness]
- [x] **CQ-003**: ¿Los criterios de éxito (SC-001..SC-012) son medibles (porcentajes, tiempos, conteos, igualdad byte a byte)? [Measurability]
- [x] **CQ-004**: ¿Quedan marcadores `[NEEDS CLARIFICATION]`? [Ambiguity] — no; 17 defaults del agente pendientes de confirmar en Clarifications
- [x] **CQ-005**: ¿Los edge cases cubren ZIP vacío, nombres no ASCII, entradas duplicadas, analizador .NET ausente, modo degradado, disco lleno, rutas codificadas, caducidad durante la vista y reinicio del motor? [Edge Case Coverage]

## Requirement Completeness

- [x] **CHK001**: ¿Cada tarea de la Fase 3 del plan de integración tiene al menos un FR? [Completeness] — cliente/locator → FR-029, FR-032; jobs → FR-001..FR-012; seguridad → FR-013..FR-016; visor → FR-017..FR-019; importación → FR-020..FR-022; motor → FR-023..FR-028
- [x] **CHK002**: ¿Se define qué significa "modo desarrollo" para la carpeta local? [Gap → resuelto ampliando FR-005 + Clarification]
- [x] **CHK003**: ¿Se define cuándo se verifica la cuota (antes o después de recibir el ZIP)? [Gap → resuelto ampliando FR-011 + Clarification]
- [x] **CHK004**: ¿Se define qué guarda el navegador (identificador vs resultados)? [Gap → resuelto ampliando FR-007]
- [x] **CHK005**: ¿Se exige trazabilidad operativa de los rechazos de seguridad? [Gap → resuelto ampliando FR-016]
- [x] **CHK006**: ¿Se define el comportamiento de análisis activos ante reinicio del servidor web? [Completeness, FR-009, US2-AS5]
- [x] **CHK007**: ¿Se define el comportamiento sin motor construido, consistente con 006? [Completeness, FR-032, US1-AS8]
- [x] **CHK008**: ¿Se definen los documentos obligatorios de la importación? [Completeness, FR-020, US5-AS4]

## Requirement Clarity

- [x] **CHK009**: ¿"De inmediato" (FR-001) tiene umbral medible? [Clarity, SC-004 — < 2 s]
- [x] **CHK010**: ¿"Retoma el análisis" tras recarga es verificable? [Clarity, US2-AS2, SC-002 — mismo identificador, sin re-subir]
- [x] **CHK011**: ¿"Sin cambios en sus archivos" (FR-025) define la huella? [Clarity] — misma ruta, misma elección de lenguaje, mismas fechas de modificación y tamaños; añadir/eliminar invalida
- [x] **CHK012**: ¿"Lista permitida" del visor es concreta? [Clarity, FR-018 + Clarification; lista exacta en research D10]
- [x] **CHK013**: ¿El progreso de la UI tiene latencia medible? [Ambiguity → resuelto en FR-007: ≤ 3 s]

## Requirement Consistency

- [x] **CHK014**: ¿FR-026 (advertencias expuestas) es consistente con FR-027 (salidas byte-idénticas) y con el contrato 1.0.0 cerrado? [Consistency] — sí: fuera del contenido validado, solo si existen (Clarification)
- [x] **CHK015**: ¿FR-033 (ruta síncrona conservada) es consistente con FR-008 (sin archivos de nombre fijo en el cwd)? [Consistency] — sí: área aislada por petición
- [x] **CHK016**: ¿FR-018 ("sin revelar existencia fuera de la raíz") es consistente con US4-AS4 ("archivo inexistente → motivo claro")? [Consistency] — sí: el motivo claro aplica dentro de la raíz; fuera de ella la respuesta es uniforme
- [x] **CHK017**: ¿FR-012 (caducidad desde el fin) es consistente con la importación (FR-022)? [Consistency] — sí: un análisis importado termina al crearse
- [x] **CHK018**: ¿La prueba en navegador de esta feature es consistente con el marcador reservado de 006 para 011? [Conflict → resuelto en Assumptions: comando propio, marcador intacto]

## Acceptance Criteria Quality & Scenario Coverage

- [x] **CHK019**: ¿Cada FR traza a una historia? [Traceability] — FR-001..FR-007 → US1/US2; FR-008..FR-012 → US2/US3; FR-013..FR-016 → US3; FR-017..FR-019 → US4; FR-020..FR-022 → US5; FR-023..FR-028 → US6; FR-029..FR-032 → US7/US1; FR-033 → US8
- [x] **CHK020**: ¿Hay escenarios negativos por historia? [Scenario Coverage] — US1-AS5..AS8, US2-AS5, US3-AS1..AS5/AS8, US4-AS2..AS5, US5-AS2..AS4, US6-AS5, US7-AS2/AS3
- [x] **CHK021**: ¿Se cubre la compatibilidad de clientes existentes? [Coverage, US8, FR-027, FR-033]

## SC Test Coverage

- [x] **CHK022**: ¿Cada SC es verificable por prueba automatizada? [SC Test Coverage] — SC-001..SC-003 navegador; SC-004, SC-008, SC-009 con medición temporal; SC-005, SC-006, SC-010 con catálogos; SC-007 comparación byte a byte; SC-011 con reloj controlado; SC-012 suite completa
- [x] **CHK023**: ¿SC-001..SC-003 representan literalmente el criterio de salida de la fase? [Traceability, PLAN Fase 3]

## Edge Case Coverage

- [x] **CHK024**: ¿Se cubren entradas duplicadas o que difieren solo en mayúsculas? [Edge Case — regla determinista concreta en plan]
- [x] **CHK025**: ¿Se cubre el reloj ajustado hacia atrás? [Edge Case, FR-012]
- [x] **CHK026**: ¿Se cubre el envío durante el reinicio del servicio del motor? [Edge Case, FR-029]

## Non-Functional Requirements

- [x] **CHK027**: ¿Seguridad: límites, contención, aislamiento entre análisis y no adivinabilidad de identificadores? [NFR, FR-001, FR-013..FR-018, SC-005, SC-006]
- [x] **CHK028**: ¿Rendimiento: registro, extremo a extremo, reutilización, recuperación? [NFR, SC-003, SC-004, SC-008, SC-009]
- [x] **CHK029**: ¿Capacidad de disco? [Gap → resuelto como Assumption (dimensionamiento del operador; vigilancia en Fase 6)]
- [x] **CHK030**: ¿Calidad estática del motor no empeora? [NFR, FR-028, SC-012]

## Dependencies & Assumptions

- [x] **CHK031**: ¿Se documenta el requisito de host con procesos de larga vida (no serverless)? [Assumption, riesgo sección 5]
- [x] **CHK032**: ¿Se acota lo que queda fuera (autenticación, cancelación, contrato 1.1.0, enmienda)? [Scope, Clarifications]
- [x] **CHK033**: ¿Los defaults del agente están registrados con su estado de confirmación? [Assumption] — 17 defaults "pendiente confirmar"

## Summary

- Total: 38 ítems · Checked: 38 · Deferred: 0
- Gaps resueltos: 5 (CHK002 → FR-005, CHK003 → FR-011, CHK004 → FR-007, CHK005 → FR-016, CHK029 → Assumption); ambigüedades resueltas: 1 (CHK013 → FR-007); conflictos resueltos: 1 (CHK018 → Assumption)
- Completitud: 100 %
