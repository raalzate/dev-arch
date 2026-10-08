# Requirements Checklist: 009-vb-legacy-completion

**Purpose**: Validar la calidad de la especificación (contenido, completitud, preparación) antes de plan/testify
**Created**: 2026-10-08 (`/iikit-01-specify`)
**Feature**: [spec.md](../spec.md)

> Modo no interactivo: los huecos se resolvieron con defaults conservadores registrados en spec.md *Clarifications* como "(default elegido por agente — pendiente confirmar)". La decisión de corpus es del usuario (2026-10-08).

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
