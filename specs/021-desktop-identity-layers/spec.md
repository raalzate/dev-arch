# Feature Specification: Identidad, capas y puntos de entrada del perfil desktop .NET legacy

**Feature Branch**: `021-desktop-identity-layers`
**Created**: 2026-10-30
**Status**: Draft
**Input**: User description: "Identidad, capas y puntos de entrada del perfil desktop .NET legacy, con reglas de deuda (feature 016 del PLAN-VB-PLATAFORMA-LEGACY.md, sección 4): (1) el cargador VB de fidelidad reducida aplica <RootNamespace> e <Import> globales del .vbproj para que ningún componente quede sin namespace (229 en la referencia); (2) capas de escritorio por evidencia de herencia o archivo asociado, sin lista de marcas: formularios/controles → Presentación, reportes → Reportes, Module con Sub Main u <OutputType>Exe → Batch con punto de entrada legacy, *Validator → Negocio; (3) Option Strict Off a nivel de proyecto (<OptionStrict>Off) como issue por componente; (4) seis reglas de deuda legacy deterministas con flag debt.enabled: UI_CALL_IN_BUSINESS_LAYER, SQL_CONCAT_INJECTION, STATIC_FACADE, MIXED_TRANSACTION_MODELS, GOD_CLASS (umbrales configurables), PROJECT_OPTION_STRICT_OFF. Decisión 016.2 adoptada por defecto: opción (b) del plan — las capas finas Presentación/Reportes/Batch se exponen en annotations y se mapean a Web/Web/Negocio en el campo layer del contrato 1.0.0, sin bump de contrato (las líneas base y escenarios bloqueados de 005/008 exigen meta.schema_version 1.0.0); la opción (a) queda documentada. 016.5 (detection.maxDepth 2 por defecto) queda EXCLUIDO hasta decisión del usuario (§7.2) porque cambia el baseline v1.2.0 de dotnet-unstructured. Salidas C#/Java byte-idénticas; doble corrida idéntica; corpus sintético ampliado."

> Numeración: esta es la **feature 016 del plan** `PLAN-VB-PLATAFORMA-LEGACY.md`; en el repositorio recibe el número 021.

## Contexto

Sobre la referencia medida el 2026-10-30, 229 componentes VB (171 formularios) no tienen namespace porque el cargador de fidelidad reducida ignora el `<RootNamespace>` del proyecto, lo que producirá colisiones de identidad al analizar el corpus completo; 171 formularios aparecen en la capa "Web" porque el catálogo de capas no distingue presentación de escritorio; ningún proceso de consola (`Module` con `Sub Main`) se reconoce como punto de entrada; los 4 proyectos con `Option Strict Off` a nivel de proyecto no producen issue; y los patrones de deuda típicos de la plataforma (mensajes de UI en capas de negocio, SQL concatenado, fachadas estáticas, modelos de transacción mezclados, clases dios) no se detectan.

Esta feature cierra esos huecos **sin cambiar el contrato 1.0.0**: la capa fina del perfil de escritorio (Presentación, Reportes, Batch) viaja en `annotations` (lista abierta de cadenas) y se proyecta a los valores existentes de `layer`; el punto de entrada por lotes se expone como anotación del componente y como `legacy_entrypoint` de la propuesta que lo contiene; las reglas de deuda son issues con los campos existentes. Las pasadas nuevas se activan por configuración y por defecto solo en fuentes VB (regla 4.0 del plan). Queda fuera, hasta decisión del usuario (§7.2 del plan), cambiar el valor por defecto de `detection.maxDepth`: alteraría la línea base de `dotnet-unstructured`.

## User Stories *(mandatory)*

### User Story 1 — Identidad completa de los componentes VB (Priority: P1)

Como arquitecto, quiero que cada componente VB tenga su nombre completamente calificado aunque el análisis sea de fidelidad reducida, de modo que dos clases con el mismo nombre simple en proyectos distintos no colisionen y las propuestas nombren dominios reales.

