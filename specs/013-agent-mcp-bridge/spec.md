# Feature Specification: Puente MCP para agentes — enviar un proyecto y recibir el análisis desde Claude Code, e identidad visual

**Feature Branch**: `013-agent-mcp-bridge`
**Created**: 2026-10-23
**Status**: Draft
**Input**: User description: "Requiero una solución que sea capaz de utilizar esto como MCP, y que desde por ejemplo Claude Code sea capaz de enviar y recibir el análisis. Además mejorar algo clave: generar un margen arriba (del encabezado de la app) y requiero un ícono."

## Contexto

dev-arch (features 006–012) analiza proyectos Java y .NET desde la web: se sube un ZIP, el motor analiza en segundo plano y la web muestra un recorrido de cinco pasos (Resumen, Mapa del sistema, Propuestas, Hallazgos, Plan) con parámetros de inferencia ajustables e historial. El motor ya expone herramientas MCP por entrada/salida estándar, pero solo para quien lo ejecuta en la misma máquina apuntando a una ruta local: no conoce el historial de la web, no entrega el recorrido de modernización (resumen, propuestas ordenadas, hallazgos agrupados, plan por etapas) y no sirve cuando dev-arch corre en un contenedor o en otra máquina.

El usuario quiere que un agente de programación (por ejemplo Claude Code) use dev-arch como servidor MCP: que el agente **envíe** el proyecto en el que está trabajando, espere el análisis y **reciba** los resultados en un formato que pueda razonar, y que ese mismo análisis quede visible en la web para revisarlo con la interfaz gráfica. Además pide dos mejoras visuales clave: espacio sobre el encabezado de la aplicación (hoy queda pegado al borde superior) y un ícono de producto.

La Constitución vigente (v1.0.0) obliga a: no romper salidas ni contratos (I), lógica de análisis única con puntos de entrada delgados (II), TDD con aserciones inmutables (III), determinismo (IV), errores claros y degradación elegante (V) y huella mínima (VI). La regla aditiva del usuario (2026-10-09) sigue vigente: no se modifica ningún `.feature`, `context.json`, especificación, definición de pasos ni prueba existente de las features 001–012, y no se relaja ninguna puerta de calidad.

## User Stories *(mandatory)*

### User Story 1 — Enviar el proyecto local desde el agente y recibir el análisis (Priority: P1)

Como persona que trabaja con un agente de programación, quiero pedirle "analiza este proyecto con dev-arch" y que el agente envíe la carpeta del proyecto a dev-arch (local, en contenedor o en otra máquina), espere a que termine y me devuelva el resumen del análisis con un enlace para abrirlo en la web, para decidir qué modernizar sin salir de mi flujo con el agente.

**Why this priority**: Es el pedido central: sin envío y recepción desde el agente no hay integración.

**Independent Test**: Con dev-arch corriendo en un contenedor (que no ve el disco del usuario), registrar dev-arch como servidor MCP en el agente y pedir el análisis de la carpeta del proyecto de demostración Java: el agente recibe un resultado con la tecnología, los totales de componentes, propuestas y hallazgos, el identificador del análisis y un enlace; al abrir el enlace la web muestra ese análisis y aparece en el historial.

**Acceptance Scenarios**:

