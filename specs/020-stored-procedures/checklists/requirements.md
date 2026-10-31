# Requirements Checklist: 020-stored-procedures

**Purpose**: Validar la calidad de la especificación (contenido, completitud, preparación) antes de plan/testify
**Created**: 2026-10-30 (`/iikit-01-specify`)
**Feature**: [spec.md](../spec.md)

> Modo no interactivo: los huecos se resolvieron con los defaults del plan `PLAN-VB-PLATAFORMA-LEGACY.md` registrados en spec.md *Clarifications*; pendientes de confirmación del usuario (sección 7 del plan).

## Content Quality

- [x] **CQ-001**: ¿La spec describe QUÉ y POR QUÉ sin clases, archivos de código, bibliotecas de implementación ni estructura interna? [Clarity] — sí; Enterprise Library, ADO.NET, Dapper, `CREATE PROCEDURE`, CSV son conceptos del dominio analizado (entrada), no decisiones de implementación; las claves de configuración nombradas son parte de la interfaz pública (contrato de configuración 008)
- [x] **CQ-002**: ¿Las 5 historias (US1–US5) tienen prioridad, prueba independiente y escenarios Given/When/Then? [Completeness]
- [x] **CQ-003**: ¿Los criterios SC-001..SC-008 son medibles (porcentajes, conteos, igualdad byte a byte, tiempo)? [Measurability]
- [x] **CQ-004**: ¿Quedan marcadores `[NEEDS CLARIFICATION]`? [Ambiguity] — no; 7 defaults del plan pendientes de confirmar
- [x] **CQ-005**: ¿Los edge cases cubren nombres no literales, parámetros de salida, texto vs procedimiento, asignación en métodos distintos, catálogos con otros objetos, CSV mal formado, codificaciones, ciclos, límite de literal, proyectos mixtos y configuración inválida? [Edge Case Coverage]

## Requirement Completeness

- [x] **CHK001**: ¿Cada punto del alcance de la feature 015 del plan tiene al menos un FR? [Completeness] — reconocimiento (1) → FR-001..008; `sp:` (2) → FR-005; catálogo (3) → FR-010..017; heurística (4) → FR-040..042; inferencia (5) → FR-020..024; flag (6) → FR-030..032; transversales 4.0 → FR-050..053
- [x] **CHK002**: ¿Se define el comportamiento ante catálogo ausente, inexistente, duplicado o mal formado? [Completeness, FR-013, FR-015, FR-016]
- [x] **CHK003**: ¿Se protege la salida de contenido del catálogo y rutas absolutas? [Completeness, FR-017, SC-007]
- [x] **CHK004**: ¿Se define la compatibilidad C#/Java y del contrato? [Completeness, FR-023, FR-031, SC-004]
- [x] **CHK005**: ¿Se define el determinismo (orden, doble corrida, dos sistemas operativos)? [Completeness, FR-050, SC-005]

## Requirement Clarity

- [x] **CHK006**: ¿"Forma canónica" de un procedimiento está definida? [Clarity, FR-005, FR-012]
- [x] **CHK007**: ¿"Literal plegable" remite al criterio existente de 009? [Clarity, FR-001, Assumptions]
- [x] **CHK008**: ¿Los dos modos de resolución están nombrados y tienen default? [Clarity, FR-014]
- [x] **CHK009**: ¿La lista de verbos de la heurística es cerrada y documentada? [Clarity, FR-040]
- [x] **CHK010**: ¿El valor por defecto "automático" de la activación es verificable por fuente? [Clarity, FR-030]

## Feature Readiness

- [x] **CHK011**: ¿Cada historia es verificable de forma independiente con el corpus sintético? [Readiness, FR-051]
- [x] **CHK012**: ¿Los criterios sobre el corpus externo quedan fuera de CI? [Readiness, FR-053]
- [x] **CHK013**: ¿Los defaults de la sección Clarifications están fijados y trazados? [Readiness] — sí: son los de `PLAN-VB-PLATAFORMA-LEGACY.md` §4.0/§4/§7 (plan ya revisado el 2026-10-30); la confirmación explícita del usuario de las decisiones §7.1 (fuente del catálogo) no bloquea esta feature porque se soportan ambas fuentes y ninguna es obligatoria
