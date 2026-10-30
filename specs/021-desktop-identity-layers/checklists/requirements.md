# Requirements Checklist: 021-desktop-identity-layers

**Purpose**: Validar la calidad de la especificación antes de plan/testify
**Created**: 2026-10-30 (`/iikit-01-specify`)
**Feature**: [spec.md](../spec.md)

> Modo no interactivo: defaults del plan `PLAN-VB-PLATAFORMA-LEGACY.md` §4 (feature 016) y §4.0, con dos decisiones registradas en *Clarifications* (opción (b) de capas; `maxDepth` excluido).

## Content Quality

- [x] **CQ-001**: ¿La spec describe QUÉ y POR QUÉ sin estructura de implementación? — sí; `.vbproj`, `RootNamespace`, `Sub Main`, `MsgBox` son conceptos del dominio analizado; `annotations`/`layer`/`legacy_entrypoint` son campos del contrato público
- [x] **CQ-002**: ¿Las 4 historias tienen prioridad, prueba independiente y escenarios Given/When/Then?
- [x] **CQ-003**: ¿Los criterios SC-001..SC-006 son medibles?
- [x] **CQ-004**: ¿Quedan marcadores `[NEEDS CLARIFICATION]`? — no
- [x] **CQ-005**: ¿Los edge cases cubren RootNamespace inválido, herencia transitiva, Designer huérfano, Exe sin Sub Main, varios Sub Main, MsgBox en módulos, concatenación de literales, fachadas con constructor, umbrales inválidos y proyectos mixtos?

## Requirement Completeness

- [x] **CHK001**: ¿Cada punto del alcance 016 del plan tiene FR o exclusión explícita? — 016.1 → FR-001..004; 016.2 → FR-010..016; 016.3 → FR-020; 016.4 → FR-030..036; 016.5 → FR-044 (excluido); 4.0 → FR-040..043
- [x] **CHK002**: ¿Está definida la compatibilidad (contrato 1.0.0, baselines, VB anterior)? — FR-014, FR-040, SC-003, SC-005
- [x] **CHK003**: ¿Está definido el determinismo? — FR-036, FR-041, SC-004
- [x] **CHK004**: ¿Está definida la activación y su default? — FR-030

## Requirement Clarity

- [x] **CHK005**: ¿Cada regla de deuda tiene condición positiva y negativa verificable? — US4 escenarios 1-5
- [x] **CHK006**: ¿La proyección capa fina → `layer` es exacta? — FR-014, FR-016
- [x] **CHK007**: ¿El punto de entrada por lotes tiene forma de salida definida? — FR-012, FR-015

## Feature Readiness

- [x] **CHK008**: ¿Cada historia es verificable con el corpus sintético? — FR-042
- [x] **CHK009**: ¿Las decisiones pendientes del usuario están aisladas y no bloquean? — `maxDepth` (FR-044) y contrato 1.1.0 documentados en Clarifications
