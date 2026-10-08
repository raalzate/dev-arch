# Feature Specification: Integración runtime nativa del motor en dev-arch

**Feature Branch**: `007-native-engine-runtime`
**Created**: 2026-10-08
**Status**: Draft
**Input**: User description: "Fase 3 de PLAN-INTEGRACION-DEV-ARCH.md — Integración runtime nativa: la web dev-arch deja de ejecutar el motor como un comando que escribe archivos con nombres fijos en su directorio de trabajo y pasa a usarlo como un servicio de análisis embebido y de larga vida (el mismo modo servidor que usan los agentes de IA), con análisis asíncronos identificados, persistidos en disco y aislados entre sí; carga de proyectos segura (límite de tamaño configurable, protección contra rutas que escapan del área de extracción, cuota de análisis concurrentes, caducidad y limpieza); visor de código fuente restringido al proyecto de cada análisis; importación directa de resultados existentes validada contra el contrato de datos; y cambios mínimos del motor (progreso por fases, elección explícita de lenguaje para proyectos ambiguos, reutilización de análisis de proyectos sin cambios y advertencias expuestas) sin romper la paridad entre modos ni el determinismo. Criterio de salida: dos análisis concurrentes desde la interfaz no interfieren; recargar o cerrar el navegador no pierde el análisis; prueba extremo a extremo en navegador 'subir ZIP Java → ver propuestas' y 'subir ZIP .NET → ver propuestas'."

## Contexto

Tras la feature 006 la web y el motor viven en el mismo producto y la web analiza con el motor construido localmente, pero el flujo heredado tiene defectos conocidos (sección 1.2 del plan de integración):

- Cada análisis lanza el motor como un comando aislado y **lee los resultados con nombres fijos desde el directorio de trabajo del servidor**: dos análisis simultáneos se pisan (defecto 2).
- La petición de análisis **bloquea** hasta que el motor termina (minutos en proyectos grandes); si el navegador se recarga o se cierra, el resultado se pierde, porque solo vive en el almacenamiento del navegador.
- El visor de código **lee cualquier archivo del servidor** a partir de una ruta arbitraria (defecto 3).
- La carga del ZIP **no tiene límite de tamaño ni protección** contra entradas que escriben fuera del área de extracción (defecto 4).
- **No existe importación** de resultados ya producidos, aunque el documento de diseño de la web la prevé (defecto 6).
- El motor ya ofrece un modo servidor de herramientas (usado por agentes de IA) con paridad probada respecto del modo línea de comandos, pero no informa progreso, no permite resolver proyectos ambiguos (Java y .NET a la vez), repite el análisis completo en cada consulta y no expone las advertencias que recolecta.

Esta feature cierra esos defectos. La Constitución vigente (v1.0.0) gobierna el motor: sus cambios deben preservar la compatibilidad del modo línea de comandos y del modo servidor (principio I), mantener la lógica en el núcleo compartido (principio II), seguir TDD (principio III), conservar el determinismo byte a byte (principio IV), degradar con advertencias claras (principio V) y justificar cualquier dependencia nueva (principio VI). En la web se respetan también TDD y huella mínima (nota de alcance de `AGENTS.md`).

## User Stories *(mandatory)*

### User Story 1 — Analizar un proyecto sin esperar con la petición abierta (Priority: P1)

Como usuario de dev-arch, subo el ZIP de un proyecto Java o .NET y la aplicación me confirma de inmediato que el análisis quedó registrado, me muestra en qué fase va (detección, extracción, inferencia, escritura) y, al terminar, me muestra componentes y propuestas de microservicios.

**Why this priority**: Es el flujo principal del producto y el núcleo del criterio de salida ("subir ZIP → ver propuestas"). Sin él, los análisis largos bloquean la interfaz y fallan por tiempo.

**Independent Test**: Subir el ZIP del proyecto de demostración Java y, por separado, el del proyecto de demostración .NET desde la interfaz; comprobar que el registro es inmediato, que se ven las fases y que al final aparecen componentes y propuestas.

**Acceptance Scenarios**:

