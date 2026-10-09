# Feature Specification: Cierre de VB.NET legacy

**Feature Branch**: `009-vb-legacy-completion`
**Created**: 2026-10-08
**Status**: Draft
**Input**: User description: "Fase 4 — 009 Cierre de VB.NET legacy (PLAN-INTEGRACION-DEV-ARCH.md) + sección *Deferred* de specs/004-vb-legacy-analyzer. Perfil objetivo: aplicaciones de escritorio VB sobre .NET Framework 4.8 (formularios, módulos, ADO.NET con DataSets tipados y SQL literal, app.config/web.config, eventualmente servicios web ASMX/WCF), no VB moderno. Alcance: extracción de endpoints, tablas, métricas, secretos/configuración y code issues para VB; capas de escritorio legacy (formularios, módulos, acceso a datos, reportes); documentar y advertir la fidelidad reducida fuera de Windows; corpus sintético redistribuible en el repositorio para CI y corpus real opcional. Criterio de salida: un proyecto VB legacy produce tablas, métricas e issues no vacíos; las salidas C#/Java existentes no cambian; el contrato JSON sigue en 1.0.0."

## Contexto

La feature 004 habilitó la carga de proyectos VB.NET legacy (perfil "AmigosPlus": aplicaciones de escritorio .NET Framework 4.x en Visual Basic) con el mismo contrato de salida que C#, pero cerró su alcance en carga, tipos, invocaciones, inyección, mensajería, tamaño y capa. Todo lo demás quedó **diferido a 009** y hoy produce valores vacíos sobre VB:

- `tables_used` vacío: el acceso a datos ADO.NET (SQL literal en comandos y adaptadores, DataSets tipados) no se reconoce.
- Métricas de acoplamiento, cohesión y complejidad sin calcular para componentes VB.
- `secrets_references` y `sensitive_data` sin hallazgos: la configuración de aplicación de .NET Framework (`app.config`, `web.config`) no se lee.
- `code_issues` vacío: los patrones de riesgo típicos de VB legacy (`On Error Resume Next`, `Option Strict Off`, `GoTo`, enlace tardío) no se detectan.
- Las capas no reconocen formularios, módulos, acceso a datos ni reportes de escritorio.
- `endpoints` vacío para servicios web legacy en VB (ASMX/WCF).
- La fidelidad reducida fuera de Windows solo se anuncia en la salida de error del analizador .NET; el usuario del producto (CLI, agentes, web) no la ve.
- Los tests del corpus de referencia dependen de un corpus externo no redistribuible que no está en el repositorio, y su documentación afirma lo contrario.

Esta feature cierra esos huecos. La Constitución vigente (v1.0.0) obliga a: no cambiar las salidas existentes de C# y Java ni el contrato público sin versionado (principio I), mantener la lógica en el núcleo compartido (principio II), TDD (principio III), determinismo (principio IV), degradación con advertencias claras (principio V) y dependencias mínimas justificadas (principio VI).

## User Stories *(mandatory)*

### User Story 1 — Ver las tablas que usa un sistema VB legacy (Priority: P1)

Como arquitecto que evalúa un monolito VB.NET de escritorio, quiero que cada componente indique las tablas de base de datos que lee o escribe a través de ADO.NET (sentencias SQL escritas en el código y DataSets tipados), de modo que la propuesta de microservicios agrupe componentes por los datos que comparten.

**Why this priority**: Las tablas compartidas son la principal señal de acoplamiento en sistemas legacy centrados en base de datos; sin ellas la descomposición del perfil objetivo es ciega.

**Independent Test**: Analizar el proyecto VB sintético de escritorio y comprobar que el componente de acceso a datos lista exactamente las tablas de sus sentencias SQL y que el componente que usa el DataSet tipado lista las tablas de ese DataSet.

**Acceptance Scenarios**:

1. **Given** un componente VB que construye un comando con la sentencia `SELECT ... FROM dbo.Customers c INNER JOIN [Orders] o ...`, **When** se analiza, **Then** su `tables_used` contiene `Customers` y `Orders` (sin esquema ni delimitadores)
2. **Given** un componente VB que asigna sentencias `INSERT INTO`, `UPDATE ... SET` y `DELETE FROM` al texto de un comando, **When** se analiza, **Then** su `tables_used` contiene las tablas destino de cada sentencia
3. **Given** una sentencia SQL partida en varios literales concatenados (con continuación de línea), **When** se analiza, **Then** las tablas se extraen de la sentencia completa
4. **Given** un proyecto con un DataSet tipado (definición del DataSet junto al código) y un componente que usa uno de sus adaptadores de tabla o una de sus tablas tipadas, **When** se analiza, **Then** el componente lista las tablas de base de datos asociadas a esos adaptadores o tablas tipadas
5. **Given** literales de texto que no son SQL (mensajes al usuario, rutas, palabras como "select" dentro de una frase), **When** se analiza, **Then** no se reportan tablas espurias
6. **Given** un proyecto C# existente, **When** se analiza, **Then** sus `tables_used` son idénticos a los de antes de esta feature

