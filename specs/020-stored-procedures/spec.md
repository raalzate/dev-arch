# Feature Specification: Acceso a datos por stored procedures en .NET legacy

**Feature Branch**: `020-stored-procedures`
**Created**: 2026-10-30
**Status**: Draft
**Input**: User description: "Acceso a datos por stored procedures en proyectos .NET legacy (feature 015 del PLAN-VB-PLATAFORMA-LEGACY.md, sección 4): el motor reconoce invocaciones de procedimientos almacenados (Enterprise Library GetStoredProcCommand, ADO.NET CommandType.StoredProcedure + CommandText, ExecuteDataSet/ExecuteNonQuery/ExecuteScalar/ExecuteReader(db, "X"), Dapper commandType StoredProcedure) en VB y C#, las emite en tables_used con prefijo "sp:", permite un catálogo opcional sp→tablas (scripts .sql con CREATE PROCEDURE o CSV procedimiento,tabla,operación) que sustituye o complementa el sp:, heurística de entidad por nombre desactivada por defecto, y la inferencia Java trata sp:* como recurso de datos compartido con peso configurable. Activo por defecto solo en fuentes VB; en C# por --config dataAccess.procedures. Salidas Java/C# actuales byte-idénticas; doble corrida idéntica."

> Numeración: esta es la **feature 015 del plan** `PLAN-VB-PLATAFORMA-LEGACY.md`; en el repositorio recibe el número 020 porque los números 015-019 ya estaban tomados por ramas anteriores.

## Contexto