1. **Given** el producto construido y la web en marcha, **When** el usuario sube el ZIP del proyecto de demostración Java, **Then** recibe de inmediato un identificador de análisis y la interfaz muestra el análisis "en cola" o "en ejecución".
2. **Given** un análisis en ejecución, **When** el usuario observa la interfaz, **Then** ve la fase actual entre detección, extracción, inferencia y escritura, en ese orden y sin retrocesos.
3. **Given** un análisis terminado con éxito, **When** el usuario consulta sus resultados, **Then** obtiene por separado el grafo de dependencias, la arquitectura propuesta y los contratos de API, con versión de contrato 1.0.0, y la interfaz muestra al menos un componente y al menos una propuesta.
4. **Given** el producto construido con el analizador .NET, **When** el usuario sube el ZIP del proyecto de demostración .NET, **Then** el análisis termina con éxito y la interfaz muestra componentes de origen .NET y al menos una propuesta.
5. **Given** un análisis todavía en ejecución, **When** se consultan sus resultados, **Then** la respuesta indica que aún no están disponibles (no un error del servidor).
6. **Given** un identificador de análisis que no existe, **When** se consulta su estado o sus resultados, **Then** la respuesta indica que el análisis no existe.
7. **Given** un proyecto que contiene a la vez marcadores Java y .NET, **When** el usuario lo analiza sin elegir lenguaje, **Then** el análisis falla con un mensaje que indica que el proyecto es ambiguo y que debe elegir el lenguaje; **When** lo analiza eligiendo "java" o "dotnet", **Then** el análisis termina con éxito con el analizador elegido.
8. **Given** el motor no está construido, **When** el usuario envía un análisis, **Then** el envío se rechaza con un mensaje que contiene "Engine not built", la ruta buscada y el comando de construcción.

---

### User Story 2 — Análisis concurrentes aislados que sobreviven a la recarga (Priority: P1)

Como usuario (o como dos usuarios en pestañas distintas), lanzo varios análisis a la vez y cada uno obtiene exactamente sus propios resultados; si recargo o cierro el navegador, al volver encuentro el análisis donde lo dejé.

**Why this priority**: Es literalmente el criterio de salida de la fase y corrige el defecto 2 (resultados que se pisan), que hoy produce resultados incorrectos sin aviso — peor que un error.

**Independent Test**: Lanzar en paralelo el análisis del ZIP Java y el del ZIP .NET desde dos sesiones de navegador; recargar una de ellas durante el análisis; comprobar que cada sesión muestra solo los resultados de su proyecto.

**Acceptance Scenarios**:

1. **Given** dos análisis de proyectos distintos enviados al mismo tiempo, **When** ambos terminan, **Then** los resultados de cada uno corresponden solo a su proyecto (ningún componente de uno aparece en el otro).
2. **Given** un análisis en ejecución, **When** el usuario recarga el navegador, **Then** la interfaz retoma el mismo análisis (mismo identificador) y muestra su progreso o su resultado sin volver a subir el ZIP.
3. **Given** un análisis terminado, **When** el usuario cierra el navegador y lo abre de nuevo, **Then** puede volver a ver los resultados de ese análisis mientras no haya caducado.
4. **Given** análisis terminados y el servidor web se reinicia, **When** se consultan, **Then** su estado y resultados siguen disponibles.
5. **Given** un análisis en ejecución y el servidor web se reinicia, **When** se consulta tras el reinicio, **Then** aparece como fallido con el motivo "interrumpido" y no queda en ejecución indefinidamente.
6. **Given** cualquier análisis, **When** se ejecuta, **Then** no se crea ni se lee ningún archivo de resultados con nombre fijo en el directorio de trabajo del servidor.
7. **Given** dos análisis enviados sobre la misma carpeta local de proyecto (modo desarrollo), **When** se ejecutan, **Then** se procesan uno detrás de otro y ambos terminan con resultados idénticos.

---

### User Story 3 — Carga de proyectos segura y acotada (Priority: P1)

Como operador de una instancia de dev-arch, necesito que ningún ZIP subido pueda escribir fuera de su área, agotar el disco o saturar el servidor, y que los archivos temporales se limpien solos.

**Why this priority**: Corrige el defecto 4 y es prerrequisito para exponer la web fuera de la máquina del desarrollador; un ZIP malicioso hoy puede sobrescribir archivos del servidor.

**Independent Test**: Enviar ZIP de prueba con entradas que escapan del área de extracción, con rutas absolutas, con enlaces simbólicos, con tamaño mayor al límite y con tasa de compresión extrema; comprobar que todos se rechazan y que no se escribe nada fuera del área del análisis.

**Acceptance Scenarios**:

1. **Given** el límite de tamaño de carga configurado (por defecto 200 MB), **When** se sube un ZIP que lo supera, **Then** se rechaza antes de procesarlo, el mensaje indica el límite y no se conserva ningún archivo del envío.
2. **Given** un ZIP con una entrada cuya ruta escapa del área de extracción (componentes `..`, ruta absoluta o enlace simbólico), **When** se sube, **Then** todo el ZIP se rechaza indicando la entrada culpable y no se escribe ningún archivo fuera del área del análisis.
3. **Given** un ZIP cuyo contenido descomprimido supera el límite de tamaño descomprimido o el de número de entradas, **When** se sube, **Then** se rechaza indicando el límite superado.
4. **Given** un archivo que no es un ZIP válido, **When** se sube, **Then** se rechaza con un mensaje claro.
5. **Given** la cuota de análisis simultáneos alcanzada y la cola llena, **When** se envía otro análisis, **Then** se rechaza indicando que hay demasiados análisis en curso y que se reintente más tarde; **Given** la cuota alcanzada pero con cola disponible, **Then** el análisis queda "en cola" y arranca cuando se libera un turno.
6. **Given** un análisis terminado hace más tiempo que el periodo de retención configurado (por defecto 24 horas), **When** se ejecuta la limpieza periódica, **Then** se eliminan su ZIP, sus fuentes extraídas y sus resultados, y las consultas posteriores indican que no existe.
7. **Given** un envío rechazado o fallido, **When** termina, **Then** sus archivos temporales se eliminan.
8. **Given** la web fuera del modo desarrollo, **When** se pide analizar una carpeta local del servidor en lugar de un ZIP, **Then** la petición se rechaza.

