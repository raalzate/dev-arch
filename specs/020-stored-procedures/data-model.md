# Data Model: 020-stored-procedures

## Configuración (`InferenceConfig.dataAccess`)

| Campo | Tipo | Default | Validación |
|---|---|---|---|
| `procedures` | `"auto" \| "on" \| "off"` | `"auto"` | uno de los tres |
| `procedureCatalog` | `string \| null` | `null` | ruta (absoluta o relativa al directorio de trabajo); existencia se comprueba en el analizador (degradación, no error) |
| `catalogMode` | `"complement" \| "replace"` | `"complement"` | uno de los dos |
| `procedureWeight` | `number` | `1.0` | `>= 0` |
| `entityHeuristic` | `boolean` | `false` | — |

Java: `record DataAccessConfig(String procedures, String procedureCatalog, String catalogMode, double procedureWeight, boolean entityHeuristic)`. .NET: `AnalysisOptions { DataAccessOptions DataAccess }` con `ProceduresMode`, `CatalogPath`, `CatalogMode`.

## Reglas de reconocimiento (pasada 5c)

Candidatos neutrales por tipo (adaptador por lenguaje):

- `Invocation(MethodName, Receiver?, Args[]: Literal(text) | Hole, Named[name→Member(text)])`
- `MemberUse(MemberName)` — p. ej. `CommandType.StoredProcedure`
- `Assignment(TargetMember, Literal(text) | Hole)` — p. ej. `cmd.CommandText = "usp_X"`
- `ObjectCreation(TypeName, Args[], Initializer[TargetMember → Literal])`

| # | Regla | Nombre | Forma |
|---|---|---|---|
| R1 | `Invocation.MethodName == "GetStoredProcCommand"` y `Args[0]` literal | `Args[0]` | `entlib` |
| R2 | `MethodName ∈ {ExecuteDataSet, ExecuteNonQuery, ExecuteScalar, ExecuteReader}` y `Args.Length >= 2` y `Args[0]` no literal y `Args[1]` literal | `Args[1]` | `entlib-execute` |
| R3 | el tipo contiene `MemberUse("StoredProcedure")` y (`Assignment(CommandText, literal)` o `ObjectCreation(*Command, Args[0] literal)`) y el texto plegado tiene forma de identificador | el literal | `ado` |
| R4 | `MethodName` empieza por `Query` o `Execute`, `Named["commandType"] == Member("StoredProcedure")`, primer argumento de texto literal | ese literal | `dapper` |

Advertencia (FR-006): mismo patrón con argumento `Hole` en la posición del nombre ⇒ `Procedure name is not a literal in <componente> (<archivo>:<línea>)`.

Forma de identificador: `^[\w$]+(\.[\w$]+){0,3}$` tras quitar delimitadores; longitud ≤ 8192.

## Procedimiento canónico

`ProcedureName { Canonical: string; Key: string }` — `Canonical`: última parte sin delimitadores, mayúsculas del origen; `Key`: `Canonical` en minúsculas invariantes. Emisión: `"sp:" + Canonical`.

## Catálogo

```
ProcedureCatalog
  Source: Scripts(dir) | Csv(file) | None(reason)
  Definitions: Key → Definition { Canonical, File (relativo al catálogo), Tables: SortedSet<string>, Calls: SortedSet<Key> }
  Duplicates: List<(Key, keptFile, droppedFile)>  (ordenado)
  Resolve(Key) → SortedSet<string> tables (DFS transitivo, visitados)   | null si no existe
  Unresolved: SortedSet<Key>  (acumulado por Resolve)
```

Scripts: encabezado `CREATE [OR ALTER] PROC[EDURE] <ref>` / `ALTER PROC[EDURE] <ref>`; cuerpo hasta el siguiente encabezado, `GO` en línea propia o fin de archivo; sentencias por `;`/palabra clave al inicio de línea; tablas con `SqlTableParser.Parse`; `EXEC[UTE] <ref>` ⇒ `Calls`.

CSV: primera línea `procedimiento,tabla,operación` | `procedure,table,operation` (sin distinguir mayúsculas, espacios recortados); filas con ≥ 2 columnas; comillas dobles opcionales; `operación` ignorada; filas vacías ignoradas; cabecera distinta ⇒ `None("CSV header must be …")`.

## Emisión por componente

```
procs  = procedimientos reconocidos del componente (Key → Canonical, primera grafía)
for each p in procs:
  tables = catalog?.Resolve(p.Key)
  if tables == null:        emit "sp:" + p.Canonical            (+ Unresolved)
  elif mode == complement:  emit tables…, "sp:" + p.Canonical
  else (replace):           emit tables…
```
La ordenación final (`Distinct` + ordinal) la hace `ProjectAnalyzer` como hoy.

## Advertencias de usuario (canal 009, ordenadas, sin rutas absolutas)

- `Procedure name is not a literal in <id> (<file>:<line>)` (una por caso)
- `Procedure catalog '<nombre>' not loaded: <causa>; procedures are reported as sp:<name> only`
- `Procedure catalog '<nombre>': <n> procedure(s) not found: <k1>, <k2>, …`
- `Procedure catalog '<nombre>': duplicate definition of <k> in <fileB>; <fileA> used`

Diagnóstico (stderr `[WARN]`/`[info]`, no canal de usuario): `Stored procedure detection: <on|off> for <language> (<auto|config>)`.

## Inferencia

`DataResources.of(component, dataAccess) → List<(resource: String, weight: double)>` ordenado ordinal: tablas (peso 1.0), luego `sp:*` (peso `procedureWeight`, omitidos si 0).

`tables_shared` de una propuesta: tablas compartidas (ordinal) seguidas de `sp:` compartidos (ordinal).

## Heurística de entidad

`ProcedureEntityHeuristic.entityOf("AMPsp_Policy_Read") = "Policy"`, `("usp_GetPolicy") = "Policy"`, `("sp_Save") = null`, `("Totals") = "Totals"`. Verbos: Get, Read, Select, List, Insert, Add, Create, Update, Save, Delete, Remove, Search, Find, Exists, Count.