La feature 009 cerró el soporte estructural de VB.NET legacy: los componentes VB tienen tipos, invocaciones, LOC, métricas, issues y configuración. Las tablas de base de datos, sin embargo, solo se reconocen cuando el código contiene **SQL literal** (`SELECT`, `INSERT`, `UPDATE`, `DELETE`, `MERGE`) o DataSets tipados. El perfil tecnológico objetivo (aplicaciones .NET Framework de escritorio de 2005-2015, en VB o C#) no escribe SQL: **invoca procedimientos almacenados** a través de Enterprise Library, ADO.NET o Dapper. Sobre la referencia medida el 2026-10-30, el código invoca 909 procedimientos distintos en 950 llamadas y el análisis reporta `tables_used` en 1 de 1 110 componentes; la inferencia, que se apoya en los datos compartidos como señal principal, produce 102 propuestas de las que 93 tienen viabilidad "Baja".

Esta feature hace visible el acceso a datos por procedimientos: cada componente declara los procedimientos que invoca; si el usuario entrega un catálogo de procedimientos (los scripts de la base de datos o un export de dependencias), los procedimientos se traducen a las tablas reales; y la inferencia trata los procedimientos compartidos como trata hoy las tablas compartidas. Todo ello sin alterar ninguna salida existente de C# y Java (Constitución, principio I), de forma determinista (principio IV) y con degradación explícita cuando falta información (principio V).

Reglas transversales del plan (sección 4.0) que esta feature debe cumplir: las pasadas nuevas se activan por configuración y, por defecto, solo cuando la fuente analizada es VB; el contrato 1.0.0 no cambia (un procedimiento es una cadena más en `tables_used`); las salidas de referencia C# y Java siguen byte a byte idénticas; dos corridas consecutivas producen la misma salida.

## User Stories *(mandatory)*

### User Story 1 — Ver los procedimientos almacenados que invoca cada componente (Priority: P1)

Como arquitecto que evalúa un monolito .NET legacy, quiero que cada componente liste los procedimientos almacenados que invoca, con un prefijo que los distinga de las tablas, de modo que la propuesta de microservicios pueda agrupar componentes por los procedimientos que comparten aunque nadie me haya entregado el esquema de la base de datos.

**Why this priority**: Es la señal que hoy falta por completo en el perfil objetivo; sin ella el resto de la feature no tiene datos de entrada y la inferencia sigue ciega.

**Independent Test**: Analizar el corpus sintético VB de escritorio ampliado con invocaciones de procedimientos y comprobar que el componente de acceso a datos lista exactamente `sp:<nombre>` por cada procedimiento invocado, ordenados y sin duplicados.

**Acceptance Scenarios**:

1. **Given** un componente VB que obtiene un comando de procedimiento con la biblioteca de acceso a datos de Enterprise Library pasando el nombre como literal (`GetStoredProcCommand("usp_Policy_Read")`), **When** se analiza, **Then** su `tables_used` contiene `sp:usp_Policy_Read`
2. **Given** un componente VB que crea un comando ADO.NET, fija su tipo a procedimiento almacenado y asigna el nombre al texto del comando, **When** se analiza, **Then** su `tables_used` contiene `sp:<nombre>`
3. **Given** un componente VB que ejecuta un procedimiento por nombre a través de los métodos de ejecución de Enterprise Library (`ExecuteDataSet`, `ExecuteNonQuery`, `ExecuteScalar`, `ExecuteReader`) con el nombre como segundo argumento literal, **When** se analiza, **Then** su `tables_used` contiene `sp:<nombre>`
4. **Given** un componente que ejecuta una consulta con Dapper indicando tipo de comando procedimiento almacenado y el nombre como literal, **When** se analiza, **Then** su `tables_used` contiene `sp:<nombre>`
5. **Given** un nombre de procedimiento partido en literales concatenados (con continuación de línea), **When** se analiza, **Then** el procedimiento se reconoce con su nombre completo
6. **Given** un nombre de procedimiento con esquema o delimitadores (`[dbo].[usp_X]`, `dbo.usp_X`), **When** se analiza, **Then** se emite en forma canónica `sp:usp_X`, igual que las tablas se emiten sin esquema ni delimitadores
7. **Given** una invocación cuyo nombre de procedimiento no es un literal (variable, constante de otro tipo, parámetro), **When** se analiza, **Then** no se emite ningún procedimiento y el análisis emite una advertencia que identifica el componente y la línea
8. **Given** un componente que invoca el mismo procedimiento varias veces y además usa SQL literal, **When** se analiza, **Then** `tables_used` contiene cada procedimiento una sola vez junto a las tablas, en orden ordinal
9. **Given** un comando ADO.NET con tipo de comando texto (`SELECT ...`), **When** se analiza, **Then** no se emite ningún procedimiento (el texto se trata como SQL literal, como hoy)
10. **Given** los proyectos C# y Java de demostración del repositorio, **When** se analizan sin configuración, **Then** sus salidas son byte a byte idénticas a las anteriores a esta feature

---

### User Story 2 — Traducir procedimientos a tablas con un catálogo (Priority: P1)

Como arquitecto que sí dispone de los scripts de la base de datos (o de un export de dependencias de procedimientos), quiero entregarlos al análisis para que cada `sp:<nombre>` se traduzca a las tablas que el procedimiento lee o escribe, de modo que la propuesta se base en el modelo de datos real y no solo en nombres de procedimientos.

**Why this priority**: Sin catálogo, `sp:` mide acoplamiento por procedimiento compartido, que es válido pero no dibuja el modelo de datos; con catálogo la señal es la misma que en los sistemas con SQL literal. Es el criterio de precisión "media-alta" del plan.

**Independent Test**: Analizar el corpus sintético con un catálogo de scripts y con un catálogo CSV equivalentes y comprobar que el componente de acceso a datos lista las tablas reales de cada procedimiento, en ambos casos con la misma salida.

**Acceptance Scenarios**:

1. **Given** un catálogo en forma de carpeta de scripts SQL que definen procedimientos (`CREATE PROCEDURE` / `CREATE OR ALTER PROCEDURE` / `ALTER PROCEDURE`) cuyos cuerpos contienen sentencias sobre tablas, **When** se analiza un proyecto que invoca esos procedimientos, **Then** cada componente lista las tablas de los procedimientos que invoca
2. **Given** un catálogo en forma de archivo CSV con columnas `procedimiento,tabla,operación` (como el que se exporta de las dependencias del servidor de base de datos), **When** se analiza, **Then** cada componente lista las tablas de los procedimientos que invoca
3. **Given** un catálogo y el modo de resolución por defecto, **When** se analiza, **Then** `tables_used` contiene las tablas reales **y** conserva `sp:<nombre>` (modo complementar); **Given** el modo "sustituir", **Then** contiene solo las tablas y omite el `sp:`
4. **Given** un procedimiento invocado que no aparece en el catálogo, **When** se analiza, **Then** se conserva `sp:<nombre>` y se emite una advertencia con los procedimientos no resueltos, ordenados
5. **Given** un catálogo con dos definiciones del mismo procedimiento, **When** se analiza, **Then** se usa la definición del archivo con menor nombre en orden ordinal y se emite una advertencia que nombra ambos archivos
6. **Given** identificadores escritos de forma distinta en código y catálogo (`[dbo].[usp_X]`, `dbo.usp_X`, `USP_X`), **When** se analiza, **Then** se emparejan sin distinguir esquema, delimitadores ni mayúsculas
7. **Given** una ruta de catálogo que no existe o un CSV mal formado, **When** se analiza, **Then** el análisis continúa sin catálogo (solo `sp:`) y emite una advertencia que indica qué falló
8. **Given** un procedimiento del catálogo cuyo cuerpo invoca a su vez a otro procedimiento (`EXEC usp_Otro`), **When** se analiza, **Then** las tablas del procedimiento invocado se incluyen (resolución transitiva con protección frente a ciclos)
9. **Given** el mismo proyecto y catálogo analizados dos veces, **When** se comparan las salidas, **Then** son byte a byte idénticas (sin `collected_at`)

---

### User Story 3 — Inferir microservicios por procedimientos compartidos (Priority: P2)

Como arquitecto, quiero que la inferencia de microservicios trate los procedimientos compartidos como trata las tablas compartidas, con un peso que pueda ajustar, de modo que los componentes que operan sobre los mismos procedimientos acaben en la misma propuesta.

**Why this priority**: Es lo que convierte la nueva señal en valor para el usuario final (la propuesta); depende de US1.

**Independent Test**: Inferir sobre un grafo sintético en el que dos componentes comparten solo `sp:` y comprobar que caen en el mismo clúster con el peso por defecto y en clústeres distintos con peso cero.

**Acceptance Scenarios**:

1. **Given** dos componentes sin invocaciones entre sí que comparten dos procedimientos (`sp:usp_A`, `sp:usp_B`), **When** se infiere la arquitectura con la configuración por defecto, **Then** ambos pertenecen a la misma propuesta y el detector de datos los reporta como recursos de datos compartidos
2. **Given** la misma entrada con el peso de procedimientos fijado a cero por configuración, **When** se infiere, **Then** los procedimientos no influyen en la agrupación
3. **Given** un grafo sin ningún `sp:` (todos los proyectos de demostración actuales), **When** se infiere con la configuración por defecto, **Then** la salida es byte a byte idéntica a la anterior a esta feature
4. **Given** una propuesta cuyos componentes usan `sp:` y tablas, **When** se presenta, **Then** las tablas y los procedimientos aparecen separados y ordenados en los datos de la propuesta (los procedimientos reconocibles por su prefijo), sin campos nuevos en el contrato
5. **Given** la herramienta de re-inferencia con parámetros (`reinfer_architecture`), **When** se cambia el peso de procedimientos, **Then** la nueva propuesta refleja el cambio y la configuración aplicada queda registrada como hoy con el resto de parámetros

---

### User Story 4 — Activar la detección solo donde corresponde (Priority: P2)

Como responsable del producto, quiero que la detección de procedimientos esté activa por defecto en fuentes VB y apagada en C# y Java salvo activación explícita, de modo que ninguna salida existente cambie y aun así pueda analizar un C# legacy con Enterprise Library activándola por configuración.

**Why this priority**: Es la garantía de compatibilidad del plan (sección 4.0) y la condición de genericidad (el mismo perfil existe en C#).

**Independent Test**: Analizar el mismo proyecto C# legacy con y sin la activación por configuración y comprobar que sin ella la salida es idéntica a la actual y con ella aparecen los `sp:`.

**Acceptance Scenarios**:

1. **Given** un proyecto VB analizado sin configuración, **When** se analiza, **Then** la detección de procedimientos está activa
2. **Given** un proyecto C# analizado sin configuración, **When** se analiza, **Then** la detección está inactiva y la salida es idéntica a la actual
3. **Given** un proyecto C# analizado con la detección activada por configuración, **When** se analiza, **Then** sus componentes listan `sp:<nombre>` con las mismas reglas que VB (Enterprise Library, ADO.NET, Dapper)
4. **Given** un proyecto VB analizado con la detección desactivada por configuración, **When** se analiza, **Then** no se emite ningún `sp:` y el resto de la salida no cambia
5. **Given** cualquier combinación de activación, **When** se analiza, **Then** el estado efectivo de la detección se informa en la salida de diagnóstico del análisis (no en el contrato)

---

### User Story 5 — Agrupar procedimientos por entidad de negocio (Priority: P3)

Como arquitecto sin catálogo, quiero poder activar una heurística que deduzca la entidad de negocio a partir del nombre del procedimiento (`usp_Policy_Read` → `Policy`), de modo que las propuestas puedan nombrarse y agruparse por entidad aunque no conozca las tablas.

**Why this priority**: Es un último recurso explícito del plan; desactivada por defecto porque un nombre no es evidencia de modelo de datos.

**Independent Test**: Inferir con la heurística activada sobre componentes que invocan `usp_Policy_Read` y `usp_Policy_Update` y comprobar que la propuesta se nombra por `Policy`; con la heurística apagada, el nombre no se deriva de los procedimientos.

**Acceptance Scenarios**:

1. **Given** la heurística desactivada (por defecto), **When** se analiza e infiere, **Then** ningún dato de salida contiene entidades deducidas de nombres de procedimiento
2. **Given** la heurística activada y procedimientos con un prefijo y un verbo final reconocibles (`AMPsp_Policy_Read`, `usp_Policy_Update`, `sp_GetPolicy`), **When** se infiere, **Then** la entidad deducida (`Policy`) se usa para nombrar la propuesta que agrupa esos componentes
3. **Given** la heurística activada y un nombre sin estructura reconocible, **When** se infiere, **Then** no se deduce entidad para ese procedimiento y no se emite advertencia por cada uno (solo un recuento en diagnóstico)
4. **Given** la heurística activada, **When** se analiza, **Then** `tables_used` no cambia: la entidad nunca se presenta como tabla

---

### Edge Cases

- Nombre de procedimiento construido con variables o `String.Format`: no se emite procedimiento; una advertencia por componente y línea (US1.7).
- Procedimiento invocado con parámetros de salida o devolución de valor: el nombre se reconoce igual; los parámetros no se analizan.
- Un mismo literal usado como nombre de procedimiento y como texto de comando SQL en otra parte: cada uso se interpreta según su contexto de invocación.
- `CommandType.StoredProcedure` fijado en una instrucción y `CommandText` asignado en otro método del mismo tipo: se reconoce cuando ambos están en el mismo tipo; si están en tipos distintos no se emite (limitación documentada).
- Catálogo con scripts que definen tablas (`CREATE TABLE`), vistas o funciones además de procedimientos: solo se indexan los procedimientos; las vistas referenciadas por un procedimiento se emiten como tablas (no se resuelven a sus tablas base).
- CSV con columnas en otro orden o con cabecera ausente: se exige la cabecera `procedimiento,tabla,operación` (o su equivalente en inglés `procedure,table,operation`); en otro caso se rechaza con advertencia.
- Scripts del catálogo con codificaciones distintas (UTF-8 con y sin BOM, Latin-1): se leen como UTF-8 con sustitución de caracteres inválidos; los identificadores ASCII no se ven afectados.
- Ciclos entre procedimientos del catálogo (`usp_A` invoca `usp_B` que invoca `usp_A`): la resolución transitiva termina y no duplica tablas.
- Literal de nombre de procedimiento más largo que el límite de literal SQL (8192 caracteres): se ignora con la misma advertencia determinista que el SQL literal.
- Proyecto mixto C# + VB en un mismo directorio: la activación por defecto se decide por la fuente de cada compilación; la salida combinada mantiene el orden ordinal.
- Peso de procedimientos negativo o no numérico en la configuración: la configuración se rechaza con el mismo mecanismo de validación que el resto de parámetros de inferencia.

## Requirements *(mandatory)*

### Functional Requirements

**Reconocimiento de invocaciones (US1)**

- **FR-001**: El sistema MUST reconocer la invocación de un procedimiento almacenado cuando el nombre se pasa como literal (o concatenación de literales plegable) a la obtención de un comando de procedimiento de la biblioteca de acceso a datos de Enterprise Library (`GetStoredProcCommand`).
- **FR-002**: El sistema MUST reconocer la invocación cuando un comando ADO.NET tiene tipo de comando "procedimiento almacenado" y su texto de comando se asigna desde un literal (o concatenación plegable) dentro del mismo tipo.
- **FR-003**: El sistema MUST reconocer la invocación cuando se ejecuta un procedimiento por nombre literal a través de los métodos de ejecución de Enterprise Library (`ExecuteDataSet`, `ExecuteNonQuery`, `ExecuteScalar`, `ExecuteReader`) con el nombre como argumento de texto.
- **FR-004**: El sistema MUST reconocer la invocación cuando una consulta Dapper indica tipo de comando "procedimiento almacenado" y el texto es un literal.
- **FR-005**: El sistema MUST emitir cada procedimiento reconocido en `tables_used` del componente con el prefijo `sp:` seguido del nombre en forma canónica (sin esquema, sin delimitadores, con las mayúsculas del código), una sola vez por componente, en orden ordinal junto con las tablas.
- **FR-006**: El sistema MUST emitir una advertencia determinista (componente, archivo y línea) por cada invocación de procedimiento cuyo nombre no sea un literal plegable, sin emitir procedimiento.
- **FR-007**: El sistema MUST aplicar las mismas reglas de reconocimiento a código C# y VB.
- **FR-008**: El sistema MUST NOT interpretar como procedimiento el texto de un comando cuyo tipo es texto SQL; ese texto sigue el reconocimiento de SQL literal existente.

**Catálogo de procedimientos (US2)**

- **FR-010**: El sistema MUST aceptar, por configuración, un catálogo de procedimientos en una de dos formas: una carpeta (recursiva) de scripts SQL con definiciones de procedimientos, o un archivo CSV con cabecera `procedimiento,tabla,operación` (o `procedure,table,operation`).
- **FR-011**: Para los scripts, el sistema MUST indexar cada definición de procedimiento (`CREATE`, `CREATE OR ALTER`, `ALTER PROCEDURE`/`PROC`) y extraer las tablas de su cuerpo con la misma gramática de SQL literal que ya aplica al código, más las invocaciones a otros procedimientos (`EXEC`/`EXECUTE`) para resolución transitiva con protección frente a ciclos.
- **FR-012**: El sistema MUST normalizar los identificadores de procedimiento del código y del catálogo a una forma canónica común (sin esquema, sin delimitadores, comparación sin distinguir mayúsculas) antes de emparejarlos.
- **FR-013**: El sistema MUST leer los archivos del catálogo en orden ordinal de ruta y, ante definiciones duplicadas de un procedimiento, usar la del archivo de menor ruta ordinal y advertir nombrando los archivos implicados.
- **FR-014**: El sistema MUST ofrecer dos modos de resolución configurables: **complementar** (por defecto: tablas reales más `sp:<nombre>`) y **sustituir** (solo tablas reales).
- **FR-015**: El sistema MUST conservar `sp:<nombre>` para los procedimientos no encontrados en el catálogo y emitir una única advertencia que los liste ordenados.
- **FR-016**: Ante una ruta de catálogo inexistente, ilegible o un CSV sin la cabecera exigida, el sistema MUST continuar el análisis sin catálogo y emitir una advertencia que identifique la causa (principio V).
- **FR-017**: El sistema MUST NOT incluir en la salida valores del catálogo distintos de nombres de procedimientos y tablas (ni cuerpos de procedimientos, ni rutas absolutas).

**Inferencia (US3)**

- **FR-020**: El motor de inferencia MUST tratar cada entrada `sp:<nombre>` de `tables_used` como un recurso de datos compartido equivalente a una tabla en la detección de datos compartidos y en el agrupamiento, con un peso configurable (`dataAccess.procedureWeight`) cuyo valor por defecto es igual al de las tablas.
- **FR-021**: Con peso cero, los procedimientos MUST NOT influir en el agrupamiento ni en las métricas de las propuestas.
- **FR-022**: En las propuestas, el sistema MUST listar los procedimientos separados de las tablas y ordenados, usando el prefijo como único distintivo, sin añadir campos al contrato 1.0.0.
- **FR-023**: Sin ningún `sp:` en el grafo y sin configuración, la inferencia MUST producir exactamente la salida anterior a esta feature (línea base byte a byte).
- **FR-024**: La herramienta de re-inferencia con parámetros MUST aceptar el nuevo peso con la misma validación y registro que el resto de parámetros de inferencia.

**Activación (US4)**

- **FR-030**: La detección de procedimientos MUST poder activarse y desactivarse por configuración (`dataAccess.procedures`); su valor por defecto es "automático": activa cuando la compilación analizada es VB, inactiva en otro caso.
- **FR-031**: Sin configuración, las salidas de todos los proyectos de demostración C# y Java del repositorio MUST ser byte a byte idénticas a las anteriores a esta feature.
- **FR-032**: El sistema MUST informar el estado efectivo de la detección (activa/inactiva y por qué) en el diagnóstico del análisis, nunca en el contrato.

**Heurística de entidad (US5)**

- **FR-040**: El sistema MUST ofrecer, desactivada por defecto, una heurística (`dataAccess.entityHeuristic`) que deduzca la entidad de negocio del nombre de un procedimiento quitando un prefijo (`sp_`, `usp_`, `<marca>sp_`) y un verbo inicial o final de una lista fija documentada (`Get`, `Read`, `Select`, `List`, `Insert`, `Add`, `Create`, `Update`, `Save`, `Delete`, `Remove`, `Search`, `Find`, `Exists`, `Count`).
- **FR-041**: Con la heurística activa, la entidad deducida MUST usarse solo para nombrar y agrupar propuestas en la inferencia; MUST NOT emitirse en `tables_used` ni como tabla en ningún otro lugar.
- **FR-042**: Los nombres sin estructura reconocible MUST quedar sin entidad, con un único recuento en diagnóstico.

**Transversales**

- **FR-050**: Toda enumeración de archivos del catálogo y toda lista emitida MUST estar ordenada ordinalmente; las advertencias MUST estar ordenadas antes de emitirse; dos corridas consecutivas del mismo proyecto y catálogo MUST producir salidas byte a byte idénticas sin `collected_at`.
- **FR-051**: El corpus sintético VB redistribuible MUST ampliarse con invocaciones de procedimientos de cada forma reconocida, un catálogo de scripts y un catálogo CSV equivalentes, con casos positivos y negativos; su salida esperada MUST versionarse como archivo golden.
- **FR-052**: La documentación de VB legacy MUST describir el prefijo `sp:`, las formas reconocidas, el catálogo, los modos de resolución, la activación y las limitaciones.
- **FR-053**: Los criterios de salida sobre el corpus de referencia externo MUST verificarse en pruebas opt-in (categoría `Corpus`), nunca en integración continua.

### Key Entities

- **Invocación de procedimiento**: aparición en el código de una llamada a un procedimiento almacenado; atributos: componente, archivo, línea, nombre literal (o ausencia de literal), forma reconocida (Enterprise Library, ADO.NET, ejecución directa, Dapper).
- **Procedimiento canónico**: nombre normalizado (sin esquema ni delimitadores) que identifica un procedimiento en código y catálogo; se emite como `sp:<nombre>`.
- **Catálogo de procedimientos**: fuente opcional que asocia procedimientos canónicos con las tablas que leen o escriben y con los procedimientos que invocan; origen (scripts o CSV), archivos leídos, definiciones duplicadas, procedimientos no resueltos.
- **Recurso de datos compartido**: tabla o procedimiento usado por más de un componente; entrada del agrupamiento de la inferencia, con peso por tipo.
- **Entidad deducida**: nombre de negocio derivado del nombre de un procedimiento por la heurística opcional; solo influye en nombres y agrupación de propuestas.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En el corpus sintético VB ampliado, el 100 % de las invocaciones de procedimiento de las cuatro formas reconocidas producen su `sp:<nombre>`, y los casos negativos (nombre no literal, comando de texto, literal no relacionado) no producen ninguno.
- **SC-002**: En el corpus de referencia externo (prueba opt-in), al menos el 80 % de los componentes de acceso a datos (`*Adapter`) tienen `tables_used` no vacío (hoy 1 de 159) y se reconocen al menos 850 procedimientos distintos (hoy 0).
- **SC-003**: Con un catálogo que cubre todos los procedimientos del corpus sintético, el 100 % de los `sp:` se traducen a tablas y la salida es idéntica con el catálogo en scripts y en CSV.
- **SC-004**: Las salidas de los proyectos de demostración C# y Java (`test-for-demo/*`) y las líneas base del motor son byte a byte idénticas sin configuración.
- **SC-005**: Dos corridas consecutivas sobre el corpus sintético con catálogo producen salidas byte a byte idénticas (sin `collected_at`) en macOS y en la integración continua Linux.
- **SC-006**: En un grafo sintético donde dos componentes solo comparten procedimientos, la inferencia por defecto los agrupa en una propuesta y con peso cero los separa.
- **SC-007**: Ninguna advertencia emitida contiene rutas absolutas ni cuerpos de procedimientos.
- **SC-008**: El tiempo del análisis .NET sobre el corpus de referencia no aumenta más del 10 % con la detección activa y sin catálogo (hoy ~40 s).

## Clarifications

### Session 2026-10-30

Defaults tomados del plan (`PLAN-VB-PLATAFORMA-LEGACY.md`, secciones 4.0, 4 "Feature 015" y 7); pendientes de confirmación del usuario:

- Fuente del catálogo sp→tablas (decisión 7.1): se soportan ambas (scripts `.sql` y CSV); ninguna es obligatoria; sin catálogo se degrada a `sp:` con advertencia.
- Modo de resolución por defecto: **complementar** (tablas reales + `sp:`), porque conserva la señal de acoplamiento por procedimiento aun con catálogo parcial.
- Activación por defecto: automática por fuente (VB activa, C#/Java inactiva); C# legacy se activa con `dataAccess.procedures`.
- Peso de procedimientos por defecto igual al de tablas; configurable con `dataAccess.procedureWeight`.
- Heurística de entidad: desactivada por defecto; solo nombra/agrupa propuestas, nunca emite tablas.
- Contrato: se mantiene 1.0.0 (el prefijo `sp:` es una convención de valor); los cambios aditivos de contrato quedan para las features 016-018.
- Procedimientos invocados dentro del catálogo (`EXEC`): resolución transitiva con protección frente a ciclos.

## Assumptions

- Los procedimientos se identifican por nombre literal en el código; no se sigue el flujo de datos de variables ni constantes de otros tipos (misma limitación que el SQL literal de 009).
- Las vistas referenciadas por un procedimiento se emiten como tablas; no se resuelven a sus tablas base.
- El catálogo de scripts solo necesita contener las definiciones de procedimientos; otros objetos se ignoran.
- Las bibliotecas de acceso a datos no necesitan estar resueltas semánticamente (fidelidad reducida): el reconocimiento es sintáctico por nombre de método y argumentos, como el resto de pasadas VB.
- La ampliación de prompts de la web para VB desktop (plan 018.5) queda fuera de esta feature.