1. **Given** dev-arch en ejecución y registrado en el agente, **When** el agente pide analizar una carpeta local existente, **Then** el proyecto se envía a dev-arch, el análisis se ejecuta con el mismo motor que la web y el agente recibe el resumen, el identificador del análisis y el enlace a la web
2. **Given** dev-arch en un contenedor o en otra máquina sin acceso al disco del usuario, **When** el agente pide analizar una carpeta local, **Then** el análisis funciona igual que con dev-arch local
3. **Given** un análisis enviado por el agente, **When** se abre la web, **Then** el análisis aparece en el historial y el enlace recibido abre su recorrido
4. **Given** una carpeta con directorios de dependencias, compilación o control de versiones, **When** se envía, **Then** esos directorios no se envían y el resultado del análisis es el mismo que al subir un ZIP del código fuente
5. **Given** un análisis que tarda más que la espera máxima del agente, **When** se agota la espera, **Then** el agente recibe el identificador y el estado actual (en cola o en ejecución) y puede consultar después sin reenviar el proyecto
6. **Given** una ruta inexistente, que no es una carpeta, o un proyecto que excede el tamaño máximo de carga, **When** el agente pide el análisis, **Then** recibe un error que dice qué falló y cómo resolverlo y no se crea ningún análisis
7. **Given** un análisis que falla en el motor, **When** el agente lo espera, **Then** recibe el estado fallido con el motivo y las advertencias, no un resultado vacío

---

### User Story 2 — Consultar el análisis por partes y el historial (Priority: P1)

Como agente, quiero pedir por separado el resumen, las propuestas, los hallazgos, el plan de modernización y los documentos completos de un análisis, y listar los análisis existentes, para traer solo lo que necesito al contexto y razonar sobre resultados ya calculados.

**Why this priority**: Los resultados completos son grandes; sin consulta por partes el agente no puede usarlos.

**Independent Test**: Sobre un análisis completado, pedir cada parte: el contenido coincide con lo que la web muestra en el paso correspondiente con los parámetros por defecto; pedir el historial devuelve los mismos análisis que el panel de historial de la web.

**Acceptance Scenarios**:

1. **Given** un análisis completado, **When** el agente pide el resumen, **Then** recibe la tecnología, los totales (componentes, propuestas, hallazgos por severidad, tablas, contratos) y los puntos de riesgo principales que la web muestra en el paso Resumen
2. **Given** un análisis completado, **When** el agente pide las propuestas, **Then** las recibe en el mismo orden y con la misma viabilidad, cohesión, acoplamiento, tablas y componentes que el paso Propuestas
3. **Given** un análisis completado, **When** el agente pide los hallazgos con una severidad mínima opcional, **Then** recibe los hallazgos agrupados como en el paso Hallazgos, filtrados por esa severidad
4. **Given** un análisis completado, **When** el agente pide el plan, **Then** recibe el plan de modernización por etapas en texto legible y estructurado, igual al que la web exporta
5. **Given** un análisis completado, **When** el agente pide un documento completo (grafo, arquitectura o contratos), **Then** lo recibe igual que lo entrega la API de la web, con las rutas relativizadas al proyecto
6. **Given** los análisis del servidor, **When** el agente pide el historial, **Then** recibe la lista del más reciente al más antiguo con identificador, nombre, tecnología, estado y enlace
7. **Given** un identificador inexistente, o un análisis aún en ejecución o fallido, **When** el agente pide una parte, **Then** recibe un error específico (no encontrado, no listo con su fase, fallido con su motivo)
8. **Given** el mismo análisis y los mismos parámetros, **When** el agente pide la misma parte dos veces, **Then** las dos respuestas son idénticas

---

### User Story 3 — Recalcular propuestas con otros parámetros desde el agente (Priority: P2)

Como agente, quiero recalcular las propuestas de un análisis con parámetros de inferencia distintos (umbrales de viabilidad, pesos, umbral de fusión) sin reenviar ni reanalizar el código, y conocer los parámetros disponibles con sus valores por defecto y rangos, para explorar alternativas de descomposición en la conversación.

**Why this priority**: Aprovecha la inferencia configurable (008) desde el agente; útil pero no imprescindible para el primer uso.

**Independent Test**: Pedir los parámetros disponibles; recalcular un análisis con un umbral de viabilidad alta distinto: el agente recibe propuestas que coinciden con las que la web muestra con los mismos valores en el panel de parámetros.

**Acceptance Scenarios**:

1. **Given** dev-arch, **When** el agente pide los parámetros de inferencia, **Then** recibe cada parámetro con su nombre, descripción, valor por defecto y rango, los mismos del panel de la web
2. **Given** un análisis completado, **When** el agente recalcula con valores válidos, **Then** recibe las propuestas recalculadas y la puntuación de calidad sin que se vuelva a analizar el código
3. **Given** valores fuera de rango o un parámetro desconocido, **When** el agente recalcula, **Then** recibe un error que nombra el parámetro y el rango permitido

---

### User Story 4 — Conectar el agente a dev-arch en un paso y de forma segura (Priority: P2)

Como persona que instala dev-arch, quiero registrar dev-arch en mi agente con un solo comando documentado, tanto para una instancia local como para una remota con token, y que el diagnóstico me diga si la conexión funciona, para no depurar configuraciones a mano.

**Why this priority**: Sin una conexión sencilla y protegida la funcionalidad no se adopta, pero depende de las historias 1 y 2.

**Independent Test**: Seguir la guía para registrar dev-arch en Claude Code contra el contenedor local: el agente lista las herramientas de dev-arch; con una instancia que exige token y sin token configurado, la conexión falla con un mensaje que indica configurar el token.

**Acceptance Scenarios**:

1. **Given** la guía de instalación, **When** se siguen los pasos de conexión del agente, **Then** hay un comando para registrar dev-arch en Claude Code apuntando a una instancia local y otro a una instancia remota con token
2. **Given** una instancia con token de API configurado, **When** el agente se conecta sin token o con uno incorrecto, **Then** cada herramienta responde con un error de autorización claro y no expone datos
3. **Given** una instancia sin token configurado, **When** el agente se conecta desde la misma máquina, **Then** funciona sin configuración adicional, igual que la web
4. **Given** dev-arch apagado o inalcanzable, **When** el agente invoca cualquier herramienta, **Then** recibe un error que dice a qué dirección intentó conectarse y cómo arrancar dev-arch
5. **Given** el diagnóstico del producto, **When** se ejecuta con dev-arch en marcha, **Then** informa si el punto de conexión para agentes responde

---

### User Story 5 — Encabezado con espacio superior e ícono de producto (Priority: P3)

Como persona que usa la web, quiero que el encabezado tenga aire respecto del borde superior y que dev-arch tenga un ícono reconocible en el encabezado y en la pestaña del navegador, para que la aplicación se vea terminada y se identifique entre pestañas.

**Why this priority**: Pulido visual pedido explícitamente por el usuario; no bloquea el uso.

**Independent Test**: Abrir la web en claro y oscuro, en escritorio y en ancho de teléfono: el encabezado muestra el ícono junto al nombre, hay espacio visible entre el borde superior de la ventana y el contenido del encabezado, y la pestaña del navegador muestra el ícono de dev-arch.

**Acceptance Scenarios**:

1. **Given** cualquier página de la web, **When** se carga, **Then** el contenido del encabezado no queda pegado al borde superior de la ventana y el espacio se mantiene al desplazarse
2. **Given** el encabezado, **When** se muestra, **Then** aparece el ícono de dev-arch a la izquierda del nombre, legible en tema claro y oscuro
3. **Given** el navegador, **When** se abre la web, **Then** la pestaña muestra el ícono de dev-arch en lugar del ícono genérico
4. **Given** el reporte imprimible, **When** se imprime, **Then** el encabezado sigue oculto como hoy

---

### Edge Cases