---

### User Story 2 — Detectar los riesgos de código propios de VB legacy (Priority: P1)

Como arquitecto, quiero que el análisis reporte los patrones de riesgo característicos de VB legacy (manejo de errores no estructurado, comprobación de tipos relajada, saltos incondicionales, enlace tardío) además de los patrones generales que ya se reportan para C#, de modo que pueda estimar el riesgo de extraer cada componente.

**Why this priority**: Es parte del criterio de salida ("issues no vacíos") y la señal de deuda técnica más relevante del perfil objetivo.

**Independent Test**: Analizar el proyecto VB sintético y comprobar que los componentes con cada patrón reportan exactamente el issue esperado con su línea.

**Acceptance Scenarios**:

1. **Given** un método VB con `On Error Resume Next`, **When** se analiza, **Then** el componente reporta un issue `ON_ERROR_RESUME_NEXT` con severidad `WARNING` en la línea de la instrucción
2. **Given** un archivo VB que declara `Option Strict Off`, **When** se analiza, **Then** cada componente declarado en ese archivo reporta un issue `OPTION_STRICT_OFF` con severidad `WARNING` en la línea de la declaración
3. **Given** un método VB con una instrucción `GoTo etiqueta`, **When** se analiza, **Then** el componente reporta un issue `GOTO_STATEMENT` con severidad `INFO`
4. **Given** un método VB que accede a miembros de una variable de tipo `Object` (enlace tardío) o crea objetos COM por nombre, **When** se analiza, **Then** el componente reporta un issue `LATE_BINDING` con severidad `WARNING` por cada línea afectada
5. **Given** un bloque `Catch` vacío, un `Catch ex As Exception`, un `Select Case` sin `Case Else` o una variable con nombre de secreto inicializada con un literal, **When** se analiza código VB, **Then** se reportan respectivamente `EMPTY_CATCH_BLOCK`, `CATCH_GENERIC_EXCEPTION`, `MISSING_SWITCH_DEFAULT` y `HARDCODED_SECRET_IN_CODE` con las mismas severidades que en C#
6. **Given** código VB sin ninguno de esos patrones (incluidos `On Error GoTo`, `Option Strict On` y accesos a miembros de tipos conocidos), **When** se analiza, **Then** no se reportan esos issues
7. **Given** un proyecto C# existente, **When** se analiza, **Then** sus `code_issues` son idénticos a los de antes de esta feature

---

### User Story 3 — Métricas de acoplamiento, cohesión y complejidad para VB (Priority: P1)

Como arquitecto, quiero que los componentes VB tengan las mismas métricas de calidad que los C# (acoplamiento entre objetos, falta de cohesión, complejidad ciclomática máxima y media, issues de complejidad alta), de modo que las propuestas y los informes comparen VB y C# con la misma vara.

**Why this priority**: Es parte del criterio de salida ("métricas no vacías") y alimenta la viabilidad de extracción.

**Independent Test**: Analizar el proyecto VB sintético y comprobar valores concretos de acoplamiento, cohesión y complejidad en componentes con estructura conocida.

**Acceptance Scenarios**:

1. **Given** una clase VB que declara campos, parámetros o variables de otros componentes del proyecto, los crea o invoca sus métodos, **When** se analiza, **Then** su acoplamiento es el número de tipos distintos referenciados, excluyendo el propio tipo, los tipos del sistema y los tipos que no pudieron resolverse
2. **Given** una clase VB con campos y varios métodos de instancia, **When** se analiza, **Then** su falta de cohesión se calcula con la misma fórmula que en C#, reconociendo los accesos a campos sin distinguir mayúsculas de minúsculas (regla del lenguaje VB)
3. **Given** un método VB con decisiones (`If`/`ElseIf`, bucles, `Case`, `Catch`, operador condicional, `AndAlso`/`OrElse`), **When** se analiza, **Then** su complejidad es 1 más el número de decisiones, y el componente informa la complejidad máxima y la media de sus métodos
4. **Given** un método VB con complejidad mayor que 10 (o mayor que 15), **When** se analiza, **Then** se reporta `HIGH_CYCLOMATIC_COMPLEXITY` con severidad `WARNING` (o `ERROR`), igual que en C#
5. **Given** un módulo VB (todos sus miembros son compartidos), **When** se analiza, **Then** su falta de cohesión es 0 y su complejidad se informa igualmente

