# Feature Specification: Experiencia de modernización en dev-arch

**Feature Branch**: `010-modernization-ux`
**Created**: 2026-10-09
**Status**: Draft
**Input**: User description: "Fase 5 — Experiencia de usuario en dev-arch (PLAN-INTEGRACION-DEV-ARCH.md), reorientada por el usuario (2026-10-09): el propósito de la aplicación es la modernización de código legacy Java, .NET (C#) y VB.NET. Hoy un análisis .NET muestra secciones exclusivas de Java (\"Componentes Obsoletos (@Deprecated) (0)\", \"Componentes EJB (0)\" con una tabla \"Tipo EJB\" vacía). Las secciones deben ser coherentes con la tecnología detectada, las vacías se ocultan o se resumen en una línea de 'sin hallazgos', y el aspecto debe mejorar mucho. Flujo de modernización: resumen ejecutivo → mapa del sistema → propuestas de extracción con parámetros de inferencia en vivo → hallazgos → plan de modernización exportable. Además: historial y comparación de análisis desde el servidor, tipos generados desde el contrato para todo lo que se muestra, documentación IA con plantillas por tecnología y proveedor de modelo configurable."

## Contexto

Las features 005–009 dejaron un motor único (Java, C#, VB.NET legacy) con contrato de datos versionado, una web que ejecuta los análisis en el servidor como trabajos asíncronos (007) y un motor de inferencia configurable con re-inferencia y puntuación de propuestas sin re-parsear (008). La interfaz de usuario, sin embargo, sigue siendo la del prototipo original centrado en Java:

- Un análisis de un proyecto .NET muestra secciones que solo tienen sentido en Java (componentes obsoletos por anotación, EJB) con contadores en cero y tablas vacías; el usuario no sabe si "0" significa "no hay" o "no aplica".
- Gran parte de lo que el motor produce no se muestra: contratos de API, punto de entrada legacy de cada propuesta, señales y clústeres de las propuestas, llamadas entrantes, dominio, origen del análisis (tecnología) y tipo y peso de las dependencias.
- No hay un recorrido orientado a la decisión de modernización: los datos se presentan como un tablero genérico de métricas.
- Los umbrales de inferencia (008) no se pueden ajustar desde la interfaz; las propuestas editadas por el usuario no se re-evalúan.
- No se pueden consultar análisis anteriores ni compararlos; la documentación generada por IA asume Java y un único proveedor de modelo.
- La interfaz declara a mano tipos de datos del contrato que ya divergen de él.

Esta feature rediseña la experiencia alrededor del flujo de modernización. La Constitución vigente (v1.0.0) obliga a: no cambiar las salidas del motor ni el contrato sin versionado (principio I), mantener la lógica de análisis en el motor (principio II; la interfaz solo presenta, filtra y re-etiqueta lo que el motor produce), TDD (principio III), determinismo de las salidas del motor (principio IV), degradación con advertencias claras (principio V) y dependencias mínimas justificadas (principio VI).

## User Stories *(mandatory)*

### User Story 1 — Resultados coherentes con la tecnología analizada (Priority: P1)

Como arquitecto que moderniza un sistema legacy, quiero que la interfaz identifique la tecnología del proyecto analizado (Java, .NET C# o VB.NET) y muestre solo las secciones que tienen sentido para ella, ocultando las secciones vacías, de modo que no tenga que interpretar contadores en cero de conceptos que no existen en mi tecnología.

**Why this priority**: Es el defecto que el usuario reporta como bloqueante: un análisis .NET con secciones EJB/@Deprecated hace dudar de la fiabilidad de todo el análisis.

**Independent Test**: Analizar el proyecto de ejemplo C# y comprobar que la página indica ".NET · C#", no contiene ninguna sección exclusiva de Java y no contiene ninguna sección con cero elementos; repetir con el proyecto Java y con el proyecto VB sintético.

**Acceptance Scenarios**:

1. **Given** un análisis cuyo origen es el analizador de Java, **When** se muestran los resultados, **Then** la tecnología se presenta como "Java"
2. **Given** un análisis cuyo origen es el analizador .NET y cuyos componentes provienen de archivos C#, **When** se muestran los resultados, **Then** la tecnología se presenta como ".NET · C#"
3. **Given** un análisis cuyo origen es el analizador .NET y cuyos componentes provienen de archivos VB, **When** se muestran los resultados, **Then** la tecnología se presenta como "VB.NET"; si hay componentes de ambos lenguajes se presenta como ".NET · C# + VB"
4. **Given** un análisis .NET (C# o VB), **When** se muestran los resultados, **Then** no aparece ninguna sección exclusiva de Java (componentes obsoletos por anotación, EJB, JNDI)
5. **Given** un análisis Java, **When** se muestran los resultados, **Then** no aparece ninguna sección exclusiva de .NET (inyección registrada en el contenedor de .NET, configuración de aplicación .NET, presentación de escritorio, módulos, riesgos propios de VB)
6. **Given** una sección aplicable a la tecnología que no tiene elementos, **When** se muestran los resultados, **Then** la sección no se muestra y su nombre aparece en un resumen único "Sin hallazgos" del paso correspondiente
7. **Given** un análisis VB.NET de escritorio, **When** se muestran los resultados, **Then** aparecen las secciones propias de VB que tienen elementos (presentación de escritorio, acceso a datos, configuración de aplicación, riesgos de VB legacy) y las capas se nombran con términos de escritorio (por ejemplo "Presentación (formularios y reportes)" en lugar de "Web")
8. **Given** un análisis cuyo origen es de fidelidad reducida, **When** se muestran los resultados, **Then** el resumen ejecutivo advierte de la fidelidad reducida junto a las advertencias del análisis

---

### User Story 2 — Recorrido de modernización en cinco pasos (Priority: P1)

Como arquitecto, quiero recorrer los resultados en el orden en que tomo la decisión de modernización — resumen ejecutivo, mapa del sistema, propuestas de extracción, hallazgos y plan — de modo que cada pantalla responda a una pregunta concreta.

**Why this priority**: Es la nueva arquitectura de información pedida por el usuario y la estructura en la que se apoyan las demás historias.

**Independent Test**: Tras un análisis, navegar los cinco pasos con teclado y con ratón y comprobar que cada uno muestra su contenido y que el paso activo se indica de forma accesible.

**Acceptance Scenarios**:

1. **Given** un análisis completado, **When** se muestran los resultados, **Then** la navegación ofrece en este orden los pasos "Resumen", "Mapa del sistema", "Propuestas", "Hallazgos" y "Plan", y el paso inicial es "Resumen"
2. **Given** el paso "Resumen", **When** se muestra, **Then** presenta la tecnología, el tamaño del sistema (componentes, líneas de código, dependencias), la salud del legado (hallazgos por severidad, componentes con secretos, datos sensibles), las propuestas candidatas a extracción, los componentes de mayor riesgo y las advertencias del análisis
3. **Given** cualquier paso, **When** el usuario usa el teclado, **Then** puede llegar a todos los pasos y el paso activo se anuncia como actual a las tecnologías de asistencia
4. **Given** un análisis en curso, **When** el usuario mira la página, **Then** ve la fase real del análisis (detección, extracción, inferencia, escritura), su posición en la secuencia y el tiempo transcurrido, y no ve resultados parciales

---

### User Story 3 — Aspecto de herramienta técnica sobria, clara y oscura (Priority: P1)

Como usuario técnico, quiero una interfaz densa pero legible, con modo claro y oscuro, colores de acento por tecnología e insignias de severidad consistentes, de modo que pueda trabajar largas sesiones con la herramienta y reconocer de un vistazo la tecnología y el riesgo.

**Why this priority**: El usuario pide "un look & feel mucho mejor"; sin él las demás mejoras no se perciben.

**Independent Test**: Cambiar entre modo claro y oscuro, recargar y comprobar que se conserva; comprobar que cada severidad tiene una insignia con texto (no solo color) y que el contraste de texto cumple el nivel AA.

**Acceptance Scenarios**:

1. **Given** la página, **When** el usuario cambia el tema, **Then** toda la interfaz pasa a modo oscuro (o claro) y la preferencia se conserva al recargar en ese navegador
2. **Given** un usuario sin preferencia guardada, **When** abre la página, **Then** el tema sigue la preferencia del sistema operativo
3. **Given** un hallazgo de cualquier severidad, **When** se muestra, **Then** lleva una insignia con el nombre de la severidad y un color propio de esa severidad
4. **Given** un análisis de una tecnología, **When** se muestra, **Then** la insignia de tecnología usa el color de acento de esa tecnología (Java, .NET C#, VB.NET)

---

### User Story 4 — Mapa del sistema explorable (Priority: P2)

Como arquitecto, quiero un mapa de dependencias que pueda colorear y filtrar por tipo de dependencia, con grosor según la intensidad, agrupado por capa o por propuesta, y filtrable por la severidad de los hallazgos, de modo que vea dónde está el acoplamiento real del sistema.

**Why this priority**: El tipo y el peso de las dependencias ya están en los datos y hoy se ignoran; son la evidencia de los cortes de extracción.

**Independent Test**: Analizar el proyecto C#, ocultar un tipo de dependencia y comprobar que esas dependencias desaparecen del mapa; agrupar por propuesta y comprobar que cada componente aparece en el grupo de su propuesta.

**Acceptance Scenarios**:

1. **Given** el mapa, **When** se muestra, **Then** cada tipo de dependencia presente en el análisis tiene un color y una entrada en la leyenda con su número de dependencias; una dependencia con varios tipos cuenta en cada uno de ellos
2. **Given** el mapa, **When** el usuario desactiva un tipo de dependencia, **Then** se ocultan las dependencias que solo tienen tipos desactivados
3. **Given** dos dependencias con pesos distintos, **When** se muestran, **Then** la de mayor peso se dibuja más gruesa
4. **Given** el mapa, **When** el usuario elige agrupar por capa o por propuesta, **Then** los componentes se agrupan visualmente según esa elección y la leyenda nombra los grupos
5. **Given** el mapa, **When** el usuario elige una severidad mínima de hallazgos, **Then** solo se resaltan los componentes con al menos un hallazgo de esa severidad o superior

---

### User Story 5 — Ajustar la inferencia y re-evaluar propuestas en vivo (Priority: P2)

Como arquitecto, quiero ajustar los parámetros principales de la inferencia (umbrales de viabilidad, pesos de la puntuación, umbral de evidencia, viabilidad mínima) y ver las propuestas recalculadas sin volver a analizar el código, y quiero que una propuesta que yo edite (moviendo componentes) se puntúe con las mismas fórmulas del motor.

**Why this priority**: Es el criterio de salida de la fase y el uso principal de la configurabilidad de 008.

**Independent Test**: Tras un análisis, subir el umbral de viabilidad media por encima de la puntuación de las propuestas y comprobar que su viabilidad se recalcula sin un nuevo análisis; mover un componente entre propuestas y comprobar que la propuesta editada muestra su nueva viabilidad y puntuación.

**Acceptance Scenarios**:

1. **Given** el paso "Propuestas", **When** se muestra, **Then** el panel "Parámetros de inferencia" presenta cada parámetro con su valor por defecto del motor y su rango permitido
2. **Given** el panel, **When** el usuario cambia un parámetro, **Then** las propuestas se recalculan a partir del análisis ya realizado (sin volver a analizar el código) y la interfaz indica que se muestran propuestas recalculadas con parámetros no predeterminados
3. **Given** parámetros incoherentes (por ejemplo umbral medio mayor que el alto), **When** se aplican, **Then** se muestra el mensaje de validación del motor y las propuestas anteriores se conservan
4. **Given** el panel con cambios, **When** el usuario restablece los valores por defecto, **Then** se muestran de nuevo las propuestas originales del análisis
5. **Given** una propuesta editada por el usuario (componentes añadidos o quitados), **When** se re-evalúa, **Then** muestra la viabilidad, la puntuación, las métricas y la justificación calculadas por el motor para ese conjunto de componentes
6. **Given** el mismo análisis y los mismos parámetros, **When** se recalcula dos veces, **Then** las propuestas son idénticas

---

### User Story 6 — Hallazgos completos para la modernización (Priority: P2)

Como arquitecto, quiero ver en un solo paso todos los hallazgos que el motor produce — problemas de código por severidad y patrón, secretos, contratos de API, puntos de entrada legacy de cada propuesta, señales y clústeres, llamadas entrantes y dominio — de modo que no pierda información que el motor ya calculó.

**Why this priority**: Hoy la interfaz ignora una parte relevante de la salida del motor.

**Independent Test**: Analizar el proyecto Java de ejemplo y comprobar que la pestaña "Contratos" lista sus endpoints con método y ruta, que los problemas de código se pueden agrupar por severidad y por patrón y que el detalle de un componente muestra sus llamadas entrantes y su dominio.

**Acceptance Scenarios**:

1. **Given** el paso "Hallazgos", **When** se muestra, **Then** ofrece las pestañas con contenido entre "Problemas de código", "Secretos", "Contratos" y "Puntos de entrada"; una pestaña sin contenido no se muestra y se nombra en el resumen "Sin hallazgos"
2. **Given** la pestaña "Problemas de código", **When** el usuario agrupa por severidad o por patrón y filtra por severidad, **Then** la lista refleja la agrupación y el filtro con sus totales
3. **Given** la pestaña "Contratos", **When** se muestra, **Then** cada endpoint presenta método, ruta, componente propietario, parámetros y esquemas de petición y respuesta cuando existen
4. **Given** una propuesta, **When** se muestra su detalle, **Then** incluye su punto de entrada legacy (tipo, clase principal, operaciones expuestas, canales), sus señales (clústeres, tamaño medio) y sus tablas con su origen
5. **Given** un componente, **When** se muestra su detalle, **Then** incluye capa (con el término de su tecnología), dominio, llamadas salientes y entrantes, tablas, métricas disponibles y hallazgos; los atributos sin valor no se muestran

---

### User Story 7 — Plan de modernización exportable (Priority: P2)

Como arquitecto, quiero un plan de modernización ordenado (qué extraer primero, con qué riesgos y acciones) que pueda exportar como JSON editado, Markdown y PDF, de modo que lo comparta con el equipo y la dirección.

**Why this priority**: Es el entregable final del recorrido.

**Independent Test**: Tras un análisis, abrir el paso "Plan", exportar en Markdown y comprobar que el documento contiene la tecnología, el resumen, las propuestas en el orden del plan y los hallazgos críticos; exportar en PDF y comprobar que se genera un documento imprimible con el mismo contenido.

**Acceptance Scenarios**:

1. **Given** el paso "Plan", **When** se muestra, **Then** presenta las propuestas ordenadas por viabilidad (Alta, Media, Baja) y, a igual viabilidad, por menor acoplamiento externo, con sus acciones recomendadas y sus riesgos (datos sensibles, secretos, hallazgos críticos)
2. **Given** el plan, **When** el usuario exporta JSON, **Then** obtiene la arquitectura con las ediciones y recálculos vigentes y los parámetros de inferencia usados
3. **Given** el plan, **When** el usuario exporta Markdown, **Then** obtiene un documento con la tecnología, el resumen ejecutivo, el plan por etapas, los hallazgos por severidad y las advertencias del análisis
4. **Given** el plan, **When** el usuario exporta PDF, **Then** obtiene una vista imprimible del mismo contenido del Markdown sin controles de la interfaz
5. **Given** el mismo análisis, parámetros y ediciones, **When** se exporta dos veces en Markdown, **Then** los documentos son idénticos

---

### User Story 8 — Historial y comparación de análisis (Priority: P2)

Como arquitecto, quiero ver los análisis disponibles en el servidor, abrir uno anterior y comparar dos análisis (por ejemplo antes y después de una refactorización), de modo que mida el avance de la modernización.

**Why this priority**: Está en el plan de la fase (roadmap) y aprovecha el almacén de análisis del servidor de 007.

**Independent Test**: Realizar dos análisis, abrir el historial, comprobar que ambos aparecen con su tecnología, fecha y estado; abrir el primero; comparar los dos y comprobar las diferencias de componentes, propuestas y hallazgos.

**Acceptance Scenarios**:

1. **Given** análisis disponibles en el servidor, **When** el usuario abre el historial, **Then** ve cada análisis con proyecto, tecnología, fecha, estado y totales, del más reciente al más antiguo
2. **Given** el historial, **When** el usuario abre un análisis completado, **Then** la página pasa a mostrar sus resultados y lo recuerda como análisis activo
3. **Given** dos análisis completados, **When** el usuario los compara, **Then** ve para cada uno y su diferencia: componentes, líneas de código, dependencias, propuestas por viabilidad y hallazgos por severidad, y la lista de componentes que aparecen solo en uno de ellos
4. **Given** un análisis fallido o en curso, **When** aparece en el historial, **Then** no se puede seleccionar para comparar

---

### User Story 9 — Documentación IA especializada por tecnología con proveedor configurable (Priority: P3)

Como arquitecto, quiero que la documentación generada por IA use una plantilla propia de la tecnología del análisis (Spring/Java EE, ASP.NET Core, escritorio VB) y que el operador pueda elegir el proveedor del modelo, de modo que el documento hable el idioma técnico del sistema analizado.

**Why this priority**: Mejora la calidad del documento pero no bloquea el recorrido.

**Independent Test**: Comprobar qué plantilla se elige para cada uno de los tres proyectos de ejemplo y qué proveedor se usa según la configuración del servidor, sin invocar un modelo real.

**Acceptance Scenarios**:

1. **Given** un análisis Java, C# o VB, **When** se solicita la documentación, **Then** se usa la plantilla de Spring/Java EE, de ASP.NET Core o de escritorio VB respectivamente
2. **Given** el servidor sin proveedor configurado, **When** se genera la documentación, **Then** se usa el proveedor Gemini como hasta ahora
3. **Given** el servidor configurado con el proveedor Anthropic, **When** se genera la documentación, **Then** se usa ese proveedor; si falta su credencial, el error lo indica sin exponer secretos
4. **Given** un proveedor desconocido, **When** arranca la generación, **Then** se informa el valor inválido y los valores permitidos

---

### User Story 10 — Tipos generados desde el contrato para todo lo que se muestra (Priority: P3)

Como desarrollador del producto, quiero que la interfaz use exclusivamente tipos y validadores generados desde el contrato — incluidos la configuración de inferencia y las respuestas de re-inferencia y puntuación de 008 — de modo que la interfaz no diverja del motor.

**Why this priority**: Requisito global del plan ("tipos TS generados, no manuales") y precondición para mostrar los datos nuevos con seguridad.

**Independent Test**: Regenerar los tipos y comprobar que existen tipos y validadores para la configuración de inferencia y las dos respuestas nuevas, y que la interfaz no declara a mano tipos de datos del contrato.

**Acceptance Scenarios**:

1. **Given** el contrato vigente, **When** se generan los tipos, **Then** existen tipo y validador para la configuración de inferencia, la respuesta de re-inferencia y la respuesta de puntuación, además de los ocho existentes
2. **Given** el código de la interfaz, **When** se buscan declaraciones de tipos de datos del contrato, **Then** todas residen en la salida generada del paquete del contrato
3. **Given** una respuesta de re-inferencia o de puntuación del motor, **When** la web la recibe, **Then** la valida con el validador generado antes de mostrarla

---

### Edge Cases

- Análisis importado (sin código fuente): no se ofrece "Ver código"; la re-inferencia y la puntuación sí están disponibles porque el almacén conserva el grafo del análisis.
- Análisis expirado o eliminado mientras se muestra: re-inferencia, puntuación o comparación informan que el análisis ya no está disponible.
- Proyecto sin propuestas o sin dependencias: los pasos correspondientes muestran un estado vacío explicativo, no tablas vacías.
- Proyecto con componentes C# y VB a la vez: la tecnología muestra ambos lenguajes y se aplican las secciones de ambos.
- Proyecto con cientos de componentes: el mapa sigue siendo usable (agrupación, filtros) y las listas largas se pueden recorrer sin bloquear la página.
- Motor sin herramientas de inferencia habilitadas: el panel de parámetros se desactiva con un mensaje que nombra la causa.
- Parámetro fuera de rango introducido por teclado: se limita al rango del contrato antes de enviarse.
- Exportación PDF en un navegador que bloquea la impresión: el documento imprimible sigue disponible en pantalla.
- Historial con análisis de otras sesiones: se listan (el almacén es del servidor) pero nunca se mezclan sus componentes con el análisis activo.
- Token de API exigido por el servidor: historial, re-inferencia, puntuación y comparación piden el token igual que el análisis.

## Requirements *(mandatory)*

### Functional Requirements

**Tecnología y coherencia de secciones (US1)**

- **FR-001**: El sistema MUST determinar el perfil tecnológico de un análisis a partir del origen declarado en sus metadatos y de las extensiones de los archivos de sus componentes: Java (origen del analizador Java), .NET · C#, VB.NET o .NET · C# + VB (origen del analizador .NET, según los lenguajes de los archivos, ver FR-001a), y si el origen es de fidelidad reducida.
- **FR-001a**: Con origen .NET: solo archivos C# → ".NET · C#"; solo archivos VB → "VB.NET"; ambos → ".NET · C# + VB"; sin archivos reconocibles → ".NET".
- **FR-002**: El sistema MUST mostrar el perfil tecnológico como insignia visible en la cabecera de resultados y en el resumen ejecutivo.
- **FR-003**: Cada sección de resultados MUST declarar a qué tecnologías aplica; una sección MUST mostrarse solo si aplica al perfil del análisis y tiene al menos un elemento.
- **FR-004**: Las secciones aplicables sin elementos MUST resumirse en una única línea "Sin hallazgos" por paso que las nombra; las secciones no aplicables MUST omitirse sin mención.
- **FR-005**: Las secciones exclusivas de Java MUST ser: componentes obsoletos por anotación, componentes EJB y uso de JNDI. La exclusiva de .NET C# MUST ser: dependencias registradas en el contenedor de inyección. Las exclusivas de VB.NET MUST ser: presentación de escritorio (formularios y reportes), módulos compartidos y riesgos de VB legacy. La de .NET (C# y VB) MUST ser: configuración de aplicación (archivos de configuración .NET). Las demás secciones (interfaces, secretos, dependencias externas, tablas, mensajería, endpoints, problemas de código) MUST aplicar a todas las tecnologías.
- **FR-006**: Los nombres de capa MUST mostrarse con el término de la tecnología (en VB.NET la capa de presentación se muestra como "Presentación (formularios y reportes)" y la capa compartida como "Módulos compartidos"), sin alterar los datos del análisis.
- **FR-007**: Cuando el origen del análisis sea de fidelidad reducida, el resumen ejecutivo MUST mostrar una advertencia que lo explique, junto a las advertencias del análisis.

**Recorrido y estado (US2)**

- **FR-008**: Los resultados MUST organizarse en cinco pasos en este orden: Resumen, Mapa del sistema, Propuestas, Hallazgos, Plan; el paso inicial tras completar o abrir un análisis MUST ser Resumen.
- **FR-009**: El Resumen MUST presentar: perfil tecnológico; tamaño (componentes, líneas de código, dependencias, dependencias externas); salud del legado (hallazgos por severidad, componentes con secretos, propuestas con datos sensibles, tablas); hasta tres propuestas candidatas (mejor viabilidad); hasta ocho componentes de mayor riesgo (por severidad de hallazgos, luego acoplamiento) con acceso a su código fuente cuando el análisis lo conserva; y las advertencias del análisis.
- **FR-010**: La navegación entre pasos MUST ser operable por teclado y anunciar el paso actual a las tecnologías de asistencia.
- **FR-011**: Mientras un análisis está en cola o en ejecución, la página MUST mostrar el estado, la fase real (detección, extracción, inferencia, escritura) con su posición en la secuencia y el tiempo transcurrido, y MUST NOT mostrar resultados parciales.
- **FR-012**: La página MUST conservar el comportamiento de 007: el navegador guarda solo el identificador del análisis activo (y preferencias de interfaz de tamaño mínimo), nunca resultados; recargar retoma el análisis activo.

**Aspecto (US3)**

- **FR-013**: La interfaz MUST ofrecer modo claro y oscuro; sin preferencia guardada MUST seguir la del sistema operativo; la elección MUST conservarse en el navegador.
- **FR-014**: Cada severidad (crítica, error, advertencia, informativa) MUST tener una insignia con texto y color propios, iguales en toda la interfaz.
- **FR-015**: Cada tecnología (Java, .NET C#, VB.NET) MUST tener un color de acento propio usado en su insignia.
- **FR-016**: El texto MUST cumplir contraste WCAG 2.1 AA en ambos modos y todos los controles MUST tener nombre accesible y foco visible.

**Mapa del sistema (US4)**

- **FR-017**: El mapa MUST colorear cada dependencia según su tipo, con leyenda que muestre cada tipo presente y su número de dependencias; los tipos compuestos MUST contar en cada uno de sus tipos.
- **FR-018**: El usuario MUST poder activar o desactivar cada tipo; una dependencia MUST ocultarse cuando todos sus tipos estén desactivados.
- **FR-019**: El grosor de cada dependencia MUST crecer con su peso.
- **FR-020**: El usuario MUST poder agrupar los componentes por capa o por propuesta.
- **FR-021**: El usuario MUST poder elegir una severidad mínima de hallazgos; solo los componentes con al menos un hallazgo de esa severidad o superior MUST resaltarse.
- **FR-021a**: El mapa MUST ofrecer una alternativa textual accesible: una tabla de las dependencias visibles con origen, destino, tipos y peso, que respeta los mismos filtros.

**Parámetros de inferencia (US5)**

- **FR-022**: El paso Propuestas MUST incluir un panel "Parámetros de inferencia" con: umbral de viabilidad alta, umbral de viabilidad media, pesos de cohesión, acoplamiento y datos de la puntuación, umbral de evidencia, proporción de clúster grande y viabilidad mínima; con valores por defecto obtenidos del motor y rangos del contrato.
- **FR-023**: Un cambio de parámetros MUST recalcular las propuestas a partir del análisis almacenado, sin re-analizar el código, en menos de 3 segundos para los proyectos de ejemplo, e indicar que se muestran propuestas recalculadas; ante cambios sucesivos rápidos solo se muestra el resultado del último cambio.
- **FR-024**: Los errores de configuración del motor MUST mostrarse con su mensaje y MUST conservar las propuestas anteriores.
- **FR-025**: El usuario MUST poder restablecer los valores por defecto, volviendo a las propuestas originales del análisis.
- **FR-026**: El usuario MUST poder editar una propuesta (mover componentes entre propuestas) y re-evaluarla con el motor; la propuesta editada MUST mostrar viabilidad, puntuación, métricas y justificación devueltas por el motor.
- **FR-027**: Los recálculos y ediciones MUST NOT modificar los documentos almacenados del análisis.

**Hallazgos (US6)**

- **FR-028**: El paso Hallazgos MUST ofrecer las pestañas Problemas de código, Secretos, Contratos y Puntos de entrada, mostrando solo las que tienen contenido.
- **FR-029**: Los problemas de código MUST poder agruparse por severidad o por patrón y filtrarse por severidad, con totales por grupo.
- **FR-030**: La pestaña Contratos MUST mostrar cada endpoint con método, ruta, componente propietario, parámetros y esquemas de petición y respuesta cuando existan.
- **FR-031**: El detalle de una propuesta MUST mostrar su punto de entrada legacy, señales (clústeres, tamaño medio, total), tablas con su origen, métricas y justificación.
- **FR-032**: El detalle de un componente MUST mostrar capa, dominio, llamadas salientes y entrantes, tablas, métricas disponibles (acoplamiento, cohesión, complejidad) y hallazgos, omitiendo atributos sin valor.

**Plan y exportación (US7)**

- **FR-033**: El paso Plan MUST ordenar las propuestas por viabilidad (Alta, Media, Baja) y, a igual viabilidad, por menor acoplamiento externo y luego por nombre, agrupadas en etapas, cada una con acciones recomendadas y riesgos.
- **FR-034**: El sistema MUST exportar el plan como JSON (arquitectura vigente con ediciones y recálculos más los parámetros usados), Markdown y PDF (vista imprimible del mismo contenido).
- **FR-035**: Para el mismo análisis, parámetros y ediciones, la exportación Markdown MUST ser idéntica byte a byte.

**Historial y comparación (US8)**

- **FR-036**: El servidor MUST listar los análisis de su almacén con identificador, origen, proyecto, tecnología solicitada, estado, fechas y totales, del más reciente al más antiguo, sin rutas absolutas del servidor.
- **FR-037**: El usuario MUST poder abrir un análisis completado del historial, que pasa a ser el activo.
- **FR-038**: El usuario MUST poder comparar dos análisis completados: componentes, líneas de código, dependencias, propuestas por viabilidad, hallazgos por severidad, sus diferencias y los componentes presentes solo en uno de ellos.

**IA (US9)**

- **FR-039**: La documentación IA MUST usar una plantilla según el perfil tecnológico: Spring/Java EE (Java), ASP.NET Core (.NET C#) o escritorio VB (VB.NET; en mixto, la de VB).
- **FR-040**: El proveedor del modelo MUST configurarse en el servidor con `LLM_PROVIDER` (valores `gemini`, `anthropic`; por defecto `gemini`); un valor inválido MUST producir un error que nombre los valores permitidos; una credencial ausente MUST informarse sin revelar secretos.

**Tipos y API (US10, transversal)**

- **FR-041**: La generación de tipos del contrato MUST cubrir además la configuración de inferencia y las respuestas de re-inferencia y puntuación (once tipos de entrada en total).
- **FR-042**: La interfaz MUST NOT declarar a mano tipos de datos del contrato; las respuestas del motor que muestra MUST validarse con los validadores generados.
- **FR-043**: Las nuevas operaciones del servidor (historial, valores por defecto de inferencia, re-inferencia, puntuación) MUST aplicar el mismo token de API, redacción de rutas y formato de error que las de 007.

### Key Entities

- **Perfil tecnológico**: tecnología (Java, .NET C#, VB.NET, .NET mixto), lenguajes presentes, origen del análisis, fidelidad reducida, color de acento.
- **Sección de resultados**: identificador, paso al que pertenece, tecnologías a las que aplica, elementos; visible si aplica y tiene elementos.
- **Escenario de inferencia**: parámetros modificados respecto de los valores por defecto, viabilidad mínima, arquitectura recalculada; no se almacena en el análisis.
- **Propuesta editada**: propuesta con componentes cambiados por el usuario y su puntuación del motor.
- **Plan de modernización**: etapas ordenadas de propuestas con acciones y riesgos; exportable.
- **Entrada de historial**: vista pública de un análisis del almacén.
- **Comparación**: par de análisis completados con sus totales y diferencias.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En los análisis de los proyectos de ejemplo .NET C# y VB.NET, la página contiene 0 secciones exclusivas de Java; en el de Java, 0 secciones exclusivas de .NET.
- **SC-002**: En los análisis de los tres proyectos de ejemplo, 0 secciones visibles tienen cero elementos.
- **SC-003**: El flujo completo (subir, ver los cinco pasos, ajustar un parámetro, exportar) funciona para Java, C# y VB sin tocar código, verificado de punta a punta en navegador.
- **SC-004**: Un cambio de parámetro de inferencia muestra propuestas recalculadas en menos de 3 segundos en los proyectos de ejemplo, sin re-analizar el código.
- **SC-005**: 100 % de los datos del contrato mostrados por la interfaz usan tipos generados; 0 declaraciones manuales de tipos del contrato en la interfaz.
- **SC-006**: Los escenarios bloqueados de 001–009 siguen pasando (salvo la regeneración aprobada del escenario de tipos generados de 005).
- **SC-007**: Las páginas de los cinco pasos no presentan violaciones de contraste de texto (AA) en modo claro y oscuro en las capturas revisadas por el usuario.

## Clarifications

### Session 2026-10-09 (decisiones del usuario)

- Q: ¿Arquitectura de información? -> A: Flujo de modernización: (1) Resumen ejecutivo (salud, riesgos, deuda técnica, insignia de tecnología, advertencias incluida la fidelidad reducida) → (2) Mapa del sistema (color/filtro por tipo de dependencia, grosor por peso, agrupación por capa o propuesta, filtro por severidad) → (3) Propuestas con viabilidad + panel "Parámetros de inferencia" con re-inferencia en vivo y re-puntuación de propuestas editadas → (4) Hallazgos (problemas por severidad/patrón, secretos, contratos, puntos de entrada legacy, señales/clústeres/llamadas entrantes/dominio) → (5) Plan de modernización exportable (JSON editado, Markdown, PDF). Secciones específicas de tecnología solo donde tienen sentido (EJB/@Deprecated solo Java; inyección y endpoints ASP.NET para C#; formularios, módulos, ADO.NET y app.config para VB). [US1, US2, US4, US5, US6, US7]
- Q: ¿Aspecto? -> A: Herramienta técnica sobria (estilo Linear/Grafana): densa pero legible, modo claro/oscuro, colores de acento por tecnología, insignias de severidad, accesible, estados de carga reales con las fases de 007; se mantiene la pila de componentes actual. [US3]
- Q: ¿LLM? -> A: Gemini por defecto, abstracción de proveedor `LLM_PROVIDER=gemini|anthropic` (Anthropic opcional, modelo por defecto según la guía vigente), plantillas especializadas por tecnología elegidas por el origen/lenguaje. [US9]
- Q: ¿Ampliar el registro de tipos generados de 005 (TS-028 fija 8 tipos)? -> A: ~~Aprobado como parte de 010: re-testify de 005 TS-028 para cubrir los tres esquemas añadidos en 008.~~ Sustituida por la decisión de 2026-10-09 (opción B), abajo. [US10]
- Q (2026-10-09, decisión del usuario, opción B): ¿Cómo se cubren los tres esquemas de 008 sin tocar los artefactos bloqueados de 001–009? -> A: No se modifica nada de 005 (escenarios, `context.json`, spec ni pasos; el registro generado original conserva exactamente sus 8 tipos). Los tipos y validadores de la configuración de inferencia y de las respuestas `reinfer_architecture` y `score_proposal` se generan con la misma cadena de generación en un módulo de extensión separado del paquete del contrato, con su propio registro de validadores y sus propias funciones de análisis; la verificación de deriva del contrato cubre también ese módulo y la web importa esos tipos desde él. [US10, FR-041]
- Q: ¿Alcance adicional? -> A: Reemplazo del estado local por el almacén de análisis del servidor, historial y comparación de dos análisis, tipos generados para todo lo mostrado. [US8, US10]

### Defaults elegidos por el agente (confirmados por el usuario 2026-10-09)

- Exportación PDF mediante una vista imprimible del navegador ("Guardar como PDF"), sin nueva dependencia (principio VI). (default elegido por agente — confirmado por usuario 2026-10-09) [FR-034]
- Los recálculos y propuestas editadas viven en la sesión de la página (no se persisten en el almacén); se conservan en la exportación JSON. (default elegido por agente — confirmado por usuario 2026-10-09) [FR-027]
- Parámetros del panel: los siete de FR-022 más viabilidad mínima; el resto de parámetros de 008 queda accesible solo por archivo de configuración. (default elegido por agente — confirmado por usuario 2026-10-09) [FR-022]
- Preferencia de tema guardada en el almacenamiento local del navegador (valor de pocos caracteres, compatible con FR-012 y con TS-015 de 007). (default elegido por agente — confirmado por usuario 2026-10-09) [FR-013]
- Comparación limitada a dos análisis completados; sin persistir la comparación. (default elegido por agente — confirmado por usuario 2026-10-09) [FR-038]
- Etapas del plan: Etapa 1 = viabilidad Alta, Etapa 2 = Media, Etapa 3 = Baja (re-diseñar antes de extraer); las librerías de soporte se listan como "base compartida". (default elegido por agente — confirmado por usuario 2026-10-09) [FR-033]
- Perfil mixto C# + VB: se aplican las secciones de ambos lenguajes y la plantilla IA de escritorio VB. (default elegido por agente — confirmado por usuario 2026-10-09) [FR-001a, FR-039]

## Assumptions

- Las herramientas `reinfer_architecture` y `score_proposal` del motor están habilitadas en el proceso del motor de la web (008: la web las activa) y el almacén de análisis conserva el grafo de cada análisis completado, incluidos los importados.
- El motor no cambia en esta feature; si un cambio resultara necesario, seguirá las reglas de calidad del motor (estilo, análisis estático, determinismo).
- Los proyectos de ejemplo de referencia son `java-standar`, `dotnet-ecommerce` y el proyecto VB sintético de escritorio del repositorio.
- La interfaz está en español, como la actual.
