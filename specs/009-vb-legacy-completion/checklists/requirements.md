# Requirements Checklist: 009-vb-legacy-completion

**Purpose**: Validar la calidad de la especificación (contenido, completitud, preparación) antes de plan/testify
**Created**: 2026-10-08 (`/iikit-01-specify`), extendido por `/iikit-03-checklist` el 2026-10-08
**Feature**: [spec.md](../spec.md)

> Modo no interactivo: los huecos se resolvieron con defaults conservadores registrados en spec.md *Clarifications* como "(default elegido por agente — confirmado por usuario 2026-10-09)". La decisión de corpus es del usuario (2026-10-08).

## Content Quality

- [x] **CQ-001**: ¿La spec describe QUÉ y POR QUÉ sin clases, archivos de código, bibliotecas ni estructura de implementación? [Clarity] — sí; los términos `app.config`, ADO.NET, ASMX/WCF, `Option Strict` son conceptos del dominio de entrada (perfil analizado), no decisiones de implementación
- [x] **CQ-002**: ¿Las 8 historias (US1–US8) tienen prioridad, prueba independiente y escenarios Given/When/Then? [Completeness]
- [x] **CQ-003**: ¿Los criterios de éxito SC-001..SC-009 son medibles (conteos, 100%, igualdad byte a byte)? [Measurability]
- [x] **CQ-004**: ¿Quedan marcadores `[NEEDS CLARIFICATION]`? [Ambiguity] — no; 8 defaults del agente pendientes de confirmar
- [x] **CQ-005**: ¿Los edge cases cubren SQL concatenado con variables, esquemas/delimitadores, procedimientos almacenados, falsos positivos de literales, configuración mal formada, transformaciones de configuración, enlace tardío múltiple por línea, `On Error GoTo`, proyectos mixtos y autogenerados? [Edge Case Coverage]

## Requirement Completeness

- [x] **CHK001**: ¿Cada ítem de la Fase 4/009 del plan de integración y de la tabla *Deferred* de 004 tiene al menos un FR? [Completeness] — endpoints → FR-050..053; tablas → FR-001..004; métricas → FR-020..023; secretos/AppConfig → FR-030..035; code issues → FR-010..015; capas → FR-040..042; corpus → FR-070..071; limitaciones no Windows → FR-060..064; DI VB → fuera de alcance (Assumptions)
- [x] **CHK002**: ¿Se define el comportamiento ante archivos de configuración/DataSet inválidos? [Completeness, FR-035]
- [x] **CHK003**: ¿Se protege la confidencialidad de los valores de configuración? [Completeness, FR-034]
- [x] **CHK004**: ¿Se define la compatibilidad C#/Java y del contrato? [Completeness, FR-080..083]

## Requirement Clarity

- [x] **CHK005**: ¿"Literal SQL" tiene criterio verificable? [Clarity, FR-004]
- [x] **CHK006**: ¿La normalización de tablas es precisa? [Clarity, FR-002]
- [x] **CHK007**: ¿"Credencial en texto plano" es verificable? [Clarity, FR-032]
- [x] **CHK008**: ¿El orden de reglas de capa está definido? [Clarity, FR-040]

## Feature Readiness

- [x] **CHK009**: ¿Cada FR se puede trazar a un escenario de aceptación o a un SC? [Traceability]
- [x] **CHK010**: ¿La feature puede entregarse por historias independientes (US1, US2, US3 como MVP)? [Readiness]

## Requirement Consistency

- [x] **CHK011**: ¿Las reglas de capa VB (FR-040) son consistentes con FR-020/FR-021 de 004 (`*Controller` → `Negocio`, `*Adapter` → `Datos`, `Controlador` solo con evidencia HTTP)? [Consistency, FR-040, US5-AS6] — sí: la regla 4 precede a la de datos; los servicios ASMX/WCF son evidencia HTTP/SOAP
- [x] **CHK012**: ¿FR-060 (`roslyn-fallback` para VB) es consistente con FR-080 (C# byte-idéntico)? [Consistency] — sí: solo cambia la rama de carga por proyecto `.vbproj`; el demo C# `dotnet-unstructured` ya emitía `roslyn-fallback` antes (sin cambio)
- [x] **CHK013**: ¿FR-061/FR-063 (advertencias solo VB) son consistentes con el canal de 007 (advertencias solo si existen)? [Consistency, contracts/dotnet-warnings-channel.md]
- [x] **CHK014**: ¿La semántica de `sensitive_data` VB (FR-033) es coherente con la de Java? [Consistency, Clarifications] — más estrecha por diseño; registrada como default pendiente de confirmar

## Acceptance Criteria Quality & SC Coverage

- [x] **CHK015**: ¿Cada SC-XXX es verificable por una prueba automatizada? [SC Coverage] — SC-001/003/008 con el corpus sintético; SC-002 con la matriz de issues; SC-004 con pruebas de oro C# + baseline Java + suites existentes; SC-005 con doble ejecución; SC-006 con el escenario `@engine`; SC-007 con validación de esquema; SC-009 con el clon limpio
- [x] **CHK016**: ¿Los escenarios de aceptación indican severidades, tipos y textos exactos donde importan? [Measurability, US2, US4]

## Edge Case & Scenario Coverage

- [x] **CHK017**: ¿Se cubren tipos parciales repartidos en varios archivos con distinta `Option Strict`? [Edge Case, FR-011] — un issue por archivo con la opción explícita
- [x] **CHK018**: ¿Se cubren tipos anidados (a qué componente se atribuyen los hallazgos)? [Gap → resuelto en plan/research D2: bloque de tipo más interno]
- [x] **CHK019**: ¿Se cubre el fallback global (directorio sin `.vbproj` con fuentes VB) para la advertencia? [Gap → resuelto en contracts/dotnet-warnings-channel.md]
- [x] **CHK020**: ¿Se cubre la confidencialidad en mensajes de diagnóstico (no solo en la salida)? [Completeness, FR-034]

## Non-Functional Requirements, Dependencies & Assumptions

- [x] **CHK021**: ¿Hay requisito de rendimiento? [Assumption] — sin requisito nuevo en la spec; plan fija < 2 s adicionales sobre el corpus sintético
- [x] **CHK022**: ¿Se documenta la dependencia del entorno Windows/Build Tools para la fidelidad completa? [Dependencies, Assumptions, FR-064]
- [x] **CHK023**: ¿Las dependencias nuevas están justificadas (principio VI)? [Dependencies] — ninguna en runtime; runner BDD solo en pruebas (plan, research D9)
- [x] **CHK024**: ¿La ausencia del corpus real está reflejada en supuestos y criterios? [Assumptions, FR-071, SC-009]