---

### User Story 4 — Visor de código restringido al proyecto del análisis (Priority: P1)

Como usuario, abro el código fuente de un componente desde los resultados y lo veo; como operador, tengo la garantía de que el visor solo puede leer archivos del proyecto de ese análisis.

**Why this priority**: Corrige el defecto 3 (lectura arbitraria de archivos del servidor), una vulnerabilidad explotable hoy.

**Independent Test**: Abrir desde la interfaz el código de un componente de un análisis terminado; luego intentar leer, con el mismo mecanismo, un archivo fuera del proyecto, de otro análisis, un directorio y un archivo de extensión no permitida.

**Acceptance Scenarios**:

1. **Given** un análisis terminado, **When** el usuario abre el código de un componente desde los resultados, **Then** ve el contenido del archivo de ese componente.
2. **Given** un análisis, **When** se pide un archivo con ruta absoluta, con componentes que salen de la raíz del proyecto o a través de un enlace simbólico que apunta fuera de ella, **Then** la petición se rechaza sin revelar contenido ni existencia del archivo.
3. **Given** dos análisis, **When** se pide desde uno un archivo que solo existe en el otro, **Then** la petición se rechaza.
4. **Given** un análisis, **When** se pide un archivo de extensión fuera de la lista permitida, un directorio, un archivo inexistente o un archivo mayor que el límite de visualización, **Then** la petición se rechaza con un motivo claro.
5. **Given** un análisis importado (sin fuentes), **When** se pide un archivo, **Then** la respuesta indica que el análisis no tiene código fuente disponible.

---

### User Story 5 — Importar resultados existentes validados (Priority: P2)

Como usuario que ya tiene resultados generados por el motor (línea de comandos o agente de IA), los importo en dev-arch para explorarlos sin volver a analizar; si los archivos no cumplen el contrato, se me dice exactamente qué falla.

**Why this priority**: Cumple el documento de diseño de la web (defecto 6) y desacopla la exploración del análisis, pero el flujo principal (US1) no depende de ella.

**Independent Test**: Importar los resultados válidos de los proyectos de demostración del contrato y luego archivos con violaciones conocidas del contrato.

**Acceptance Scenarios**:

1. **Given** el grafo de dependencias y la arquitectura de un análisis previo (y opcionalmente los contratos de API), **When** el usuario los importa, **Then** se crea un análisis de origen "importado", consultable como cualquier otro, y la interfaz muestra sus componentes y propuestas.
2. **Given** un archivo que viola el contrato de datos, **When** se importa, **Then** se rechaza listando cada violación con la ubicación del campo y el motivo, y no se crea ningún análisis.
3. **Given** un archivo que declara una versión de contrato distinta de la soportada, **When** se importa, **Then** se rechaza indicando la versión encontrada y la soportada.
4. **Given** una importación sin grafo de dependencias o sin arquitectura, **When** se envía, **Then** se rechaza indicando el documento faltante.
5. **Given** un análisis importado, **When** pasa el periodo de retención, **Then** se elimina igual que un análisis normal.

---

### User Story 6 — El motor informa progreso y advertencias, permite elegir lenguaje y reutiliza análisis (Priority: P2)

Como consumidor del motor (la web, un agente de IA o un usuario de línea de comandos), recibo el progreso por fases, las advertencias del análisis (archivos no analizados, proyectos .NET analizados en modo degradado) y puedo forzar el lenguaje de proyectos ambiguos; las consultas repetidas sobre un proyecto sin cambios no repiten el análisis; nada de esto cambia los resultados.

**Why this priority**: Habilita US1 (fases, ambigüedad) y la transparencia del principio V, pero la integración básica podría funcionar sin progreso ni reutilización.

**Independent Test**: Invocar el análisis completo del motor en modo servidor solicitando progreso sobre los proyectos de demostración; comparar resultados con y sin progreso, con y sin reutilización, y entre modo servidor y línea de comandos.

**Acceptance Scenarios**:

