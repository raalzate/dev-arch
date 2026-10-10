# Requirements Checklist: 012-install-doctor-docker

**Purpose**: Validar la calidad de la especificación (contenido, completitud, preparación) antes de plan/testify
**Created**: 2026-10-10 (`/iikit-01-specify`)
**Feature**: [spec.md](../spec.md)

> Modo no interactivo: los huecos se resolvieron con defaults conservadores registrados en spec.md *Clarifications* como "(default elegido por agente — pendiente confirmar)".

## Content Quality

- [x] **CQ-001**: ¿La spec describe QUÉ y POR QUÉ sin estructura de implementación? [Clarity] — sí; los comandos (`npm run doctor`, `npx dev-arch doctor`, `make check-env`, `--doctor`, `GET /api/health`, `docs/INSTALL.md`) son interfaz decidida por el usuario
- [x] **CQ-002**: ¿Las 5 historias (US1–US5) tienen prioridad, prueba independiente y escenarios Given/When/Then? [Completeness]
- [x] **CQ-003**: ¿Los criterios SC-001..SC-006 son medibles (0 FAIL, 100 % requisitos, ≥ 1 componente, 0 diferencias)? [Measurability]
- [x] **CQ-004**: ¿Quedan marcadores `[NEEDS CLARIFICATION]`? [Ambiguity] — no; 10 defaults del agente pendientes de confirmar
- [x] **CQ-005**: ¿Los edge cases cubren JAVA_HOME roto, envoltorio de Maven, SDK sin runtime 8, ENGINE_JAR_PATH roto, motor de otra versión, puerto ocupado, daemon detenido, Windows, doctor roto en la web, arm64 y clave de IA ausente? [Edge Case Coverage]

## Requirement Completeness

- [x] **CHK001**: ¿Cada ítem de la Fase 6b dentro de las decisiones del usuario tiene FR? [Completeness] — doctor → FR-001..013; motor `--doctor` → FR-014..016; salud → FR-017..019; Docker/Compose/CI → FR-020..025; guía → FR-026; guardas → FR-027
- [x] **CHK002**: ¿Las exclusiones del usuario (sin `split`, sin MCP HTTP, sin proveedor) son verificables? [Completeness, FR-021, FR-022]
- [x] **CHK003**: ¿Se define el comportamiento sin Docker local? [Completeness, FR-005, FR-025]

## Requirement Clarity

- [x] **CHK004**: ¿Cada verificación tiene mínimo y regla OK/WARN/FAIL? [Clarity, FR-003..FR-005, Defaults]
- [x] **CHK005**: ¿La ventana de reutilización del endpoint de salud tiene valor (30 s)? [Clarity, FR-018]
- [x] **CHK006**: ¿El caso SDK 10 + runtime 8.0.27 está explícito? [Clarity, FR-012]

## Feature Readiness

- [x] **CHK007**: ¿Cada historia es implementable y verificable de forma independiente? [Readiness]
- [x] **CHK008**: ¿Los conflictos con escenarios bloqueados (006 TS-001 raíz, TS-012 `make doctor`, TS-013 espacios de trabajo, TS-025/029/030 CI) están resueltos sin modificarlos? [Consistency, FR-013, FR-024, FR-027]