- Proyecto con enlaces simbólicos que apuntan fuera de la carpeta: no se siguen ni se envía su contenido.
- Carpeta vacía o sin código Java ni .NET reconocible: el análisis termina con el error de detección de lenguaje existente, y el agente recibe ese motivo.
- Proyecto con Java y .NET a la vez: el agente puede indicar el lenguaje; si no lo indica se aplica la detección existente (ambiguo → error que pide indicarlo).
- Dos agentes envían análisis a la vez: cada uno recibe su propio identificador; la concurrencia sigue las reglas de cola existentes.
- Parte pedida de un análisis importado (no ejecutado por el motor): se responde igual que la web para análisis importados.
- Respuestas muy grandes (documentos completos de proyectos grandes): el agente recibe el documento completo o un error claro si supera el límite de respuesta, nunca un documento truncado sin aviso.
- La web y el agente usan el mismo análisis a la vez (por ejemplo el usuario cambia parámetros en la web): las consultas del agente con parámetros por defecto no cambian.

## Requirements *(mandatory)*

### Functional Requirements

**Envío y recepción (US1)**

- **FR-001**: dev-arch MUST ofrecer a los agentes un servidor MCP con herramientas para enviar un proyecto, esperar su análisis y consultar los resultados.
- **FR-002**: El agente MUST poder enviar una carpeta local del usuario aunque dev-arch se ejecute en un contenedor o en otra máquina sin acceso a ese disco.
- **FR-003**: El envío MUST excluir directorios de control de versiones, dependencias y salidas de compilación de Java, .NET y Node, y no seguir enlaces simbólicos fuera de la carpeta.
- **FR-004**: El envío MUST respetar el tamaño máximo de carga y las protecciones de la carga de ZIP de la web (rutas, cantidad de archivos, descompresión), con los mismos códigos de error.
- **FR-005**: Los análisis enviados por el agente MUST ejecutarse con el mismo motor, cola y almacenamiento que los de la web, y aparecer en el historial de la web.
- **FR-006**: La herramienta de envío MUST esperar el resultado hasta un máximo configurable por llamada y devolver, si termina, el resumen del análisis, su identificador y su enlace a la web; si no termina, el identificador, el estado y la fase.
- **FR-007**: El agente MUST poder consultar el estado de un análisis por su identificador sin reenviar el proyecto.
- **FR-008**: El agente MUST poder indicar el lenguaje (java, dotnet, auto) como en la web.

**Consulta por partes (US2)**

- **FR-009**: El agente MUST poder obtener por separado: resumen, propuestas, hallazgos (con severidad mínima opcional), plan de modernización y cada documento completo (grafo, arquitectura, contratos).
- **FR-010**: El resumen, las propuestas, los hallazgos y el plan MUST calcularse con la misma lógica que usa la web para sus pasos, sin una segunda implementación.
- **FR-011**: El agente MUST poder listar el historial con identificador, nombre, tecnología, estado, fecha y enlace, en el mismo orden que la web.
- **FR-012**: Cada respuesta MUST ser contenido estructurado válido con un esquema documentado; el plan MUST incluir además su versión en texto legible.
- **FR-013**: Para el mismo análisis y los mismos parámetros, las respuestas MUST ser idénticas byte a byte.
- **FR-014**: Los errores MUST distinguir: no encontrado, no listo (con estado y fase), fallido (con motivo), entrada inválida, no autorizado y servidor inalcanzable, con un mensaje accionable en el formato de error del protocolo.

**Re-inferencia (US3)**

- **FR-015**: El agente MUST poder obtener los parámetros de inferencia con descripción, valor por defecto y rango, los mismos del panel de la web.
- **FR-016**: El agente MUST poder recalcular propuestas y su puntuación con parámetros dados sin reanalizar el código, con el mismo resultado que la web para los mismos valores.
- **FR-017**: Los parámetros inválidos MUST rechazarse nombrando el parámetro y su rango.

**Conexión (US4)**

- **FR-018**: dev-arch MUST poder registrarse en Claude Code con un comando documentado para instancia local y para instancia remota.
- **FR-019**: Cuando la instancia tiene token de API configurado, el servidor MCP MUST exigirlo igual que la API de la web; sin token configurado MUST funcionar como la web hoy.
- **FR-020**: El diagnóstico del producto MUST informar, cuando la web está en marcha, si el punto de conexión para agentes responde.
- **FR-021**: La guía de instalación MUST documentar la conexión de agentes, las herramientas disponibles y sus límites.
- **FR-022**: Las herramientas MCP del motor (001–008) MUST seguir existiendo sin cambios de nombre, entradas ni salidas.