1. **Given** un cliente del modo servidor que solicita progreso, **When** pide un análisis completo, **Then** recibe avisos de progreso para las fases detección, extracción, inferencia y escritura, en ese orden, antes de la respuesta final.
2. **Given** un cliente que no solicita progreso, **When** pide un análisis completo, **Then** no recibe avisos de progreso y la respuesta es idéntica a la actual.
3. **Given** un proyecto ambiguo, **When** se pide el análisis eligiendo lenguaje en el modo servidor o en la línea de comandos, **Then** ambos modos usan el analizador elegido y producen resultados byte a byte idénticos.
4. **Given** un proyecto sin elección de lenguaje o con elección "auto", **When** se analiza, **Then** el comportamiento y los resultados son idénticos a los de antes de esta feature.
5. **Given** un valor de lenguaje no reconocido, **When** se pide el análisis, **Then** se rechaza indicando los valores admitidos.
6. **Given** un proyecto analizado en la sesión actual del servidor y sin cambios en sus archivos, **When** se consulta de nuevo con cualquier herramienta, **Then** la respuesta se obtiene sin repetir el análisis y es byte a byte idéntica a la de un análisis nuevo.
7. **Given** un proyecto analizado en la sesión actual, **When** se modifica, añade o elimina un archivo del proyecto y se consulta de nuevo, **Then** se repite el análisis y el resultado refleja el cambio.
8. **Given** un análisis que encuentra archivos no analizables o un proyecto .NET analizado en modo degradado, **When** termina, **Then** la respuesta del análisis completo en modo servidor incluye la lista de advertencias, la línea de comandos las informa por su salida de error, y los documentos de resultados y su versión de contrato no cambian.
9. **Given** la interfaz de la web, **When** un análisis termina con advertencias, **Then** el usuario las ve junto a los resultados.

---

### User Story 7 — Servicio del motor resistente a fallos (Priority: P2)

Como operador, quiero que la web mantenga un único servicio del motor activo, que se recupere solo si el motor cae o se cuelga, y que el análisis afectado falle con un motivo claro en lugar de quedar colgado.

**Why this priority**: Un proceso de larga vida introduce modos de fallo nuevos (caída, bloqueo, memoria); sin recuperación, un fallo deja la web inutilizable hasta reiniciarla.

**Independent Test**: Forzar la terminación del servicio del motor durante un análisis y luego enviar otro análisis; forzar un análisis que excede el tiempo máximo.

**Acceptance Scenarios**:

1. **Given** varios análisis sucesivos, **When** se ejecutan, **Then** la web reutiliza el mismo servicio del motor en lugar de arrancar uno por análisis.
2. **Given** un análisis en ejecución, **When** el servicio del motor termina inesperadamente, **Then** el análisis pasa a fallido con un motivo que lo indica, y el siguiente análisis se ejecuta con éxito sin reiniciar la web.
3. **Given** el tiempo máximo de análisis configurado (por defecto 30 minutos), **When** un análisis lo supera, **Then** pasa a fallido con el motivo "tiempo excedido" y los siguientes análisis no quedan bloqueados.
4. **Given** el motor emite diagnósticos por su salida de error, **When** ocurre un fallo, **Then** el registro del servidor conserva esos diagnósticos asociados al análisis, y el usuario ve solo un resumen del error.

---

### User Story 8 — Los clientes del análisis síncrono existente siguen funcionando (Priority: P3)

Como cliente de la interfaz de análisis síncrono entregada en la feature 006 (scripts, pruebas de aceptación), sigo obteniendo la misma respuesta con la misma petición, ahora sin pisarme con otros análisis.

**Why this priority**: Compatibilidad hacia atrás (principio I aplicado por extensión a la web) y protección de los escenarios bloqueados de 006; no aporta capacidades nuevas.

**Independent Test**: Ejecutar los escenarios de aceptación de la feature 006 sobre la web sin modificarlos.

**Acceptance Scenarios**:

1. **Given** la interfaz de análisis síncrono de 006, **When** se le envía un ZIP como antes, **Then** responde con el mismo formato (datos de componentes y de arquitectura) y los mismos mensajes de error.
2. **Given** dos peticiones síncronas simultáneas, **When** terminan, **Then** cada una obtiene los resultados de su propio proyecto.
3. **Given** la interfaz de la web, **When** el usuario analiza un proyecto, **Then** la web usa el flujo asíncrono y no la interfaz síncrona, que queda marcada como obsoleta.

---

### Edge Cases