---

### User Story 4 — Configuración de aplicación y secretos en VB (Priority: P2)

Como responsable de seguridad de la migración, quiero saber qué componentes VB leen entradas de `app.config`/`web.config` y cuáles dependen de credenciales guardadas en texto plano en esos archivos, de modo que pueda planificar su externalización antes de extraer servicios.

**Why this priority**: Los secretos en configuración son un bloqueante habitual de la extracción, pero el criterio de salida no depende de ellos.

**Independent Test**: Analizar el proyecto VB sintético (con su archivo de configuración) y comprobar las referencias de configuración, el marcado de datos sensibles y el issue de credencial en texto plano.

**Acceptance Scenarios**:

1. **Given** un componente VB que lee la cadena de conexión `ShopDb` desde la configuración de la aplicación, **When** se analiza, **Then** su `secrets_references` contiene `config:ConnectionStrings:ShopDb` y `ConfigurationManager`
2. **Given** un componente VB que lee la clave `ApiKey` de los ajustes de la aplicación (o un ajuste tipado de proyecto), **When** se analiza, **Then** su `secrets_references` contiene `config:ApiKey`
3. **Given** que la entrada referenciada contiene en el archivo de configuración del proyecto una credencial en texto plano (contraseña en la cadena de conexión, o clave con nombre de secreto y valor no vacío), **When** se analiza, **Then** el componente se marca `sensitive_data = true` y reporta un issue `PLAINTEXT_SECRET_IN_CONFIG` (tipo `SECURITY`, severidad `CRITICAL`) en la línea de la referencia
4. **Given** una cadena de conexión con seguridad integrada (sin contraseña) o un ajuste sin nombre de secreto, **When** se analiza, **Then** se registra la referencia pero no se marca como sensible ni se reporta issue
5. **Given** un componente VB con un issue `HARDCODED_SECRET_IN_CODE`, **When** se analiza, **Then** se marca `sensitive_data = true`
6. **Given** un archivo de configuración ausente, ilegible o mal formado, **When** se analiza, **Then** el análisis completa, las referencias desde código se registran igualmente y se emite una advertencia de diagnóstico
7. **Given** un proyecto C# existente, **When** se analiza, **Then** sus `secrets_references` y `sensitive_data` son idénticos a los de antes de esta feature

---

### User Story 5 — Capas de una aplicación de escritorio legacy (Priority: P2)

Como arquitecto, quiero que los formularios, los reportes, los objetos de acceso a datos y los módulos VB se clasifiquen en capas coherentes con una aplicación de escritorio, de modo que la vista por capas del sistema legacy sea interpretable.

**Why this priority**: Mejora la lectura de los resultados; las capas no alteran hoy la inferencia de microservicios.

**Independent Test**: Analizar el proyecto VB sintético y comprobar la capa de un formulario, un reporte, un objeto de acceso a datos, un módulo, una fachada `*Controller` y un servicio web.

**Acceptance Scenarios**:

1. **Given** una clase VB que hereda de un formulario o control de usuario de escritorio, o cuyo nombre sigue la convención de formulario (`*Form`, `frm*`), **When** se analiza, **Then** su capa es la de presentación del catálogo (`Web`)
2. **Given** una clase VB de reporte (hereda de un tipo de reporte conocido o su nombre termina en `Report`/`Reporte` o empieza por `rpt`), **When** se analiza, **Then** su capa es `Web` (presentación)
3. **Given** una clase o módulo VB sin evidencia de presentación que usa tablas, o cuyo nombre indica acceso a datos (`*DataAccess`, `*DAL`, `*Dal`, `*DataLayer`, `*TableAdapter`, además de los sufijos de datos existentes), **When** se analiza, **Then** su capa es `Datos`
4. **Given** un módulo VB sin evidencia de presentación ni de datos, **When** se analiza, **Then** su capa es `Compartida`
5. **Given** una clase VB que expone un servicio web (servicio ASMX o implementación de un contrato WCF), **When** se analiza, **Then** su capa es `Controlador`
6. **Given** una fachada VB `*Controller` sin evidencia HTTP, o un `*Adapter`, **When** se analiza, **Then** se mantienen las reglas de 004 (FR-020/FR-021: `Negocio` y `Datos` respectivamente)
7. **Given** un proyecto C# existente, **When** se analiza, **Then** sus capas son idénticas a las de antes de esta feature

