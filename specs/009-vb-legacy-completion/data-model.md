# Data Model: Cierre de VB.NET legacy

Sin entidades persistentes nuevas. El modelo de salida es el `Component`/`ApiEndpoint` existente (contrato 1.0.0). Este documento fija las reglas de derivación de cada campo para componentes VB.

## Campos afectados (solo componentes VB)

| Campo | Antes (004) | Ahora (009) | Fuente |
|-------|-------------|-------------|--------|
| `tables_used` | `[]` | tablas de SQL literal + DataSets tipados | `VbTableExtractor` |
| `cbo`, `lcom` | ausentes | calculados | `VbMetricsCalculator` |
| `complexity_max`, `complexity_avg` | ausentes | calculados si hay métodos | `VbMetricsCalculator` |
| `secrets_references` | `[]` | `ConfigurationManager`, `ConfigurationSettings`, `config:ConnectionStrings:<n>`, `config:<clave>` | `VbSecretsDetector` |
| `sensitive_data` | `false` | `true` con credencial en texto plano referenciada o `HARDCODED_SECRET_IN_CODE` | `VbSecretsDetector`, `VbCodeAnalyzer` |
| `code_issues` | `[]` | reglas VB + generales + complejidad + configuración | varios |
| `layer` | general (004) | reglas de escritorio (FR-040) | `VbLayerClassifier` |
| `api_contracts.endpoints` | `[]` | ASMX/WCF | `VbEndpointExtractor` |
| `meta.source` | `roslyn` con fallback por proyecto | `roslyn-fallback` si algún proyecto VB usó Adhoc | `ProjectAnalyzer` |

## §SQL — Reconocimiento y normalización

Texto plegado `T` (concatenación de literales; partes no literales → `\u0001`). Insensible a mayúsculas; espacios = cualquier espacio en blanco incluido salto de línea.

`tableRef := ( '[' [^\]]+ ']' | '"' [^"]+ '"' | '`' [^`]+ '`' | [A-Za-z_][A-Za-z0-9_$]* ) ( '.' tableRefPart )*` (hasta 4 partes).

| Sentencia | Condición de reconocimiento (sobre `T` recortado) | Tablas |
|-----------|---------------------------------------------------|--------|
| SELECT | `^SELECT\s+<lista>\s+FROM\s+<tableRef>`; `<lista>` es `*`, o contiene `,` `.` `(` `*`, o ` AS `, o empieza por `TOP`/`DISTINCT`, o es un solo token | todas las `FROM <tableRef>` y `JOIN <tableRef>` |
| INSERT | `^INSERT\s+INTO\s+<tableRef>\s*(\(|VALUES\b|SELECT\b|DEFAULT\s+VALUES\b|$)` | destino + `FROM`/`JOIN` |
| UPDATE | `^UPDATE\s+<tableRef>\s+SET\s` | destino + `FROM`/`JOIN` |
| DELETE | `^DELETE\s+(TOP\s*\(\s*\d+\s*\)\s+)?FROM\s+<tableRef>\s*(WHERE\b|OUTPUT\b|;|$)` | destino + `FROM`/`JOIN` |
| MERGE | `^MERGE\s+(TOP\s*\(\s*\d+\s*\)\s+)?(INTO\s+)?<tableRef>(\s+(AS\s+)?\w+)?\s+USING\s+` | destino + `USING <tableRef>` + `FROM`/`JOIN` |

Exclusiones: `tableRef` seguido de `(` (función de tabla), que empieza por `#` (temporal) o `@` (variable), o cuyo nombre simple sin delimitar es palabra reservada (`SELECT`, `WHERE`, `SET`, `VALUES`, `ON`, `AS`, `JOIN`, `INNER`, `LEFT`, `RIGHT`, `OUTER`, `CROSS`, `FULL`, `GROUP`, `ORDER`, `BY`, `HAVING`, `UNION`, `INTO`, `FROM`, `USING`, `WITH`, `TOP`, `DISTINCT`). `EXEC`/`EXECUTE`/procedimientos: no reconocidos.