**Identidad visual (US5)**

- **FR-023**: El encabezado de la web MUST tener espacio superior visible respecto del borde de la ventana, en escritorio y en ancho de teléfono, sin desplazar horizontalmente la página.
- **FR-024**: dev-arch MUST tener un ícono de producto mostrado en el encabezado junto al nombre y como ícono de la pestaña del navegador, legible en tema claro y oscuro.
- **FR-025**: El reporte imprimible MUST seguir ocultando el encabezado.

### Key Entities

- **Envío de proyecto**: carpeta local del usuario empaquetada sin dependencias ni salidas de compilación, con lenguaje opcional; produce un análisis.
- **Análisis**: el mismo objeto del historial de la web (identificador, nombre, tecnología, estado, fase, documentos, advertencias), ahora también accesible desde el agente.
- **Parte del análisis**: vista calculada del análisis — resumen, propuestas, hallazgos, plan — o documento completo.
- **Parámetros de inferencia**: los de 008, con valor por defecto y rango.
- **Conexión de agente**: dirección de dev-arch y token opcional configurados en el agente.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Desde Claude Code, con dev-arch en un contenedor, una persona registra dev-arch y obtiene el resumen del análisis del proyecto de demostración Java siguiendo solo la guía, en menos de 5 minutos tras tener el contenedor en marcha.
- **SC-002**: Para los proyectos de demostración Java y .NET, el resumen, las propuestas, los hallazgos y el plan que recibe el agente coinciden en el 100 % de los campos con lo que muestra la web para el mismo análisis.
- **SC-003**: Un análisis enviado por el agente aparece en el historial de la web y su enlace abre su recorrido en el 100 % de los casos de prueba.
- **SC-004**: Dos consultas iguales sobre el mismo análisis devuelven respuestas idénticas en el 100 % de las repeticiones.
- **SC-005**: Ninguna herramienta MCP del motor ni ninguna prueba de las features 001–012 cambia, y todas las puertas de calidad siguen en verde.
- **SC-006**: Con token configurado, el 100 % de las llamadas sin token válido son rechazadas sin revelar datos de análisis.
- **SC-007**: En las capturas de la web en claro y oscuro, escritorio y teléfono, el encabezado muestra el ícono y espacio superior, y la pestaña muestra el ícono de dev-arch.

## Clarifications

### Session 2026-10-23 (decisiones del usuario)

- El usuario pide "una solución capaz de utilizar esto como MCP" para que "desde Claude Code sea capaz de enviar y recibir el análisis", más "un margen arriba" del encabezado y "un ícono". Indicó además continuar con el resto de pendientes (push, PR, despliegue, Fase 7).

### Defaults elegidos por el agente

- "Enviar" significa enviar la carpeta del proyecto en el que trabaja el agente (no un JSON de análisis ya calculado); la importación de JSON sigue disponible en la web (010).
- El análisis enviado por el agente es un análisis normal del historial: no hay un historial separado para agentes.
- Espera máxima por defecto de la herramienta de envío: 5 minutos, configurable por llamada.
- El ícono es una marca geométrica propia de dev-arch (sin logotipos de terceros).

## Assumptions

- Claude Code admite servidores MCP por entrada/salida estándar y por HTTP; es el agente de referencia de la guía.
- La persona puede ejecutar en su máquina el componente local que empaqueta y envía la carpeta cuando dev-arch está en un contenedor o remoto, con los requisitos que defina el plan; la imagen de contenedor no cambia de requisitos.
- Los límites de tamaño de carga de la web (007) son adecuados para los proyectos que se envían desde el agente.