---

### User Story 6 — Servicios web legacy VB como contratos de API (Priority: P2)

Como arquitecto, quiero que las operaciones de servicios web ASMX y WCF escritos en VB aparezcan como endpoints del contrato de API, de modo que las interfaces existentes del sistema legacy queden inventariadas.

**Why this priority**: El perfil objetivo es de escritorio; los servicios web aparecen solo en parte del corpus, por lo que es secundario.

**Independent Test**: Analizar el proyecto VB sintético de servicios web y comprobar la lista exacta de endpoints.

**Acceptance Scenarios**:

1. **Given** una clase VB de servicio ASMX con dos métodos públicos marcados como métodos web y uno sin marcar, **When** se analiza, **Then** se emiten exactamente dos endpoints `POST /<Clase>.asmx/<Método>` asociados a esa clase
2. **Given** un contrato WCF VB con operaciones y una clase que lo implementa, **When** se analiza, **Then** se emite un endpoint `POST /<Clase>.svc/<Operación>` por operación, asociado a la clase que lo implementa
3. **Given** una operación WCF con plantilla de URI de lectura (`WebGet`) o de invocación con verbo (`WebInvoke`), **When** se analiza, **Then** el endpoint usa ese verbo y la ruta `/<Clase>.svc/<plantilla>`
4. **Given** parámetros en esas operaciones, **When** se analiza, **Then** el endpoint lista cada parámetro con su nombre, tipo declarado y ubicación (ruta si aparece en la plantilla, consulta para `WebGet` sin plantilla de ese parámetro, cuerpo en el resto)
5. **Given** un proyecto VB de escritorio sin servicios web, **When** se analiza, **Then** no se emiten endpoints

---

### User Story 7 — Saber cuándo el análisis VB tiene fidelidad reducida (Priority: P2)

Como usuario del producto (CLI, agente de IA o web), quiero recibir una advertencia cuando un proyecto VB legacy se analiza con fidelidad reducida (fuera de Windows o sin el entorno de compilación), y encontrar documentadas las limitaciones, de modo que interprete correctamente los resultados.

**Why this priority**: Cumple el principio V y cierra un ítem diferido; no altera los datos del análisis.

**Independent Test**: En macOS/Linux, analizar el proyecto VB sintético con el motor por línea de comandos y como herramienta MCP, y comprobar la advertencia en el canal de advertencias definido en 007; analizar el demo C# y comprobar que no aparece.

**Acceptance Scenarios**:

1. **Given** un proyecto VB analizado con la carga de fidelidad reducida, **When** se analiza con el motor como herramienta MCP, **Then** el resultado incluye en sus advertencias (canal de 007) un texto que nombra el proyecto VB, indica fidelidad reducida y remite a la documentación
2. **Given** el mismo caso por línea de comandos, **When** termina, **Then** la advertencia se imprime en la salida de error con el prefijo de advertencias de 007 y los archivos de salida no cambian
3. **Given** el mismo caso, **When** se emite el grafo, **Then** `meta.source` es `roslyn-fallback` (corrige FR-006 de 004 para la carga por proyecto)
4. **Given** un proyecto C# analizado con la carga completa, **When** se analiza, **Then** no aparece ninguna advertencia nueva y sus salidas son idénticas a las de antes de esta feature
5. **Given** la documentación del producto, **When** se consulta, **Then** describe qué se pierde con la fidelidad reducida (tipos de .NET Framework sin resolver, acoplamiento con tipos de framework no contabilizado, referencias de proyecto) y cómo obtener la fidelidad completa

---

### User Story 8 — Corpus VB redistribuible en CI y corpus real opcional (Priority: P1)

Como mantenedor, quiero un corpus VB sintético y redistribuible dentro de las pruebas que ejercite todos los analizadores VB, y que las pruebas sobre el corpus real sigan siendo opcionales, de modo que la integración continua verifique el soporte VB sin depender de código no redistribuible.

**Why this priority**: Sin corpus en CI no hay verificación continua del criterio de salida.

**Independent Test**: Ejecutar la suite en un clon limpio sin el corpus real y comprobar que los tests del corpus sintético pasan y que los del corpus real no se ejecutan.

**Acceptance Scenarios**:

1. **Given** un clon limpio del repositorio sin el corpus real, **When** se ejecuta la suite estándar, **Then** pasan los tests del corpus sintético y no se ejecutan los del corpus real
2. **Given** el corpus sintético, **When** se analiza, **Then** contiene al menos un formulario, un módulo, acceso a datos con SQL literal y DataSet tipado, archivo de configuración con cadenas de conexión y ajustes, un reporte, una fachada de negocio, un servicio ASMX y un servicio WCF, todo con nombres ficticios
3. **Given** el corpus real presente localmente, **When** se ejecuta la categoría opcional, **Then** sus tests se ejecutan como antes
4. **Given** la documentación de los tests del corpus real, **When** se lee, **Then** indica que el corpus es externo, no redistribuible y opcional

### Edge Cases

- Sentencia SQL construida con variables concatenadas (`"... FROM " & tabla`): se extraen solo los nombres literales; la parte variable no produce tabla.
- Nombres de tabla con esquema (`dbo.X`), delimitados (`[X]`, `"X"`) o con alias: se normalizan al nombre simple sin delimitadores.
- Sentencias en minúsculas o mixtas y con saltos de línea: se reconocen igual.
- Llamadas a procedimientos almacenados (`EXEC`, tipo de comando procedimiento): no producen tablas.
- Literal que empieza por una palabra SQL dentro de un mensaje (`"Select a customer from the list"`): no produce tablas.
- SQL construido de forma incremental (`sql = sql & " FROM X"`) o por partes en un acumulador de texto, y expresiones de tabla comunes (`WITH`): no se reconocen (limitación documentada).
- Definición de DataSet tipado mal formada o sin adaptadores: se ignora con advertencia de diagnóstico; el análisis continúa.
- Archivos de configuración con distinta capitalización (`App.config`, `Web.config`) o ambos presentes: se leen ambos; en conflicto de claves gana el primero en orden ordinal de nombre de archivo.
- Archivos de transformación de configuración (`Web.Debug.config`): no se leen.
- `Option Strict Off` en un archivo sin tipos declarados: no genera issues.
- Enlace tardío en varias expresiones de la misma línea: un único issue por línea.
- `On Error GoTo 0` / `On Error GoTo etiqueta`: no generan `ON_ERROR_RESUME_NEXT` ni `GOTO_STATEMENT`.
- `.vbproj` legacy que la carga completa abre fuera de Windows pero sin ensamblados de referencia de .NET Framework (ni siquiera el tipo base de objetos): se trata como fidelidad reducida (FR-065); verificado en macOS con el corpus sintético.
- Proyecto mixto C# + VB: las reglas VB se aplican solo a los componentes VB; los componentes C# conservan su salida.
- Archivos `.vb` autogenerados (diseñador, DataSet tipado, referencias de servicio): siguen excluidos (FR-010 de 004), pero la definición del DataSet tipado sí se lee para resolver tablas.

## Requirements *(mandatory)*

### Functional Requirements

**Tablas (ADO.NET)**

- **FR-001**: El sistema DEBE extraer, para cada componente VB, los nombres de tabla de las sentencias SQL literales (`SELECT ... FROM/JOIN`, `INSERT INTO`, `UPDATE ... SET`, `DELETE FROM`, `MERGE INTO`) presentes en su código, incluidas las formadas por concatenación de literales
- **FR-002**: Los nombres de tabla DEBEN normalizarse quitando delimitadores y el prefijo de esquema/base de datos, conservando la capitalización del literal; las tablas se deduplican sin distinguir mayúsculas (se conserva la primera aparición en orden de código)
- **FR-003**: El sistema DEBE leer las definiciones de DataSets tipados presentes en el directorio del proyecto VB y asignar a cada componente que referencie un adaptador de tabla o una tabla tipada de esas definiciones la tabla de base de datos asociada
- **FR-004**: Un literal DEBE considerarse SQL solo si, tras recortar espacios, empieza por una palabra clave de sentencia (`SELECT`, `INSERT`, `UPDATE`, `DELETE`, `MERGE`) y tiene la estructura de esa sentencia (`SELECT <lista> FROM <tabla>`, `INSERT INTO <tabla> (...)|VALUES|SELECT`, `UPDATE <tabla> SET`, `DELETE FROM <tabla>`, `MERGE [INTO] <tabla> ... USING`); las llamadas a procedimientos almacenados, las tablas temporales y las variables de tabla no producen tablas

**Code issues VB**