- ZIP con una única carpeta raíz frente a ZIP con varios archivos en la raíz: la raíz del proyecto se determina igual que en 006 (si hay una sola carpeta, esa es la raíz).
- ZIP vacío o sin archivos analizables: el análisis termina (no falla) con cero componentes y una advertencia que lo indica.
- Nombres de archivo con espacios, acentos o caracteres no ASCII dentro del ZIP: se extraen y se analizan correctamente.
- Entradas duplicadas en el ZIP o entradas que difieren solo en mayúsculas: no deben escribir fuera del área; el resultado es determinista (regla concreta en el plan).
- El motor no tiene el analizador .NET disponible y el proyecto es .NET: el análisis falla con un mensaje que indica cómo construir o ubicar el analizador .NET.
- Proyecto .NET sin sistema de construcción completo disponible: el análisis termina en modo degradado con advertencia (principio V).
- Disco lleno durante la extracción o escritura de resultados: el análisis falla con motivo claro y se limpian sus archivos parciales.
- Petición del visor con ruta codificada (por ejemplo `%2e%2e`), con separadores de Windows o con bytes nulos: se rechaza.
- Consulta de un análisis caducado mientras la interfaz lo tenía abierto: la interfaz informa que caducó y ofrece analizar de nuevo.
- Reloj del servidor ajustado hacia atrás: la caducidad no elimina análisis en ejecución.
- Importación de archivos muy grandes: sujeta al mismo límite de tamaño de carga.
- Análisis enviado justo cuando el servicio del motor se está reiniciando: espera al servicio o falla con motivo claro; nunca queda en cola indefinidamente.

## Requirements *(mandatory)*

### Functional Requirements

**Análisis asíncrono**

- **FR-001**: La web MUST registrar un análisis al recibir un ZIP y responder de inmediato, sin esperar a que el análisis termine, con un identificador único no adivinable.
- **FR-002**: La web MUST permitir consultar el estado de un análisis por su identificador: estado (en cola, en ejecución, completado, fallido), fase actual (detección, extracción, inferencia, escritura), instantes de creación, inicio y fin, motivo del fallo y advertencias.
- **FR-003**: Al completarse un análisis, la web MUST permitir consultar por separado el grafo de dependencias, la arquitectura propuesta y los contratos de API, tal como los produjo el motor y validados contra el contrato de datos vigente (1.0.0), sin alterarlos.
- **FR-004**: La consulta de resultados de un análisis no completado MUST indicar que aún no están disponibles (o el motivo del fallo), y la de un identificador inexistente o caducado MUST indicar que no existe.
- **FR-005**: En modo desarrollo, la web MUST permitir analizar una carpeta local del servidor en lugar de un ZIP; fuera del modo desarrollo esa opción MUST rechazarse.
- **FR-006**: El envío de un análisis MUST aceptar una elección opcional de lenguaje (java, dotnet, auto; por defecto auto); un proyecto ambiguo sin elección MUST fallar con un mensaje que pida elegir el lenguaje.
- **FR-007**: La interfaz de la web MUST usar el flujo asíncrono: mostrar el estado y la fase del análisis, mostrar componentes, propuestas y advertencias al completarse, y recordar en el navegador el identificador del análisis activo para retomarlo tras recargar.

**Aislamiento y persistencia**

- **FR-008**: Cada análisis MUST tener su propia área de trabajo para la carga, las fuentes extraídas y los resultados; ningún análisis MUST leer ni escribir archivos con nombre fijo en el directorio de trabajo del servidor.
- **FR-009**: Los análisis y sus resultados MUST persistir en el disco del servidor sin base de datos y sobrevivir a la recarga del navegador y al reinicio del servidor web; un análisis que estaba en cola o en ejecución al reiniciarse el servidor MUST quedar fallido con el motivo "interrumpido".
- **FR-010**: Análisis concurrentes de proyectos distintos MUST producir resultados independientes; los análisis sobre la misma ruta de proyecto MUST serializarse.
- **FR-011**: La web MUST limitar el número de análisis en ejecución simultánea (configurable, por defecto 2) y el de análisis en cola (configurable, por defecto 10); por encima de ambos, el envío MUST rechazarse indicando que se reintente más tarde.
- **FR-012**: Los análisis terminados (completados, fallidos o importados) y todos sus archivos MUST eliminarse al superar un periodo de retención configurable (por defecto 24 horas desde su fin) mediante una limpieza periódica; los análisis en cola o en ejecución nunca se eliminan por caducidad.

**Seguridad de la carga**

- **FR-013**: La web MUST rechazar, antes de procesarla y sin conservar archivos, toda carga que supere un límite de tamaño configurable (por defecto 200 MB), indicando el límite.
- **FR-014**: La web MUST rechazar íntegramente un ZIP con cualquier entrada cuya ruta resuelta quede fuera del área de extracción del análisis (componentes `..`, rutas absolutas, letras de unidad, enlaces simbólicos), indicando la entrada culpable, sin escribir nada fuera de esa área.
- **FR-015**: La web MUST rechazar un ZIP cuyo tamaño descomprimido total supere un límite configurable (por defecto 1 GB) o cuyo número de entradas supere un límite configurable (por defecto 100 000), indicando el límite superado.
- **FR-016**: La web MUST rechazar con un mensaje claro los archivos que no son ZIP válidos y MUST eliminar los archivos temporales de todo envío rechazado o fallido.

**Visor de código fuente**

