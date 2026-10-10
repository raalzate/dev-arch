# Requirements Checklist: 011-quality-delivery

**Purpose**: Validar la calidad de la especificación (contenido, completitud, preparación) antes de plan/testify
**Created**: 2026-10-10 (`/iikit-01-specify`)
**Feature**: [spec.md](../spec.md)

> Modo no interactivo: los huecos se resolvieron con defaults conservadores registrados en spec.md *Clarifications* como "(default elegido por agente — pendiente confirmar)".

## Content Quality

- [x] **CQ-001**: ¿La spec describe QUÉ y POR QUÉ sin componentes de código ni estructura de implementación? [Clarity] — sí; los nombres de comandos (`make coverage`, `dev-arch-v*`) son interfaz de operación ya existente o decidida por el usuario
- [x] **CQ-002**: ¿Las 7 historias (US1–US7) tienen prioridad, prueba independiente y escenarios Given/When/Then? [Completeness]
- [x] **CQ-003**: ¿Los criterios SC-001..SC-008 son medibles (0 errores, 100 %, ≥ 85 %, 3 informes)? [Measurability]
- [x] **CQ-004**: ¿Quedan marcadores `[NEEDS CLARIFICATION]`? [Ambiguity] — no; 7 defaults del agente pendientes de confirmar
- [x] **CQ-005**: ¿Los edge cases cubren analizador ausente, escenarios heredados divergentes, pasos homónimos, pruebas bloqueadas con errores de tipos, tag inválido, disco lleno, reloj y fases no observadas? [Edge Case Coverage]

## Requirement Completeness

- [x] **CHK001**: ¿Cada ítem de la Fase 6 acotada por el usuario tiene FR? [Completeness] — web unit → FR-016..018; Cucumber-JVM → FR-006..010; tsc/lint → FR-001..005; cobertura → FR-011..015; release → FR-019..022; observabilidad → FR-023..028; analizador obsoleto → FR-029..030; BUG-007 → FR-032
- [x] **CHK002**: ¿La regla aditiva del usuario está como requisito verificable? [Completeness, FR-007, FR-031, SC-008]
- [x] **CHK003**: ¿Se define qué pasa sin analizador .NET? [Completeness, FR-009]

## Requirement Clarity

- [x] **CHK004**: ¿El umbral de cobertura web y su conjunto de módulos están definidos? [Clarity, FR-018]
- [x] **CHK005**: ¿Los eventos del registro estructurado están enumerados? [Clarity, FR-023]
- [x] **CHK006**: ¿La regla de "analizador obsoleto" es objetiva (fecha de modificación de fuentes y proyecto frente al publicado)? [Clarity, FR-029]

## Feature Readiness

- [x] **CHK007**: ¿Cada historia es implementable y verificable de forma independiente? [Readiness]
- [x] **CHK008**: ¿Las exclusiones (imagen Docker → 012; `make e2e` reservado) están explícitas? [Scope]

## Checklist review (`/iikit-03-checklist`, 2026-10-10)

- [x] **CHK009**: ¿Cada FR se puede verificar sin intervención manual (inspección de configuración, ejecución de comandos o pruebas en proceso)? [Testability] — sí; FR-006..010 por ejecución de runners y sus informes, FR-019..022 por script local + inspección del workflow, FR-023..028 con motor simulado en proceso
- [x] **CHK010**: ¿Los umbrales y límites tienen valores (85 % web; Checkstyle ≤ 4763; trabajos de área ≤ 20 min)? [Measurability, FR-018, FR-031]
- [x] **CHK011**: ¿La regla aditiva y las guardas de 006 TS-005/TS-024/TS-042, 007 TS-076 y 005 TS-028/032/033 se respetan en el diseño (solo archivos nuevos de pruebas; cambios en producción/configuración)? [Consistency, plan Structure Decision]
- [x] **CHK012**: ¿El escenario bloqueado 006 TS-012 (marcadores de `make e2e` / `make doctor`) sigue intacto? [Consistency] — sí; ninguno de los dos objetivos cambia en 011
- [x] **CHK013**: ¿Las restricciones de CI de 006 (TS-025 disparo exacto por área, TS-029 matriz de release, TS-030 ≤ 20 min) se respetan? [Consistency] — los cambios son pasos dentro de trabajos existentes y trabajos de release con condición compuesta (no son trabajos de área)
- [x] **CHK014**: ¿Riesgo de duración del trabajo `engine-java` al ejecutar escenarios .NET? [Risk] — mitigado: el analizador se publica una vez; medir en implementación y, si excede, mover la ejecución .NET a un paso del trabajo `schema` (no área nueva)