- **FR-010**: El sistema DEBE reportar `ON_ERROR_RESUME_NEXT` (`BUG_PATTERN`, `WARNING`) por cada instrucción `On Error Resume Next`
- **FR-011**: El sistema DEBE reportar `OPTION_STRICT_OFF` (`CODE_STYLE`, `WARNING`) en cada componente declarado en un archivo con `Option Strict Off` explícito
- **FR-012**: El sistema DEBE reportar `GOTO_STATEMENT` (`CODE_STYLE`, `INFO`) por cada instrucción `GoTo` (no por `On Error GoTo`)
- **FR-013**: El sistema DEBE reportar `LATE_BINDING` (`BUG_PATTERN`, `WARNING`) por cada línea con acceso a miembros resuelto en tiempo de ejecución o con creación de objetos COM por nombre (`CreateObject`, `GetObject`), como máximo uno por línea
- **FR-014**: El sistema DEBE reportar para VB los patrones generales `EMPTY_CATCH_BLOCK`, `CATCH_GENERIC_EXCEPTION`, `MISSING_SWITCH_DEFAULT` y `HARDCODED_SECRET_IN_CODE` con el mismo tipo, severidad y semántica que en C#
- **FR-015**: Cada issue VB DEBE indicar la línea (1-based) del nodo que lo origina; los issues de un componente DEBEN ordenarse de forma determinista igual que en C#

**Métricas VB**

- **FR-020**: El sistema DEBE calcular para cada clase, módulo, estructura e interfaz VB el acoplamiento (`cbo`), la falta de cohesión (`lcom`) y, si tiene métodos, la complejidad máxima y media (`complexity_max`, `complexity_avg`) con las mismas definiciones que para C#, adaptadas a la sintaxis VB
- **FR-021**: El acoplamiento VB NO DEBE contar tipos que no pudieron resolverse (por ejemplo, tipos de .NET Framework en la carga de fidelidad reducida), además de las exclusiones de C#
- **FR-022**: El sistema DEBE reportar `HIGH_CYCLOMATIC_COMPLEXITY` para métodos VB con los mismos umbrales y severidades que en C#
- **FR-023**: El `loc` de los componentes VB NO DEBE cambiar respecto de 004 (FR-025/FR-026 de 004)

**Configuración y secretos**

- **FR-030**: El sistema DEBE leer los archivos de configuración de aplicación (`app.config`, `web.config`, sin distinguir mayúsculas) del directorio del proyecto VB: cadenas de conexión (nombre, valor) y ajustes de aplicación (clave, valor)
- **FR-031**: El sistema DEBE registrar en `secrets_references` del componente VB `config:ConnectionStrings:<nombre>` por cada lectura de cadena de conexión con nombre literal, `config:<clave>` por cada lectura de ajuste con clave literal o de ajuste tipado de proyecto, y `ConfigurationManager` cuando el componente usa el gestor de configuración
- **FR-032**: Una entrada de configuración es una credencial en texto plano si es una cadena de conexión con contraseña no vacía, o un ajuste cuya clave contiene una palabra de secreto (mismo conjunto que `HARDCODED_SECRET_IN_CODE`) y cuyo valor no es vacío
- **FR-033**: Un componente VB que referencia una credencial en texto plano DEBE marcarse `sensitive_data = true` y reportar `PLAINTEXT_SECRET_IN_CONFIG` (`SECURITY`, `CRITICAL`) por referencia; un componente VB con `HARDCODED_SECRET_IN_CODE` DEBE marcarse `sensitive_data = true`
- **FR-034**: Los valores de configuración (contraseñas, claves) NO DEBEN aparecer en la salida ni en los mensajes
- **FR-035**: Un archivo de configuración o de DataSet tipado ilegible o mal formado DEBE emitir una advertencia de diagnóstico y NO DEBE abortar el análisis

**Capas de escritorio**

- **FR-040**: Para componentes VB, el sistema DEBE aplicar, en este orden de prioridad, las reglas: (1) evidencia HTTP de 004 o servicio web (ASMX/WCF) → `Controlador`; (2) formulario o control de usuario → `Web`; (3) reporte → `Web`; (4) sufijo `Controller` → `Negocio` (FR-021 de 004); (5) evidencia de acceso a datos (sufijos de datos o tablas usadas) → `Datos`; (6) módulo → `Compartida`; (7) en otro caso, la clasificación general existente
- **FR-041**: Las interfaces VB DEBEN conservar la clasificación general existente
- **FR-042**: Las reglas de escritorio NO DEBEN aplicarse a componentes C#

**Endpoints**