**Why this priority**: Sin identidad estable, el resto del análisis (aristas, propuestas, deuda) atribuye hallazgos al componente equivocado; es prerrequisito de 018.

**Independent Test**: Analizar un proyecto sintético cuyo `.vbproj` declara `<RootNamespace>` y clases sin `Namespace` explícito y comprobar que los ids llevan el namespace raíz; con dos proyectos que declaran la misma clase simple bajo raíces distintas, los ids son distintos.

**Acceptance Scenarios**:

1. **Given** un `.vbproj` con `<RootNamespace>Acme.Policies</RootNamespace>` y un archivo con `Public Class PolicyForm` sin bloque `Namespace`, **When** se analiza con fidelidad reducida, **Then** el componente se identifica como `Acme.Policies.PolicyForm`
2. **Given** el mismo proyecto y un archivo con `Namespace Forms` explícito, **When** se analiza, **Then** el componente se identifica como `Acme.Policies.Forms.PolicyForm` (el namespace explícito se anida bajo la raíz, como hace el compilador)
3. **Given** dos proyectos en el mismo directorio raíz con `<RootNamespace>` distintos y una clase `Helper` en cada uno, **When** se analizan juntos, **Then** hay dos componentes con ids distintos y ninguna advertencia de identidad duplicada
4. **Given** un `.vbproj` sin `<RootNamespace>` (o vacío), **When** se analiza, **Then** los ids son los de hoy (sin prefijo) y las salidas no cambian
5. **Given** un `.vbproj` con `<Import Include="System.Data" />` global y código que usa `CommandType.StoredProcedure` sin `Imports`, **When** se analiza con fidelidad reducida, **Then** el tipo se resuelve y no aparece el aviso de árbol de operaciones de BUG-001
6. **Given** el corpus de referencia (prueba opt-in), **When** se analiza, **Then** 0 componentes sin namespace (hoy 229)

---

### User Story 2 — Capas y puntos de entrada del perfil desktop (Priority: P1)

Como arquitecto, quiero que los formularios, controles, reportes y procesos por lotes de una aplicación de escritorio se reconozcan como tales por evidencia (herencia, archivo asociado, tipo de salida del proyecto) y no por una lista de marcas, de modo que la propuesta distinga interfaz, reportes, lotes y negocio.

**Why this priority**: Es el contexto de modernización (qué es UI, qué es batch) que 018 necesita para excluir la presentación de la cohesión y tratar los lotes como puntos de entrada.

**Independent Test**: Analizar el proyecto sintético de escritorio y un proyecto de consola sintético y comprobar la anotación de capa fina, la capa del contrato y el punto de entrada por lotes.

**Acceptance Scenarios**:

1. **Given** una clase que hereda (directa o transitivamente) de un tipo cuyo nombre termina en `Form`, `UserControl`, `XtraForm`, `XtraUserControl` o `WaitForm`, o que tiene un archivo hermano `<Nombre>.Designer.vb`, **When** se analiza, **Then** el componente lleva la anotación `Layer:Presentación` y su `layer` del contrato es `Web`
2. **Given** una clase que hereda de un tipo cuyo nombre contiene `Report` o `ActiveReport`, o un proyecto con un archivo `.rdlc` del mismo nombre, o una clase que usa `LocalReport`, **When** se analiza, **Then** el componente lleva `Layer:Reportes` y su `layer` es `Web`
3. **Given** un `Module` con un procedimiento `Sub Main` o un proyecto con `<OutputType>Exe</OutputType>` cuyo objeto de inicio es ese módulo, **When** se analiza, **Then** el componente lleva `Layer:Batch` y `EntryPoint:Main`, su `layer` es `Negocio`, y la propuesta que lo contiene declara un `legacy_entrypoint` de tipo `internal` (el catálogo del contrato 1.0.0 es cerrado) con ese componente como clase de entrada, la operación `Main` y una descripción que lo identifica como proceso por lotes
4. **Given** una clase cuyo nombre termina en `Validator` o pertenece a un proyecto `*.Validators`, **When** se analiza, **Then** su `layer` es `Negocio`
5. **Given** un formulario que la regla de 009 ya clasificaba como `Web`, **When** se analiza, **Then** su `layer` sigue siendo `Web` (sin cambios en el contrato) y gana la anotación de capa fina
6. **Given** los proyectos C# y Java de demostración, **When** se analizan sin configuración, **Then** sus salidas son byte a byte idénticas a las anteriores