- **FR-017**: El visor de código MUST servir únicamente archivos de las fuentes extraídas del análisis indicado, pedidos mediante una ruta relativa a la raíz de ese proyecto.
- **FR-018**: El visor MUST rechazar rutas absolutas, rutas que tras resolverse (incluidos enlaces simbólicos y codificaciones) quedan fuera de la raíz del proyecto del análisis, directorios, archivos inexistentes, archivos de otros análisis, extensiones fuera de una lista permitida de archivos de código y configuración de los lenguajes soportados y archivos mayores que un límite de visualización (por defecto 2 MB), sin revelar el contenido ni la existencia de archivos fuera de la raíz.
- **FR-019**: La interfaz MUST poder abrir en el visor los archivos que los resultados del análisis asocian a cada componente.

**Importación de resultados**

- **FR-020**: La web MUST permitir importar resultados producidos previamente por el motor (grafo de dependencias y arquitectura obligatorios; contratos de API opcionales) sin ejecutar el motor, sujetos al mismo límite de tamaño de carga.
- **FR-021**: Cada documento importado MUST validarse contra el contrato de datos del producto; ante violaciones, la importación MUST rechazarse listando cada una con la ubicación del campo y el motivo, y ante una versión de contrato no soportada MUST indicar la versión encontrada y la soportada.
- **FR-022**: Una importación válida MUST crear un análisis de origen "importado", consultable, persistido y caducable como los demás, para el que el visor de código indica que no hay fuentes disponibles.

**Motor (cambios mínimos)**

- **FR-023**: El motor MUST informar el progreso de un análisis completo a los clientes del modo servidor que lo soliciten, como avisos de las fases detección, extracción, inferencia y escritura en ese orden; sin solicitud no MUST enviarse ningún aviso, y el progreso no MUST alterar ningún resultado.
- **FR-024**: El motor MUST aceptar, en el modo servidor y en la línea de comandos con la misma semántica, una elección opcional de lenguaje (java, dotnet, auto) que resuelve los proyectos ambiguos; "auto" o la ausencia de elección MUST conservar el comportamiento actual, y un valor no reconocido MUST rechazarse indicando los valores admitidos.
- **FR-025**: El motor en modo servidor MUST reutilizar, durante la vida del proceso, el análisis de un proyecto cuyos archivos no han cambiado (misma ruta, misma elección de lenguaje y mismo árbol de archivos con iguales fechas de modificación y tamaños) en todas sus herramientas; cualquier archivo modificado, añadido o eliminado MUST invalidar la reutilización; las respuestas reutilizadas MUST ser byte a byte idénticas a las de un análisis nuevo; la memoria usada por la reutilización MUST estar acotada por un número máximo configurable de proyectos.
- **FR-026**: El motor MUST recolectar advertencias de análisis (archivos no analizados con su motivo, proyectos .NET analizados en modo degradado, proyectos sin archivos analizables) y exponerlas en la respuesta del análisis completo del modo servidor y por la salida de error de la línea de comandos, sin modificar los documentos de resultados, la forma validada de las respuestas existentes ni la versión del contrato de datos.
- **FR-027**: Sin las opciones nuevas, el motor MUST producir en ambos modos resultados byte a byte idénticos a los anteriores a esta feature, y las pruebas existentes de paridad, de contrato y de las features 001–006 MUST pasar sin modificar sus aserciones.
- **FR-028**: Las verificaciones de calidad estática vigentes del motor (umbral de hallazgos de estilo, cero hallazgos de errores probables y formato del analizador .NET) MUST no empeorar.

**Servicio del motor en la web**

- **FR-029**: La web MUST usar el motor en su modo servidor mediante un único proceso de larga vida por servidor web, arrancado bajo demanda y reutilizado entre análisis; si el proceso termina inesperadamente, los análisis afectados MUST pasar a fallidos con un motivo que lo indique y el proceso MUST relanzarse automáticamente para los análisis siguientes.
- **FR-030**: Cada análisis MUST tener un tiempo máximo configurable (por defecto 30 minutos); al superarlo MUST pasar a fallido con el motivo "tiempo excedido" sin bloquear los análisis siguientes.
- **FR-031**: Los diagnósticos que el motor emite por su salida de error MUST conservarse en el registro del servidor asociados al análisis en curso; el usuario MUST ver solo un resumen del error.
- **FR-032**: Si el motor no está construido, el envío de un análisis MUST rechazarse con un mensaje que contenga "Engine not built", la ruta buscada y el comando de construcción, respetando la variable de entorno de sustitución de la ruta del motor de la feature 006.

**Compatibilidad**

- **FR-033**: La interfaz de análisis síncrono de la feature 006 MUST seguir aceptando la misma petición y devolviendo el mismo formato y los mismos mensajes de error, usando un área de trabajo aislada por petición; MUST marcarse como obsoleta y la interfaz de la web no MUST usarla.

### Key Entities

