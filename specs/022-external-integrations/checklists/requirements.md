# Requirements Checklist: 022-external-integrations

**Created**: 2026-10-30 (`/iikit-01-specify`) · **Feature**: [spec.md](../spec.md)

> Defaults del plan (`PLAN-VB-PLATAFORMA-LEGACY.md` §4 feature 017, §4.0, §7.5) registrados en *Clarifications*.

- [x] **CQ-001**: QUÉ/POR QUÉ sin implementación — términos de dominio (Service References, `packages.config`, `system.serviceModel`) y campos públicos del contrato
- [x] **CQ-002**: 4 historias con prioridad, prueba independiente y Given/When/Then
- [x] **CQ-003**: SC-001..SC-005 medibles
- [x] **CQ-004**: sin `[NEEDS CLARIFICATION]`
- [x] **CQ-005**: edge cases (carpetas sin svcmap, tipos calificados remotos, URL con puerto, refs fuera de carpeta, duplicados, prefijos EOL, mixtos)
- [x] **CHK001**: alcance 017 del plan → FR: clientes (1) FR-001..005; config (2) FR-010; ausentes (3) FR-020; packages (4) FR-030; EOL (5) FR-031..033; 4.0 FR-040..044
- [x] **CHK002**: compatibilidad y determinismo definidos — FR-041, FR-042, SC-003, SC-004
- [x] **CHK003**: confidencialidad (host sin credenciales, sin valores de configuración) — FR-005, SC-001
- [x] **CHK004**: activación con default — FR-040
- [x] **CHK005**: decisiones pendientes del usuario aisladas — contrato 1.1.0 documentado en Clarifications