---

### User Story 3 — Option Strict Off a nivel de proyecto (Priority: P2)

Como arquitecto, quiero que un proyecto compilado con `Option Strict Off` se refleje en cada uno de sus componentes, de modo que la deuda de tipado relajado no quede oculta cuando los archivos no la declaran.

**Why this priority**: 4 de los 14 proyectos de la referencia la declaran a nivel de proyecto y hoy solo se ve la declaración por archivo (31 casos).

**Independent Test**: Analizar un proyecto sintético con `<OptionStrict>Off</OptionStrict>` y comprobar un issue por componente del proyecto; con `<OptionStrict>On</OptionStrict>` o sin la propiedad, ninguno.

**Acceptance Scenarios**:

1. **Given** un `.vbproj` con `<OptionStrict>Off</OptionStrict>` y tres clases, **When** se analiza, **Then** cada componente reporta un issue `PROJECT_OPTION_STRICT_OFF` con severidad `WARNING` y sin línea (ubicación: el archivo de proyecto)
2. **Given** un archivo que además declara `Option Strict Off`, **When** se analiza, **Then** el componente reporta ambos issues (`OPTION_STRICT_OFF` por archivo y `PROJECT_OPTION_STRICT_OFF` por proyecto)
3. **Given** `<OptionStrict>On</OptionStrict>` o ausencia de la propiedad, **When** se analiza, **Then** no se reporta `PROJECT_OPTION_STRICT_OFF`

---

### User Story 4 — Reglas de deuda legacy (Priority: P2)

Como arquitecto, quiero detectar los patrones de deuda característicos de la plataforma con reglas deterministas y sintácticas, de modo que 018 pueda ponderar la viabilidad con un índice de deuda y yo pueda priorizar refactorizaciones.

**Why this priority**: Son los hallazgos que un cliente espera ver; alimentan `debt_score` (018).

**Independent Test**: Analizar un proyecto sintético con un caso positivo y uno negativo por regla y comprobar exactamente los issues emitidos.

**Acceptance Scenarios**:

1. **Given** una invocación `MsgBox(...)` o `MessageBox.Show(...)` en un componente cuya capa fina no es Presentación, **When** se analiza, **Then** el componente reporta `UI_CALL_IN_BUSINESS_LAYER` (`WARNING`) en esa línea; en un formulario no se reporta
2. **Given** una asignación de texto de comando (`CommandText`, `GetSqlStringCommand`, `New SqlCommand(...)`) cuyo valor concatena una variable o expresión no literal, **When** se analiza, **Then** el componente reporta `SQL_CONCAT_INJECTION` (`CRITICAL`) en esa línea; con parámetros (`@p`) y literal completo no se reporta
3. **Given** una clase cuyos miembros son todos `Shared` y con al menos un campo `Shared` no `ReadOnly` ni constante, **When** se analiza, **Then** reporta `STATIC_FACADE` (`INFO`); un `Module` (estático por definición) no se reporta
4. **Given** un componente que usa `BeginTransaction`/`DbTransaction` y también `TransactionScope`, **When** se analiza, **Then** reporta `MIXED_TRANSACTION_MODELS` (`WARNING`); con un solo modelo no
5. **Given** un tipo con más de 1 000 líneas de código efectivas y complejidad máxima mayor que 15 (umbrales por defecto, configurables), **When** se analiza, **Then** reporta `GOD_CLASS` (`WARNING`) con ambos valores en el mensaje; con uno solo de los dos no
6. **Given** la configuración `debt.enabled = false`, **When** se analiza un proyecto VB, **Then** no se emite ninguna de las seis reglas y el resto de la salida no cambia; **Given** un proyecto C# sin configuración, **Then** tampoco (activo por defecto solo en fuentes VB)
7. **Given** el mismo proyecto analizado dos veces, **When** se comparan, **Then** las salidas son byte a byte idénticas