- **FR-050**: El sistema DEBE emitir un endpoint `POST /<ClaseSimple>.asmx/<Método>` por cada método público marcado como método web en una clase VB de servicio ASMX
- **FR-051**: El sistema DEBE emitir un endpoint por cada operación de un contrato de servicio WCF VB, asociado a cada clase VB que implementa el contrato (o al contrato si ninguna lo implementa), con verbo `POST` y ruta `/<ClaseSimple>.svc/<Operación>`, o con el verbo y la plantilla de URI declarados (`WebGet` → `GET`, `WebInvoke` → su método, `POST` por defecto)
- **FR-052**: Cada endpoint VB DEBE listar sus parámetros (nombre, tipo declarado, ubicación, requerido salvo `Optional`) y el tipo de retorno de las funciones como esquema de respuesta
- **FR-053**: La detección de servicios web DEBE funcionar con la carga de fidelidad reducida (sin resolver los tipos de .NET Framework)

**Fidelidad reducida y advertencias**

- **FR-060**: Cuando algún proyecto VB se carga con fidelidad reducida, `meta.source` DEBE ser `roslyn-fallback`
- **FR-065**: Cuando la carga completa de un proyecto VB produce una compilación que no resuelve la biblioteca base del framework (fuera de Windows: faltan los ensamblados de referencia de .NET Framework), el sistema DEBE usar la carga de fidelidad reducida para ese proyecto, igual que con una compilación vacía (FR-005 de 004); los archivos de `bin/` y `obj/` del proyecto NO DEBEN formar parte de esa carga
- **FR-061**: En ese caso el analizador .NET DEBE comunicar al motor una advertencia de usuario por proyecto VB afectado, con texto determinista que nombra el archivo de proyecto (sin ruta absoluta), indica fidelidad reducida y remite a la documentación
- **FR-062**: El motor DEBE exponer esas advertencias por el canal de advertencias de 007 (metadatos del resultado MCP y salida de error del CLI) sin alterar los documentos JSON
- **FR-063**: Los análisis C# y Java NO DEBEN producir advertencias nuevas
- **FR-064**: La documentación del producto DEBE describir las limitaciones de la fidelidad reducida para VB y cómo obtener la fidelidad completa

**Corpus**

- **FR-070**: Las pruebas DEBEN incluir un corpus VB sintético, ficticio y redistribuible que cubra US1–US6
- **FR-071**: Las pruebas del corpus real DEBEN seguir siendo opcionales (excluidas de la suite estándar) y su documentación DEBE indicar que el corpus es externo y no redistribuible

**Compatibilidad, contrato y determinismo**

- **FR-080**: Las salidas de proyectos C# y Java existentes DEBEN ser idénticas byte a byte a las anteriores a esta feature
- **FR-081**: La salida para proyectos VB DEBE cumplir el contrato JSON 1.0.0 sin campos ni valores de enumeración nuevos
- **FR-082**: Dos análisis consecutivos de la misma entrada VB DEBEN producir salidas idénticas byte a byte (excluyendo `meta.collected_at`)
- **FR-083**: Un fallo de cualquier analizador VB sobre un componente o archivo DEBE emitir una advertencia de diagnóstico y NO DEBE abortar el análisis del resto

### Key Entities

- **Sentencia SQL literal**: texto SQL completo (tras unir literales concatenados) presente en el código de un componente; fuente de nombres de tabla.
- **DataSet tipado**: definición de DataSet del proyecto con tablas tipadas y adaptadores de tabla asociados a tablas de base de datos.
- **Archivo de configuración de aplicación**: `app.config`/`web.config` con cadenas de conexión y ajustes; sus valores nunca se emiten.
- **Referencia de configuración**: lectura desde código de una entrada de configuración por nombre/clave literal.
- **Issue VB**: hallazgo de código con regla, tipo, severidad, mensaje y línea, dentro del conjunto abierto de reglas del contrato.
- **Advertencia de fidelidad reducida**: mensaje de usuario por proyecto VB cargado sin entorno de compilación completo.
- **Corpus sintético**: proyectos VB ficticios redistribuibles dentro de las pruebas.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El corpus sintético produce al menos 3 componentes con `tables_used` no vacío, al menos 5 componentes con `cbo`, `lcom`, `complexity_max` y `complexity_avg` informados y al menos 8 reglas de issue distintas
- **SC-002**: El 100% de los casos de la matriz de pruebas de issues VB (positivos y negativos de US2) se clasifican correctamente
- **SC-003**: El 100% de las tablas esperadas del corpus sintético se detectan y no se reporta ninguna tabla no esperada
- **SC-004**: Las salidas del analizador .NET y del motor para los proyectos C# y Java de referencia son idénticas byte a byte antes y después de la feature, y la suite preexistente (156 tests .NET sin la categoría `Corpus`, más las suites Java, web y de aceptación) permanece en verde
- **SC-005**: Dos análisis consecutivos del corpus sintético producen salidas idénticas byte a byte
- **SC-006**: En macOS/Linux, analizar el proyecto VB sintético produce exactamente una advertencia de fidelidad reducida por proyecto VB por el canal de 007, y analizar el demo C# no produce ninguna advertencia nueva
- **SC-007**: La salida del corpus sintético valida contra el contrato JSON 1.0.0
- **SC-008**: El corpus sintético produce exactamente los endpoints ASMX y WCF esperados (5)
- **SC-009**: En un clon limpio sin corpus real, la construcción y la suite estándar completan en verde

