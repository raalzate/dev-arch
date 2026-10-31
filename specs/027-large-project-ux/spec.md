# Feature Specification: Experiencia de uso con proyectos grandes (mapa fluido, panel alineado, selección visible, buscador)

**Feature Branch**: `027-large-project-ux` · **Created**: 2026-10-31 · **Status**: Draft
**Input**: User description: "La página está muy lenta con AmigosPlus (1110 componentes, 1251 dependencias, 4984 hallazgos), el panel de detalle se desalinea con listas largas, en Hallazgos no se ve cuál componente está seleccionado y falta un buscador léxico sobre todos los datos del análisis."

## User Stories *(mandatory)*

### US1 — Mapa fluido con cientos de componentes (P1)
1. **Given** un análisis de más de 300 componentes, **When** hago zoom, arrastro o paso el ratón por el mapa, **Then** el mapa responde sin volver a dibujar todos los nodos: el zoom se aplica al lienzo y el ratón solo muestra la etiqueta del nodo (la atenuación de vecinos se reserva para el nodo seleccionado)
2. **Given** un análisis pequeño (≤ 300 componentes), **Then** el mapa conserva el comportamiento actual (etiquetas y atenuación al pasar el ratón)

### US2 — Panel de detalle alineado (P1)
1. **Given** un componente con listas largas (procedimientos `sp:`, anotaciones, dependencias), **Then** el panel de detalle mantiene su ancho: los valores largos se parten y las listas se muestran como elementos desplazables de altura limitada

### US3 — Selección visible en Hallazgos (P1)
1. **Given** el paso Hallazgos con un componente seleccionado, **Then** cada aparición de ese componente en las listas queda resaltada y marcada como actual; el panel de detalle muestra el componente
2. **Given** miles de problemas de código, **Then** cada grupo muestra una primera página (150) con un botón "Mostrar más" en lugar de miles de filas a la vez

### US4 — Buscador léxico sobre todo el análisis (P1)
1. **Given** un análisis cargado, **When** escribo en el buscador de la barra superior, **Then** veo resultados agrupados por tipo (componentes, propuestas, librerías de soporte, problemas, tablas y procedimientos, puntos de entrada, advertencias) que contienen todas las palabras, con el total por tipo
2. **Given** un resultado, **When** lo elijo, **Then** el flujo navega al paso correspondiente y selecciona el componente relacionado (componente → mapa con detalle; problema → hallazgos con detalle; propuesta → propuestas; tabla → mapa con el primer componente que la usa; advertencia → resumen)
3. **Given** la consulta vacía o sin coincidencias, **Then** no hay resultados y se indica

## Requirements *(mandatory)*
- **FR-001**: Índice léxico en el cliente construido una vez por análisis a partir del grafo, la arquitectura, los contratos y las advertencias; búsqueda por palabras (todas deben aparecer, sin distinguir mayúsculas ni acentos), resultados ordenados de forma determinista (tipo, posición de la coincidencia, texto) y limitados (50 por defecto).
- **FR-002**: Resultados agrupados por tipo con conteo; cada resultado lleva el destino (paso y componente).
- **FR-010**: El zoom/arrastre del mapa se aplica sin volver a renderizar nodos y aristas; con más de 300 componentes el ratón no atenúa vecinos.
- **FR-020**: Panel de detalle: valores largos partidos (`break-all`), listas de más de 6 elementos en contenedor desplazable (altura máxima), columna de valores con ancho mínimo cero.
- **FR-030**: En Hallazgos, el componente seleccionado se resalta (`aria-current="true"`) en listas y problemas; los grupos de problemas se paginan de 150 en 150.
- **FR-040**: Sin análisis cargado el buscador no se muestra; los identificadores de prueba existentes del mapa (`map-canvas`, `map-node`, `map-edge`) se conservan.

## Success Criteria *(mandatory)*
- **SC-001**: Con AmigosPlus (1110 componentes) el zoom y el arrastre son fluidos y la selección en Hallazgos es visible (verificación manual en el navegador; pruebas unitarias para el índice, la paginación y el umbral).
- **SC-002**: Pruebas web existentes verdes; sin cambio de API ni de contrato.