---

### Edge Cases

- `<RootNamespace>` con espacios o caracteres inválidos: se ignora con advertencia de diagnóstico y los ids quedan como hoy.
- Clase que hereda de un tipo propio del proyecto que a su vez hereda de `Form`: la herencia se sigue por la cadena sintáctica del proyecto (como ya hace 009).
- `Designer.vb` huérfano (sin clase principal): no produce componente ni anotación.
- Proyecto `Exe` sin `Sub Main` (inicio por formulario, `<StartupObject>`): el formulario de inicio no es Batch; no se emite punto de entrada por lotes.
- Varios `Sub Main` en distintos módulos: cada módulo es Batch; la propuesta toma como clase de entrada la de menor id ordinal.
- `MsgBox` en un `Module` de utilidades compartido: se reporta (no es Presentación).
- Concatenación de literales solamente (`"SELECT " & "FROM T"`): no es `SQL_CONCAT_INJECTION`.
- Clase con miembros `Shared` y un constructor de instancia vacío: cuenta como fachada estática solo si no hay otros miembros de instancia.
- Umbrales de `GOD_CLASS` inválidos en la configuración (negativos): rechazados por la validación de configuración como el resto.
- Proyectos mixtos C# + VB: las reglas se aplican por compilación según la fuente.

## Requirements *(mandatory)*

### Functional Requirements

**Identidad (US1)**

- **FR-001**: Al compilar un proyecto VB con fidelidad reducida, el sistema MUST aplicar el `<RootNamespace>` declarado en el archivo de proyecto como espacio de nombres raíz, de modo que los tipos sin `Namespace` explícito se identifiquen bajo él y los explícitos se aniden bajo él.
- **FR-002**: El sistema MUST aplicar los `<Import Include="…">` globales del archivo de proyecto como importaciones de la compilación.
- **FR-003**: Sin `<RootNamespace>` (o vacío), la identidad MUST ser la actual.
- **FR-004**: Un valor de `<RootNamespace>` que no sea un identificador calificado válido MUST ignorarse con un diagnóstico de análisis (no una advertencia de usuario).

**Capas y puntos de entrada (US2)**

- **FR-010**: El sistema MUST clasificar como Presentación los tipos que heredan (por símbolo o por la cadena sintáctica del proyecto) de un tipo cuyo nombre termina en `Form`, `UserControl`, `XtraForm`, `XtraUserControl` o `WaitForm`, o que tienen un archivo hermano `<Nombre>.Designer.vb`.
- **FR-011**: El sistema MUST clasificar como Reportes los tipos que heredan de un tipo cuyo nombre contiene `Report`, que usan `LocalReport`, o que tienen un archivo `<Nombre>.rdlc` en el proyecto.
- **FR-012**: El sistema MUST clasificar como Batch los `Module` con un procedimiento `Sub Main` y marcar el componente como punto de entrada (`EntryPoint:Main`); un proyecto `<OutputType>Exe</OutputType>` cuyo `<StartupObject>` sea ese módulo refuerza la clasificación.
- **FR-013**: El sistema MUST clasificar como Negocio los tipos cuyo nombre termina en `Validator` o que pertenecen a un proyecto cuyo nombre termina en `.Validators`.
- **FR-014**: La capa fina MUST emitirse como anotación `Layer:<Presentación|Reportes|Batch>` del componente y proyectarse en `layer` como `Web` (Presentación, Reportes) o `Negocio` (Batch), sin añadir valores al catálogo del contrato 1.0.0.
- **FR-015**: Una propuesta que contenga un componente `EntryPoint:Main` MUST declarar `legacy_entrypoint` de tipo `internal` (único valor del catálogo cerrado 1.0.0 aplicable), con el componente de menor id ordinal como clase de entrada, `Main` como operación expuesta y una descripción determinista que lo identifica como proceso por lotes; no se añaden valores al catálogo `type`.
- **FR-016**: Las reglas de capa de 009 MUST conservarse; la capa fina solo añade anotaciones y nunca cambia un `layer` existente salvo Validator → Negocio y Batch → Negocio (hoy `Compartida`).