## Clarifications

### Session 2026-10-08

- Q: ¿Qué corpus se usa en CI? → A: **Decisión del usuario (2026-10-08)**: se crean fixtures VB **sintéticos y redistribuibles** (formulario WinForms, módulo, acceso a datos ADO.NET con SQL literal y DataSet tipado, `app.config` con cadenas de conexión y secretos, clase de reporte, servicio ASMX/WCF) dentro de las pruebas para CI; las pruebas del corpus real siguen opcionales (categoría `Corpus`, excluida en CI) y solo se ejecutan si `test-for-demo/vb-demo-legacy` existe localmente. Se corrige la documentación de `VbCorpusSmokeTests`.
- Q: ¿Qué capa del catálogo reciben formularios y reportes, si el contrato no tiene "Presentación" ni "Reportes"? → A: `Web` (capa de presentación del catálogo), para no cambiar el contrato (FR-081). (default elegido por agente — confirmado por usuario 2026-10-09)
- Q: ¿Qué capa reciben los módulos VB? → A: `Compartida` salvo evidencia de datos (`Datos`) o de presentación. (default elegido por agente — confirmado por usuario 2026-10-09)
- Q: ¿Cómo se normalizan los nombres de tabla? → A: sin delimitadores ni prefijo de esquema, capitalización del literal, deduplicados sin distinguir mayúsculas. (default elegido por agente — confirmado por usuario 2026-10-09)
- Q: ¿Qué se considera "datos sensibles" en VB? → A: solo evidencia concreta: referencia a una credencial en texto plano de la configuración o secreto literal en código (más estrecho que el detector heurístico Java). (default elegido por agente — confirmado por usuario 2026-10-09)
- Q: ¿Qué tipos de servicio web VB se soportan? → A: ASMX (métodos web) y WCF (contratos de servicio, `WebGet`/`WebInvoke`); páginas WebForms no son endpoints de API. (default elegido por agente — confirmado por usuario 2026-10-09)
- Q: ¿`Option Strict Off` a nivel de proyecto (`.vbproj`) o por omisión del compilador genera issue? → A: No; solo la declaración explícita en archivo. El nivel de proyecto queda fuera de alcance. (default elegido por agente — confirmado por usuario 2026-10-09)
- Q: ¿Se cuentan `And`/`Or` (no cortocircuito) en la complejidad? → A: No; solo `AndAlso`/`OrElse`, en paralelo a `&&`/`||` de C#. (default elegido por agente — confirmado por usuario 2026-10-09)
- Q: ¿Qué hacer si la carga completa abre el `.vbproj` pero sin la biblioteca base (caso macOS/Linux con `Microsoft.VisualBasic.targets` importado)? → A: tratarlo como compilación inutilizable y usar la carga reducida (FR-065), porque la carga reducida resuelve al menos los tipos base del runtime del analizador y permite detectar enlace tardío; afecta solo a VB. (default elegido por agente — confirmado por usuario 2026-10-09)
- Q: ¿Por qué canal se informa la fidelidad reducida? → A: El de 007 (metadatos del resultado MCP y salida de error del CLI); el contrato JSON se mantiene en 1.0.0 sin `meta.warnings`. Solo se emite para proyectos VB, para no añadir advertencias a análisis C# existentes (FR-063). (default elegido por agente — confirmado por usuario 2026-10-09)

## Assumptions

- La carga de fidelidad completa de `.vbproj` legacy requiere Windows con Visual Studio Build Tools y la carga de trabajo VB (004); las pruebas automáticas se ejecutan en macOS/Linux con fidelidad reducida, por lo que los analizadores VB deben funcionar sin resolver tipos de .NET Framework.
- El corpus real `test-for-demo/vb-demo-legacy` no está disponible en el repositorio; los criterios del corpus real de 004 (SC-002..SC-004 de 004) se siguen verificando solo localmente.
- Los registros de contenedor DI en VB siguen fuera de alcance (no aplican al perfil objetivo; 004 *Deferred*).
- Las capas no influyen hoy en la inferencia de microservicios del motor; cambiar la capa de componentes VB no altera las propuestas salvo por su presentación.
