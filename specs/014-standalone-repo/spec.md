# Feature Specification: dev-arch como repositorio propio con el producto en la raíz

**Feature Branch**: `014-standalone-repo`
**Created**: 2026-10-23
**Status**: Draft
**Input**: User description: "No entiendo, este debe tener su propio proyecto." y "mejora la documentación y pon screenshots, explica esto: la tesis es que los modelos de IA pueden refactorizar, pero un modelo de inferencia determinístico es capaz de saber cómo está el proyecto sin inventar; para la modernización es necesario apalancarse de modelos determinísticos; además sirve como guardrail que garantice que el código tenga principios y buenas prácticas, haciendo escaneos constantes; esto garantiza la modernización continua." Decisiones (2026-10-23): repositorio `raalzate/dev-arch`, público, producto en la raíz del repositorio (no en `apps/dev-arch/`), con aprobación explícita para re-testificar los escenarios bloqueados que dependen de la ubicación anterior.

## Contexto

Desde la feature 006 el producto vive en `apps/dev-arch/` dentro del monorepo `maestria-ia`. El usuario decide que dev-arch tenga su propio repositorio, público, con el motor, la web, el contrato, los scripts, los contenedores, la documentación y las especificaciones en la raíz. La historia de cambios del producto se conserva. El repositorio `maestria-ia` deja de ser la fuente del producto.

Varios escenarios bloqueados (006 estructura, CI y configuración; 011 y 012 guardas y CI) y su soporte de pruebas asumen la ubicación `apps/dev-arch` del monorepo o identificadores de commits que la extracción reescribe. El usuario aprobó explícitamente re-testificarlos; ningún otro escenario cambia y ninguna puerta de calidad se relaja.

## User Stories *(mandatory)*

### User Story 1 — Clonar y construir dev-arch desde su propio repositorio (Priority: P1)

Como persona que quiere usar o contribuir a dev-arch, quiero clonar un repositorio que solo contiene dev-arch, con el producto en la raíz, y construirlo y probarlo con los mismos comandos de siempre.

**Independent Test**: Clon limpio del repositorio nuevo: `make build`, `make test` y `make test-e2e-browser` terminan en verde desde la raíz; la raíz contiene solo las áreas y archivos del producto.

**Acceptance Scenarios**:

1. **Given** un clon limpio del repositorio, **When** se ejecutan la construcción y las pruebas desde la raíz, **Then** terminan con código 0 y no dejan archivos modificados ni sin seguimiento
2. **Given** la raíz del repositorio, **When** se listan sus entradas, **Then** son solo las áreas y archivos permitidos del producto (sin `apps/`)
3. **Given** la historia del repositorio, **When** se buscan los commits de las features 006–013, **Then** existen con sus mensajes originales

### User Story 2 — Integración continua propia (Priority: P1)

Como mantenedor, quiero que el flujo de CI viva en el repositorio de dev-arch y se active por cambios en sus propias áreas, con los mismos trabajos y puertas de calidad.

**Acceptance Scenarios**:

1. **Given** el workflow del repositorio, **When** se analiza, **Then** sus filtros de rutas se refieren a las áreas en la raíz y conserva todos los trabajos (motor Java, .NET, esquema, web, aceptación, contenedor, publicación)
2. **Given** un cambio solo en la web, **When** se calculan los trabajos activados, **Then** se activan los mismos trabajos que antes para ese cambio

### User Story 3 — Guardas y referencias de commits vigentes (Priority: P1)

Como mantenedor, quiero que las guardas de "solo cambios aditivos" de 011–013 sigan protegiendo los artefactos bloqueados, ahora contra los commits equivalentes del repositorio nuevo.

**Acceptance Scenarios**:

1. **Given** las guardas de 011, 012 y 013, **When** se ejecutan en el repositorio nuevo, **Then** comparan contra los commits de cierre equivalentes (mismo contenido del producto) y siguen en verde
2. **Given** los artefactos bloqueados de 001–013, **When** se comparan con su contenido previo a la extracción, **Then** solo cambiaron los escenarios re-testificados por la ubicación, con su nuevo hash registrado

### User Story 4 — Publicación (Priority: P2)

Como dueño, quiero el repositorio publicado como `raalzate/dev-arch` público, sin secretos en la historia, y la guía de instalación apuntando a él.

**Acceptance Scenarios**:

1. **Given** la historia completa, **When** se busca cualquier credencial real, **Then** no se encuentra ninguna
2. **Given** la guía de instalación y el README, **When** se leen, **Then** indican clonar `raalzate/dev-arch` y ejecutar los comandos desde la raíz

### User Story 5 — Documentación que explica la tesis, con capturas reales (Priority: P1)

Como lector del repositorio (evaluador de la tesis, arquitecto o desarrollador), quiero una portada que explique por qué dev-arch usa inferencia determinista —los modelos de IA refactorizan, pero solo un análisis determinista dice cómo está el proyecto sin inventar—, cómo sirve de guardrail con escaneos constantes y cómo eso habilita la modernización continua, con capturas reales de la aplicación y del uso desde un agente.

**Independent Test**: Abrir la portada del repositorio: explica la tesis (determinismo frente a generación, guardrail, modernización continua), muestra al menos cinco capturas reales de los pasos de la web, enlaza la instalación, la conexión de agentes y la arquitectura, y todas las imágenes referenciadas existen.

**Acceptance Scenarios**:

1. **Given** la portada del repositorio, **When** se lee, **Then** explica que el análisis es determinista y reproducible (misma entrada, misma salida), que los modelos de IA consumen ese análisis en lugar de inferir la estructura, y que el análisis repetido en cada cambio actúa como guardrail de principios y buenas prácticas para una modernización continua
2. **Given** la portada y la documentación, **When** se buscan las capturas, **Then** hay capturas reales del resumen, mapa del sistema, propuestas, hallazgos y plan, y todas las imágenes referenciadas existen en el repositorio
3. **Given** la portada, **When** se sigue el inicio rápido, **Then** indica clonar `raalzate/dev-arch`, construir, levantar la web o el contenedor y conectar un agente
4. **Given** la documentación, **When** se busca el ciclo agente ↔ análisis determinista, **Then** hay una explicación del bucle "analizar → refactorizar con IA → reanalizar y comparar" con los criterios que se vigilan (hallazgos por severidad, acoplamiento, cohesión, viabilidad)

## Requirements *(mandatory)*

- **FR-001**: El repositorio MUST contener el producto en la raíz con la historia de commits del producto conservada.
- **FR-002**: Construcción, pruebas, contenedor y doctor MUST funcionar desde la raíz sin referencias a `apps/dev-arch`.
- **FR-003**: El workflow de CI MUST vivir en `.github/workflows/` del repositorio, con filtros por área en la raíz y los mismos trabajos y puertas.
- **FR-004**: Las guardas que referencian commits MUST usar los commits equivalentes del repositorio nuevo.
- **FR-005**: Solo los escenarios bloqueados que codifican la ubicación del monorepo MUST re-testificarse; los demás hashes quedan intactos.
- **FR-006**: La historia publicada MUST no contener credenciales reales.
- **FR-007**: La documentación MUST describir el repositorio propio y los comandos desde la raíz.
- **FR-008**: El comportamiento del producto (análisis, API, web, herramientas MCP) MUST no cambiar.
- **FR-009**: La portada (README) MUST explicar la tesis: inferencia determinista como fuente de verdad del estado del proyecto, IA generativa como ejecutora de la refactorización, y análisis repetido como guardrail de modernización continua.
- **FR-010**: La documentación MUST incluir capturas reales de los cinco pasos de la web y de la conexión desde un agente, versionadas en `docs/`.
- **FR-011**: La documentación MUST describir el bucle agente ↔ análisis determinista y los indicadores que se vigilan entre análisis.

## Success Criteria *(mandatory)*

- **SC-001**: Clon limpio del repositorio nuevo: build, test y e2e de navegador en verde.
- **SC-002**: 0 referencias a `apps/dev-arch` en código, scripts, contenedores y pruebas.
- **SC-003**: 0 credenciales reales en la historia publicada.
- **SC-004**: 100 % de los escenarios no re-testificados conservan su hash.
- **SC-005**: La portada explica la tesis y muestra al menos 5 capturas reales; 0 imágenes rotas.

## Clarifications

### Session 2026-10-23 (decisiones del usuario)

- Q: ¿Dónde? → A: `raalzate/dev-arch`. Q: ¿Visibilidad? → A: público. Q: ¿Estructura? → A: producto en la raíz, aceptando re-testificar los escenarios bloqueados que dependen de la ubicación (aprobación explícita).

## Assumptions

- `maestria-ia` conserva su copia histórica; su retiro o congelamiento se decide aparte.