**Option Strict de proyecto (US3)**

- **FR-020**: El sistema MUST emitir `PROJECT_OPTION_STRICT_OFF` (`CODE_STYLE`, `WARNING`, sin línea, ubicación = archivo de proyecto) en cada componente de un proyecto con `<OptionStrict>Off</OptionStrict>`.

**Reglas de deuda (US4)**

- **FR-030**: El sistema MUST ofrecer la configuración `debt.enabled` (`auto` por defecto: activo solo en compilaciones VB; `on`; `off`) y `debt.godClass.minLoc` (1000) y `debt.godClass.minComplexity` (15), validadas como el resto de parámetros y transportadas al analizador por el mismo mecanismo que `dataAccess` (020).
- **FR-031**: `UI_CALL_IN_BUSINESS_LAYER` (`BUG_PATTERN`, `WARNING`): invocación `MsgBox`/`MessageBox.Show`/`InputBox` en un componente cuya capa fina no es Presentación.
- **FR-032**: `SQL_CONCAT_INJECTION` (`SECURITY`, `CRITICAL`): texto de comando (`CommandText =`, `GetSqlStringCommand(`, `New *Command(`) cuyo valor plegado contiene al menos un literal con una palabra clave SQL y al menos una parte no literal.
- **FR-033**: `STATIC_FACADE` (`CODE_STYLE`, `INFO`): clase (no `Module`) cuyos métodos y propiedades son todos `Shared` y con al menos un campo `Shared` mutable.
- **FR-034**: `MIXED_TRANSACTION_MODELS` (`BUG_PATTERN`, `WARNING`): el mismo componente menciona `BeginTransaction` o un tipo `*DbTransaction`/`SqlTransaction` y también `TransactionScope`.
- **FR-035**: `GOD_CLASS` (`CODE_STYLE`, `WARNING`): LOC del componente > `minLoc` y complejidad máxima > `minComplexity`; mensaje con ambos valores.
- **FR-036**: Todas las reglas MUST ser sintácticas (funcionan en fidelidad reducida), deterministas y emitir los issues ordenados como el resto (ubicación, regla).

**Transversales**

- **FR-040**: Sin configuración, las salidas de los proyectos de demostración C# y Java MUST ser byte a byte idénticas a las anteriores; con `debt.enabled = off` y sin `<RootNamespace>`, las salidas VB de 009/020 MUST ser idénticas a las anteriores salvo las anotaciones de capa fina.
- **FR-041**: Dos corridas consecutivas MUST producir salidas byte a byte idénticas.
- **FR-042**: El corpus sintético MUST ampliarse con un proyecto de escritorio con `<RootNamespace>`, formularios heredados, reporte, módulo `Sub Main`, validador, `<OptionStrict>Off` y un caso positivo y uno negativo por regla de deuda; su salida esperada MUST versionarse como golden.
- **FR-043**: La documentación VB MUST describir la capa fina, el punto de entrada por lotes, el issue de proyecto y las seis reglas; la guía de configuración MUST listar la sección `debt`.
- **FR-044**: El valor por defecto de `detection.maxDepth` MUST NOT cambiar en esta feature (decisión pendiente §7.2 del plan).