- **Análisis (job)**: unidad de trabajo identificada por un identificador único no adivinable. Atributos: origen (ZIP, carpeta local, importado), lenguaje elegido, estado (en cola, en ejecución, completado, fallido), fase actual, instantes de creación/inicio/fin, motivo de fallo, advertencias, raíz del proyecto extraído. Transiciones: en cola → en ejecución → completado | fallido; en cola → fallido (interrumpido); importado nace completado.
- **Área de trabajo del análisis**: conjunto de archivos propios de un análisis (carga, fuentes extraídas, resultados, metadatos). Se elimina al caducar.
- **Fase de progreso**: una de detección, extracción, inferencia, escritura; ordenadas y sin retrocesos.
- **Resultados**: los tres documentos del contrato de datos (grafo de dependencias, arquitectura, contratos de API) con su versión de contrato.
- **Advertencia**: mensaje del motor sobre algo omitido o degradado (qué, por qué, qué se omitió).
- **Servicio del motor**: proceso de larga vida del motor en modo servidor que la web reutiliza; estados arrancando, listo, caído.
- **Política de carga**: límites configurables (tamaño de carga, tamaño descomprimido, número de entradas, análisis simultáneos, cola, retención, tiempo máximo, tamaño de visualización).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En la prueba extremo a extremo en navegador, dos análisis lanzados a la vez desde dos sesiones (ZIP Java y ZIP .NET de demostración) terminan con éxito y cada sesión muestra solo componentes de su proyecto, en el 100 % de las ejecuciones.
- **SC-002**: En la prueba extremo a extremo, recargar el navegador durante un análisis retoma el mismo análisis y muestra sus propuestas sin volver a subir el ZIP, en el 100 % de las ejecuciones.
- **SC-003**: En la prueba extremo a extremo en navegador, "subir ZIP Java → ver propuestas" muestra al menos una propuesta en menos de 2 minutos desde la subida, y "subir ZIP .NET → ver propuestas" igual cuando el entorno dispone del SDK .NET (siempre en integración continua).
- **SC-004**: El registro de un análisis (respuesta con identificador) tarda menos de 2 segundos para el ZIP de demostración Java en la máquina de referencia, independientemente de la duración del análisis.
- **SC-005**: El 100 % de los ZIP del catálogo de pruebas maliciosas (salida por `..`, ruta absoluta, enlace simbólico, exceso de tamaño, exceso descomprimido, exceso de entradas, no-ZIP) se rechazan y 0 archivos quedan escritos fuera del área del análisis.
- **SC-006**: El 100 % de los intentos del catálogo de escape del visor (ruta absoluta, `..`, codificación, enlace simbólico, otro análisis, extensión no permitida, directorio, exceso de tamaño) se rechazan sin devolver contenido.
- **SC-007**: Para cada proyecto de demostración Java y .NET, los resultados obtenidos a través de la web son byte a byte idénticos a los de la línea de comandos sobre la misma ruta, dos ejecuciones consecutivas son byte a byte idénticas, y una respuesta reutilizada es byte a byte idéntica a una nueva.
- **SC-008**: Una segunda consulta del modo servidor sobre un proyecto de demostración sin cambios responde en menos del 20 % del tiempo de la primera.
- **SC-009**: Tras una terminación forzada del servicio del motor durante un análisis, ese análisis queda fallido en menos de 10 segundos y el siguiente análisis termina con éxito sin reiniciar la web.
- **SC-010**: El 100 % de los resultados válidos del catálogo del contrato se importan y se muestran, y el 100 % de los inválidos se rechazan nombrando al menos un campo infractor.
- **SC-011**: Ningún análisis caducado conserva archivos en disco más allá del periodo de retención más un intervalo de limpieza.
- **SC-012**: El 100 % de las pruebas existentes del producto (motor, analizador .NET, contrato, web y aceptación 005–006) pasan sin modificar aserciones, y los indicadores de calidad estática del motor no empeoran respecto de la línea base de la feature 006.

## Clarifications

### Session 2026-10-08