Normalización: última parte de `tableRef`, sin delimitadores, recortada. Deduplicación insensible a mayúsculas (primera aparición); orden final ordinal (lo aplica `ProjectAnalyzer`).

## §DataSet tipado (`.xsd`)

```
TypedDataSet { File, Adapters: [ { ClassName, Table } ], DataTables: [ { ClassName, Table } ] }
```

- `TableAdapter@Name` = `N`; `ClassName` = `@GeneratorDataComponentClassName` ?? `@DataAccessorName` ?? `N + "TableAdapter"`.
- `Table` = normalizar(`DbSource@DbObjectName`) ?? primera tabla de `DbSource/CommandText` (§SQL) ?? `N`.
- `xs:element[@msprop:Generator_TableClassName]` = clase de tabla tipada; `Table` = `Table` del adaptador con el mismo `Name` que el elemento ?? nombre del elemento.
- XML inválido → `[WARN] VbTableExtractor: could not read typed DataSet '<archivo>': <motivo>` y se ignora el archivo. DTD deshabilitada.

## §Métricas

- **CBO**: tipos con nombre (`INamedTypeSymbol`) distintos referenciados en el bloque de tipo vía: creación de objetos, `As` de variables/campos/parámetros/propiedades, tipo de retorno de `Function`, tipo contenedor del método invocado, `Inherits`/`Implements`. Excluidos: el propio tipo, `System.*`, `Microsoft.*`, tipos `TypeKind.Error`.
- **LCOM** (Henderson-Sellers, igual que C#): `F` = nombres declarados en `FieldDeclaration` del tipo; `M` = bloques `Sub`/`Function` de instancia (sin `Shared`; en módulos todos son compartidos → `M = 0`); acceso = `IdentifierName` con el nombre del campo sin distinguir mayúsculas; `M ≤ 1` o `F = 0` → `0.0`; resultado acotado a `[0, 1]`.
- **Complejidad** por bloque `Sub`/`Function` (no `Sub New`, propiedades ni operadores, igual que C#): `1 + #MultiLineIf + #ElseIf + #SingleLineIf + #While + #Do…Loop + #For + #For Each + #Catch + #If(c,a,b) + #cláusulas Case (no Case Else) + #AndAlso + #OrElse`.
- **HIGH_CYCLOMATIC_COMPLEXITY**: `> 15` → `ERROR`, `> 10` → `WARNING`; tipo `CODE_STYLE`; mensaje `Method '<nombre>' cyclomatic complexity <cc> exceeds <umbral>`; línea del inicio del bloque.

## §Configuración

```
AppConfiguration { Files: [nombre], ConnectionStrings: { nombre → valor }, Settings: { clave → valor } }
```

- Fuentes: `configuration/connectionStrings/add@name,@connectionString`; `configuration/appSettings/add@key,@value`; `configuration/applicationSettings/*/setting@name/value` y `userSettings` (ajustes tipados de `My.Settings`). Primer valor gana (archivos en orden ordinal de nombre).
- Credencial en texto plano: cadena de conexión con par `Password`/`Pwd` (sin distinguir mayúsculas) de valor no vacío; ajuste cuya clave contiene `connectionstring` → misma regla de cadena de conexión; otro ajuste cuya clave contiene `password`, `passwd`, `secret`, `apikey`, `api_key`, `token`, `accesstoken`, `access_token` con valor no vacío.
- Referencias desde código (literal de nombre/clave): `ConfigurationManager.ConnectionStrings("n")` (`.Item("n")`) → `config:ConnectionStrings:n`; `ConfigurationManager.AppSettings("k")` (`.Item`, `.Get`) y `ConfigurationSettings.AppSettings("k")` → `config:k`; `My.Settings.k` → `config:k`; uso del identificador `ConfigurationManager`/`ConfigurationSettings` → ese nombre.
- Issue: `PLAINTEXT_SECRET_IN_CONFIG`, `SECURITY`, `CRITICAL`, mensaje `Configuration entry '<referencia>' is stored as a plaintext credential in <archivo>. Move it to a protected configuration section or a secret store.` (sin valores), línea de la referencia.

## §Code issues VB

| Regla | Tipo | Severidad | Disparador |
|-------|------|-----------|-----------|
| `ON_ERROR_RESUME_NEXT` | BUG_PATTERN | WARNING | `On Error Resume Next` |
| `OPTION_STRICT_OFF` | CODE_STYLE | WARNING | `Option Strict Off` explícito; un issue por componente declarado en el archivo, línea de la opción |
| `GOTO_STATEMENT` | CODE_STYLE | INFO | `GoTo etiqueta` |
| `LATE_BINDING` | BUG_PATTERN | WARNING | operación dinámica o `CreateObject`/`GetObject`; uno por línea |
| `EMPTY_CATCH_BLOCK` | BUG_PATTERN | WARNING | `Catch` sin sentencias |
| `CATCH_GENERIC_EXCEPTION` | BUG_PATTERN | INFO | `Catch x As Exception|SystemException` |
| `MISSING_SWITCH_DEFAULT` | BUG_PATTERN | INFO | `Select Case` sin `Case Else` |
| `HARDCODED_SECRET_IN_CODE` | BUG_PATTERN | CRITICAL | declarador con nombre de secreto e inicializador literal de texto no vacío |
| `HIGH_CYCLOMATIC_COMPLEXITY` | CODE_STYLE | WARNING/ERROR | §Métricas |
| `PLAINTEXT_SECRET_IN_CONFIG` | SECURITY | CRITICAL | §Configuración |

Mensajes en inglés, como C#. `Location` interno = `<archivo>:<línea>` (no serializado), orden = `(Location, Rule)` ordinal, como C#.

## §Capas VB (FR-040)

1. clasificación general = `Controlador`, o el componente es servicio ASMX (`Inherits WebService` o atributo `WebService`) o implementa/declara un contrato WCF → `Controlador`
2. formulario: alguna base (sintaxis `Inherits` o cadena de símbolos) se llama `Form`/`UserControl`, o el nombre termina en `Form` (ordinal) o empieza por `frm` + mayúscula/`_` → `Web`
3. reporte: base `ReportClass`/`ReportDocument`/`XtraReport`/`LocalReport`/`SectionReport`, o nombre termina en `Report`/`Reporte` (sin distinguir mayúsculas) o empieza por `rpt` + mayúscula/`_` → `Web`
4. nombre termina en `Controller` → `Negocio`
5. `tables_used` no vacío, o sufijos `Repository`, `Data`, `Dao`, `Adapter`, `DataAccess`, `DataLayer`, `TableAdapter` (sin distinguir mayúsculas) o `DAL`/`Dal` (ordinal), o base `DataSet`/`DataTable` → `Datos`
6. módulo → `Compartida`
7. en otro caso: clasificación general
Interfaces: clasificación general siempre.

## §Endpoints VB

- ASMX: clase con `Inherits [..]WebService` o atributo `WebService`; métodos con atributo `WebMethod` y sin `Private`/`Protected`/`Friend` → `POST /<Clase>.asmx/<Método>`.
- WCF: contrato = interfaz (o clase) con atributo `ServiceContract`; operaciones = métodos con `OperationContract`; clases propietarias = clases que implementan la interfaz (símbolos; respaldo: nombre simple en `Implements`), o la propia interfaz si no hay ninguna, o la propia clase si el contrato es una clase.
  - `WebGet(UriTemplate:="t")` → `GET`, ruta `/<Clase>.svc/<t sin '/' inicial>`; `WebInvoke(Method:="M", UriTemplate:="t")` → `M` en mayúsculas (por defecto `POST`), ruta igual; sin plantilla → `/<Clase>.svc/<Operación>`; sin atributos web → `POST /<Clase>.svc/<Operación>`.
- `id` = `"<MÉTODO> <ruta>"`, `component_id` = id del componente, `parameters` = `{name, in, type, required}` con `in` = `path` si `{name}` aparece antes de `?` en la plantilla, `query` si aparece después de `?` o si el verbo es `GET` sin aparecer, `body` en otro caso; `type` = texto del `As` (o `Object`); `required` = no `Optional`. `response_schema` = texto del `As` de `Function`; `Sub` → nulo. `description` nulo.