### Key Entities

- **Proyecto VB**: archivo `.vbproj`; atributos relevantes: `RootNamespace`, `Import` globales, `OptionStrict`, `OutputType`, `StartupObject`, archivos `.rdlc` y `.Designer.vb`.
- **Capa fina**: Presentación | Reportes | Batch; anotación del componente, proyectada al `layer` del contrato.
- **Punto de entrada por lotes**: componente `Module` con `Sub Main`; anotación `EntryPoint:Main`; `legacy_entrypoint` de tipo `internal` (descripción de proceso por lotes) en la propuesta.
- **Regla de deuda**: identificador, tipo, severidad, condición sintáctica, umbrales (solo `GOD_CLASS`), activación por `debt.enabled`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Corpus de referencia (opt-in): 0 componentes sin namespace entre los proyectos que declaran `<RootNamespace>` (3 de los 14 lo declaran; los demás son globales también para el compilador); ≥ 90 % de los componentes de los proyectos `*.Win.*` con `Layer:Presentación` o `Layer:Reportes` (medido 94 %: el resto son clases auxiliares); los módulos de consola con `Layer:Batch` y `EntryPoint:Main`; aristas entre proyectos conservadas (≥ 90 % de las 1 249 actuales).
- **SC-002**: Corpus sintético: cada regla de deuda tiene un caso positivo y uno negativo que producen exactamente los issues esperados; `PROJECT_OPTION_STRICT_OFF` en el 100 % de los componentes del proyecto marcado.
- **SC-003**: Salidas de `test-for-demo/*` y líneas base byte a byte idénticas sin configuración.
- **SC-004**: Dos corridas consecutivas byte a byte idénticas sobre el corpus sintético (CI) y la referencia (opt-in).
- **SC-005**: `meta.schema_version` sigue siendo `1.0.0` en todas las salidas; ningún valor nuevo en `layer`.
- **SC-006**: Tiempo del análisis .NET de la referencia ≤ +10 % con las reglas activas.

## Clarifications

### Session 2026-10-30

- Punto de entrada por lotes: `legacy_entrypoint.type` es un catálogo cerrado (`rest`, `messaging`, `service`, `internal`); el proceso por lotes usa `internal` con `exposed_operations = [Main]` y descripción explícita.
- Capas nuevas (plan 016.2): se adopta la **opción (b)** del plan (anotaciones + proyección a `Web`/`Negocio`) porque los escenarios bloqueados de 005 y 008 y las líneas base exigen `meta.schema_version = 1.0.0` en toda salida; la opción (a) (contrato 1.1.0 con tres capas) queda documentada para cuando se abra una versión de contrato. `Batch` se proyecta a `Negocio` (hoy `Compartida` para módulos): cambio solo visible en fuentes VB.
- `detection.maxDepth` por defecto (plan 016.5): **excluido**; cambiaría la línea base de `dotnet-unstructured` (analizado hoy como Java sin componentes). Requiere decisión del usuario (§7.2).
- Activación de las reglas de deuda: `debt.enabled = auto` (solo VB) siguiendo la regla 4.0 del plan.
- Umbrales de `GOD_CLASS`: 1000 LOC y complejidad 15 (plan), configurables.

## Assumptions

- La herencia se resuelve por símbolo cuando existe y por la cadena sintáctica del proyecto cuando no (misma técnica que 009).
- Los nombres de tipos de terceros (`XtraForm`, `ActiveReport`) se reconocen por sufijo de nombre, no por ensamblado: funciona sin resolver DevExpress ni ActiveReports.
- La web ya etiqueta `Web` como "Presentación (formularios y reportes)" para VB; mostrar la anotación de capa fina queda para 018 junto con el índice de deuda.
