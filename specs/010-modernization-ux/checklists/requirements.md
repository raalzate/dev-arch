# Requirements Checklist: 010-modernization-ux

**Purpose**: Validar la calidad de la especificación (contenido, completitud, preparación) antes de plan/testify
**Created**: 2026-10-09 (`/iikit-01-specify`)
**Feature**: [spec.md](../spec.md)

> Modo no interactivo: los huecos se resolvieron con defaults conservadores registrados en spec.md *Clarifications* como "(default elegido por agente — confirmado por usuario 2026-10-09)". Las decisiones de arquitectura de información, aspecto, LLM y el tratamiento de los tipos de 008 (opción B: módulo de extensión generado, 005 intacto) son del usuario (2026-10-09).

## Content Quality

- [x] **CQ-001**: ¿La spec describe QUÉ y POR QUÉ sin componentes de código, bibliotecas ni estructura de implementación? [Clarity] — sí; `LLM_PROVIDER` es el nombre de configuración decidido por el usuario (interfaz de operación), no una decisión de implementación
- [x] **CQ-002**: ¿Las 10 historias (US1–US10) tienen prioridad, prueba independiente y escenarios Given/When/Then? [Completeness]
- [x] **CQ-003**: ¿Los criterios de éxito SC-001..SC-007 son medibles (conteos, tiempos, 100 %)? [Measurability]
- [x] **CQ-004**: ¿Quedan marcadores `[NEEDS CLARIFICATION]`? [Ambiguity] — no; 7 defaults del agente pendientes de confirmar
- [x] **CQ-005**: ¿Los edge cases cubren importados sin fuentes, análisis expirados, proyectos vacíos, mixtos C#+VB, proyectos grandes, herramientas de inferencia deshabilitadas, entradas fuera de rango, impresión bloqueada, historial multi-sesión y token de API? [Edge Case Coverage]

## Requirement Completeness

- [x] **CHK001**: ¿Cada ítem de la Fase 5 del plan de integración tiene al menos un FR? [Completeness] — estado del servidor/historial/comparación → FR-012, FR-036..038; tipos generados → FR-041..042; datos ignorados (contratos, legacy_entrypoint, signals, clusters, calls_in, domain, meta.source) → FR-001..002, FR-030..032; grafo → FR-017..021; parámetros de inferencia → FR-022..027; prompts y proveedor → FR-039..040; exportación → FR-033..035; accesibilidad y carga → FR-010..011, FR-016
- [x] **CHK002**: ¿Cada queja del usuario (secciones Java en .NET, secciones vacías, aspecto) tiene FR y SC? [Completeness] — FR-003..005 + SC-001; FR-004 + SC-002; FR-013..016 + SC-007
- [x] **CHK003**: ¿Se define el comportamiento de errores del motor en la re-inferencia? [Completeness, FR-024]
- [x] **CHK004**: ¿Se preserva el contrato de privacidad del navegador de 007? [Completeness, FR-012]

## Requirement Clarity

- [x] **CHK005**: ¿La clasificación tecnológica es determinista y verificable? [Clarity, FR-001, FR-001a]
- [x] **CHK006**: ¿La pertenencia de cada sección a tecnologías está enumerada? [Clarity, FR-005]
- [x] **CHK007**: ¿El orden del plan está definido sin ambigüedad (viabilidad, acoplamiento, nombre)? [Clarity, FR-033]
- [x] **CHK008**: ¿Los parámetros del panel están enumerados? [Clarity, FR-022]

## Feature Readiness

- [x] **CHK009**: ¿Cada FR se puede trazar a un escenario de aceptación o a un SC? [Traceability]
- [x] **CHK010**: ¿La feature puede entregarse por historias independientes (US1–US3 como MVP)? [Readiness]

## Extended Review (`/iikit-03-checklist`, 2026-10-09)

### Requirement Consistency

- [x] **CHK011**: ¿FR-012 (solo identificador y preferencias en el navegador) es consistente con el escenario de inferencia y la comparación en memoria (FR-027, FR-038)? [Consistency] — sí; ninguno se persiste en el navegador
- [x] **CHK012**: ¿FR-005 y FR-001a son consistentes para proyectos mixtos? [Consistency, Edge Cases] — sí; el mixto aplica secciones de C#, VB y .NET
- [x] **CHK013**: ¿FR-028 (pestañas con contenido) es consistente con FR-004 (resumen "Sin hallazgos")? [Consistency] — sí; las pestañas vacías se nombran en el resumen del paso
- [x] **CHK014**: ¿Los ganchos de 007 (subida, estado, fase, id, advertencias, tarjeta de propuesta, nodo de componente, ver código) siguen siendo alcanzables en el nuevo recorrido? [Consistency, FR-009, FR-012] — sí; el Resumen muestra propuestas candidatas y componentes de mayor riesgo con acceso a su código

### Acceptance Criteria Quality

- [x] **CHK015**: ¿SC-004 (< 3 s) define el conjunto de proyectos medido? [Measurability, SC-004] — sí; proyectos de ejemplo
- [x] **CHK016**: ¿FR-035 (Markdown idéntico) excluye fuentes de no determinismo (reloj)? [Clarity, FR-035] — sí; la fecha es la del análisis

### Scenario & Edge Case Coverage

- [x] **CHK017**: ¿Se define el comportamiento ante cambios rápidos de parámetros? [Gap → resuelto, FR-023] — solo se muestra el último resultado
- [x] **CHK018**: ¿El mapa tiene alternativa accesible no visual? [Gap → resuelto, FR-021a] — tabla de dependencias visibles
- [x] **CHK019**: ¿Se cubren análisis importados en re-inferencia y código fuente? [Edge Case, Edge Cases §1]
- [x] **CHK020**: ¿Se cubre el token de API en las operaciones nuevas? [Coverage, FR-043]

### Non-Functional Requirements

- [x] **CHK021**: ¿La accesibilidad está especificada con criterio verificable (WCAG 2.1 AA, nombre accesible, foco visible, paso actual anunciado)? [NFR, FR-010, FR-016]
- [x] **CHK022**: ¿El rendimiento del mapa para proyectos grandes está acotado? [NFR, Edge Cases] — usable con cientos de componentes; plan fija ≥ 300

### Dependencies & Assumptions

- [x] **CHK023**: ¿Se documenta que la re-inferencia depende de que la web active las herramientas de 008 y del grafo almacenado? [Assumption, Assumptions §1]
- [x] **CHK024**: ¿Se documenta que no se cambia ningún escenario bloqueado de 001–009 (opción B, 2026-10-09)? [Dependency, Clarifications]

**Resultado**: 29/29 ítems completos (2 huecos resueltos en spec.md: FR-021a y FR-023).