- Q: ¿Modo de integración runtime? -> A: El motor se usa en su modo servidor de herramientas, como un proceso único de larga vida por servidor web con reinicio ante fallo, llamadas serializadas por proyecto y área de resultados por análisis (decisión D2 del plan). (confirmado por usuario 2026-10-08) [FR-029, FR-008, FR-010]
- Q: ¿Persistencia de los análisis? -> A: En disco del servidor, sin base de datos. (confirmado por usuario 2026-10-08) [FR-009]
- Q: ¿Límite de tamaño de carga? -> A: Configurable, 200 MB por defecto. (confirmado por usuario 2026-10-08) [FR-013]
- Q: ¿Seguridad del visor? -> A: Restringido a las fuentes extraídas del análisis, ruta relativa, contención tras resolver enlaces y lista blanca de extensiones. (confirmado por usuario 2026-10-08) [FR-017, FR-018]
- Q: ¿Cambios del motor? -> A: Progreso por fases, elección de lenguaje, reutilización por proyecto sin cambios y advertencias expuestas, preservando paridad y determinismo (principios I, II, IV) y las verificaciones de calidad vigentes. (confirmado por usuario 2026-10-08) [FR-023, FR-024, FR-025, FR-026, FR-027, FR-028]
- Q: ¿Prueba extremo a extremo en navegador dentro de esta feature? -> A: Sí, "subir ZIP Java → ver propuestas" y "subir ZIP .NET → ver propuestas" son el criterio de salida (adelanta parte de la feature 011). (confirmado por usuario 2026-10-08) [SC-001, SC-002, SC-003]
- Q: ¿Límites de descompresión (bomba ZIP)? -> A: 1 GB descomprimido y 100 000 entradas por defecto, configurables. (default elegido por agente — pendiente confirmar) [FR-015]
- Q: ¿Cuota de concurrencia? -> A: 2 análisis en ejecución y 10 en cola por defecto, configurables (riesgo de memoria de la sección 5 del plan: concurrencia 1-2). (default elegido por agente — pendiente confirmar) [FR-011]
- Q: ¿Periodo de retención? -> A: 24 horas desde el fin del análisis, configurable; los análisis activos nunca caducan. (default elegido por agente — pendiente confirmar) [FR-012]
- Q: ¿Qué pasa con los análisis activos al reiniciar el servidor web? -> A: Quedan fallidos con motivo "interrumpido"; no se reanudan. (default elegido por agente — pendiente confirmar) [FR-009]
- Q: ¿Tiempo máximo por análisis? -> A: 30 minutos por defecto, configurable. (default elegido por agente — pendiente confirmar) [FR-030]
- Q: ¿Análisis de carpeta local? -> A: Solo en modo desarrollo; rechazado en cualquier otro modo. (default elegido por agente — pendiente confirmar) [FR-005]
- Q: ¿Autenticación o propiedad de los análisis? -> A: Fuera de alcance (herramienta de un solo inquilino); el aislamiento entre usuarios se apoya en identificadores no adivinables. (default elegido por agente — pendiente confirmar) [FR-001]
- Q: ¿Cómo se exponen las advertencias sin romper el contrato 1.0.0 (la respuesta del análisis completo es un objeto cerrado y hay aserciones bloqueadas de 005/006 sobre la versión 1.0.0)? -> A: Como metadatos de la respuesta del modo servidor, fuera del contenido validado por el contrato, y por la salida de error en la línea de comandos; la versión del contrato no cambia en esta feature. (default elegido por agente — pendiente confirmar) [FR-026]
- Q: ¿La elección de lenguaje llega también a la línea de comandos? -> A: Sí, como opción adicional opcional, para mantener la paridad entre modos (principios I y II). (default elegido por agente — pendiente confirmar) [FR-024]
- Q: ¿Qué se hace con la interfaz de análisis síncrono de 006? -> A: Se conserva por compatibilidad (escenarios bloqueados de 006), con área aislada por petición, marcada como obsoleta; la interfaz de la web pasa al flujo asíncrono. (default elegido por agente — pendiente confirmar) [FR-033]
- Q: ¿Qué documentos exige la importación? -> A: Grafo y arquitectura obligatorios; contratos de API opcionales. (default elegido por agente — pendiente confirmar) [FR-020]
- Q: ¿Lista permitida y tamaño máximo del visor? -> A: Archivos de código y configuración de los lenguajes soportados (Java, C#, VB.NET, descriptores de proyecto y de construcción, configuración y SQL); 2 MB por defecto. (default elegido por agente — pendiente confirmar) [FR-018]
- Q: ¿Cancelación explícita de un análisis por el usuario? -> A: Fuera de alcance (la fase 5 trata la experiencia de usuario); cerrar o recargar el navegador no cancela. (default elegido por agente — pendiente confirmar) [FR-007]
- Q: ¿Alcance de la reutilización del motor? -> A: Solo en memoria durante la vida del proceso del modo servidor, acotada a 8 proyectos por defecto; la línea de comandos no reutiliza. (default elegido por agente — pendiente confirmar) [FR-025]

### Assumptions

- La web se ejecuta en un host con JDK 17 y, para .NET, el entorno .NET 8 (contenedor o máquina), nunca en una plataforma sin procesos de larga vida (riesgo de la sección 5 del plan).
- Los proyectos de demostración `java-standar` y `dotnet-ecommerce` son los de referencia para la prueba extremo a extremo y para la paridad.
- La máquina de referencia y la integración continua disponen de un navegador automatizable para la prueba extremo a extremo.
- El comando reservado de pruebas extremo a extremo del producto (bloqueado por la feature 006 como marcador de la feature 011) no se modifica en esta feature; la prueba en navegador de esta feature se ejecuta con su propio comando.
- La Constitución v1.0.0 no se enmienda en esta feature.
