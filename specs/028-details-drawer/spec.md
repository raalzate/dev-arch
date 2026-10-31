# Feature Specification: Detalle de componente en panel lateral deslizante

**Feature Branch**: `028-details-drawer` · **Created**: 2026-10-31 · **Status**: Draft
**Input**: User description: "El detalle del componente como panel que sale de la derecha, en lugar de la columna de 320 px, siguiendo las recomendaciones: no modal, ancho propio, compartido por Mapa, Hallazgos y buscador, historial de navegación entre componentes, secciones plegables."

## User Stories *(mandatory)*

### US1 — Panel lateral no modal (P1)
1. **Given** un componente seleccionado en cualquier paso, **Then** su detalle aparece en un panel fijo a la derecha (≈ 520 px en pantallas ≥ 1024 px; ancho completo en menores) sin fondo que bloquee, y el contenido del paso se desplaza para no quedar oculto en pantallas grandes
2. **Given** el panel abierto, **When** pulso Escape o el botón cerrar, **Then** se cierra y la selección se limpia
3. **Given** el panel abierto desde Hallazgos o el buscador, **When** pulso "Ver en el mapa", **Then** el flujo va al Mapa con el componente seleccionado

### US2 — Navegación dentro del panel (P1)
1. **Given** el detalle de A, **When** elijo una llamada entrante/saliente B, **Then** el panel muestra B y ofrece "Atrás" para volver a A (historial lineal, máximo 20)
2. **Given** las secciones Problemas, Llamadas y Archivos, **Then** son plegables y recuerdan su estado durante la sesión del panel

## Requirements *(mandatory)*
- **FR-001**: Componente `DetailsDrawer` único, montado en el flujo (no en cada paso); `MapStep` y `FindingsStep` dejan de reservar la columna lateral.
- **FR-002**: Historial de navegación puro (`pushHistory`, `back`) con límite 20; "Atrás" solo cuando hay historial.
- **FR-003**: Sin modal: no hay overlay ni bloqueo de scroll; `role="complementary"` con `aria-label`; Escape cierra; identificadores de prueba existentes (`component-details`, `detail-attr`, `calls-in-item`) se conservan.
- **FR-004**: Desplazamiento del contenido: margen derecho igual al ancho del panel en ≥ 1024 px mientras está abierto.

## Success Criteria *(mandatory)*
- **SC-001**: Con AmigosPlus, abrir un componente desde el mapa, navegar por dos llamadas y volver con "Atrás"; el mapa sigue visible y operable (verificación en navegador).
- **SC-002**: Pruebas web y de aceptación existentes verdes.
