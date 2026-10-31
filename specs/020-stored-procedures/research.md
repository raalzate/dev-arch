# Research: 020-stored-procedures

Decisiones con alternativas consideradas. Base: código de dev-arch en `014b-engine-debt` (b9e159b), spec de 020, plan `PLAN-VB-PLATAFORMA-LEGACY.md` §4 feature 015 y §7.

## D1 — Dónde vive la configuración: sección `dataAccess` de `InferenceConfig`

**Decisión**: nueva sección `dataAccess` en `InferenceConfig` (record Java), `inference-defaults.json`, `InferenceConfigValidator` y `schema/1.0.0/inference-config.schema.json` (aditiva, `additionalProperties: false` dentro de la sección).
**Por qué**: 008 ya estableció que toda configuración del análisis (incluida la de extracción, `detection.maxDepth`) viaja en `InferenceConfig` por CLI `--config`, MCP `config`/`configPath` y REST; `isDefault()` por igualdad de records sigue valiendo. El plan nombra las claves `dataAccess.procedures`, `dataAccess.procedureCatalog`, `dataAccess.procedureWeight`.
**Alternativas**: variables de entorno (invisibles, no reproducibles, fuera del contrato); archivo aparte del analizador (dos fuentes de configuración, contra el principio VII).

## D2 — Un emparejador, dos adaptadores sintácticos

**Decisión**: `ProcedureCallMatcher` recibe candidatos neutrales (`Invocation{MethodName, Arguments[]: Literal|Hole, HasNamedArgument(name, value)}` y `Assignment{TargetMemberName, ValueLiteral}`) producidos por `IProcedureCallSyntax` con una implementación por lenguaje de ~100 líneas (`InvocationExpressionSyntax`/`AssignmentExpressionSyntax` en C#; `InvocationExpressionSyntax`/`AssignmentStatementSyntax` en VB).
**Por qué**: 014b registró como deuda los walkers C#/VB duplicados en tres pasadas; esta pasada nace con la regla en un solo lugar y solo la lectura de sintaxis por lenguaje. El reconocimiento es sintáctico (nombres de método y literales), suficiente en fidelidad reducida donde EntLib/Dapper no se resuelven.
**Alternativas**: `IOperation` (uniforme, pero exige resolución semántica que no existe en Adhoc para EntLib/Dapper: las invocaciones quedan como `IInvalidOperation`); duplicar la pasada por lenguaje (repite la deuda).

## D3 — Transporte Java → analizador: `--config=<archivo>` solo cuando hace falta

**Decisión**: `DotNetBridgeAnalyzer` recibe `DataAccessConfig`; si `!equals(defaults)`, escribe `{ "dataAccess": {…} }` en un archivo temporal del directorio de trabajo del motor y añade `--config=<ruta>`; borra el archivo al terminar. Con la configuración por defecto la línea de comandos es idéntica a la actual (`<exe> <projectRoot>`).
**Por qué**: la identidad byte a byte de las salidas existentes se garantiza por construcción (el analizador ni siquiera ve la opción); un archivo evita límites de longitud de argumentos y problemas de comillas; es la misma forma (`--config=<archivo>`) que el CLI del motor.
**Alternativas**: argumentos sueltos (`--procedures=on …`): crecen con cada feature (016-019 añadirán más secciones); stdin: el analizador cierra stdin y el puente lo cierra también (BUG-002); variable de entorno: no reproducible desde la línea de comandos.

## D4 — Las cuatro reglas de reconocimiento (sintácticas)

**Decisión** (data-model §Reglas):
1. `GetStoredProcCommand(<literal>)` — nombre de método exacto, primer argumento literal plegable.
2. `ExecuteDataSet|ExecuteNonQuery|ExecuteScalar|ExecuteReader(<expr>, <literal>[, …])` — **segundo** argumento literal plegable (la sobrecarga EntLib `(Database db, string storedProcedureName, params object[])`); se excluye cuando el primer argumento es un literal o cuando hay un solo argumento (ADO.NET `cmd.ExecuteReader()`).
3. ADO.NET: dentro del mismo tipo, al menos una asignación/argumento `CommandType.StoredProcedure` (acceso a miembro con ese nombre) **y** asignaciones `CommandText = <literal>` u objetos `New SqlCommand(<literal>, …)` / inicializador `CommandText = <literal>` cuyo texto plegado **tenga forma de identificador** (`^[\[\]"`\w.$]+$`, sin espacios) ⇒ procedimiento. Texto con espacios ⇒ SQL literal (sigue a 5/5b).
4. Dapper: invocación cuyo nombre empieza por `Query` o `Execute` (`Query`, `QueryAsync`, `QueryFirst…`, `Execute`, `ExecuteAsync`, `ExecuteScalar…`) con argumento nombrado `commandType` cuyo valor es acceso a miembro `StoredProcedure`, y primer argumento de texto literal (posición 0 o 1 si el receptor va como argumento de extensión).
Nombres no literales en las posiciones anteriores ⇒ advertencia `FR-006`.
**Por qué**: cubre las 950 llamadas de la referencia (todas `GetStoredProcCommand`) y el perfil C# equivalente sin resolver tipos; las señales explícitas (`StoredProcedure`) evitan falsos positivos de `ExecuteReader` de ADO.NET.
**Alternativas**: resolver símbolos de EntLib/Dapper (imposible en Adhoc sin los ensamblados); heurística por nombre de procedimiento (`usp_`) (no es evidencia de invocación).

## D5 — Forma canónica

**Decisión**: `ProcedureName.Canonical(text)`: trim, quitar delimitadores por parte (`[x]`, `"x"`, `` `x` ``), tomar la última parte separada por `.`; `Key = Canonical.ToLowerInvariant()`. Emisión `sp:` + `Canonical` (mayúsculas del código, igual que las tablas conservan la primera grafía). Comparación código↔catálogo por `Key`.
**Por qué**: coherente con `SqlTableParser.Normalize`; SQL Server no distingue mayúsculas por defecto.
**Alternativas**: conservar esquema (rompe la coherencia con tablas y duplica `dbo.X` vs `X`).

## D6 — Catálogo: scripts y CSV, resolución transitiva

**Decisión**: directorio ⇒ `*.sql` recursivo ordinal (sin `bin/`, `obj/`); archivo `.csv` ⇒ CSV con cabecera obligatoria. Parser de scripts por expresiones regulares sin timeout: encabezado `\b(CREATE(\s+OR\s+ALTER)?|ALTER)\s+PROC(EDURE)?\s+<ref>`; cuerpo hasta el siguiente encabezado o `^\s*GO\s*$`; sentencias por `;` o por palabra clave inicial (`SELECT|INSERT|UPDATE|DELETE|MERGE|EXEC|EXECUTE`) al inicio de línea; tablas con `SqlTableParser.Parse` por sentencia; `EXEC[UTE]\s+<ref>` ⇒ dependencia. Resolución DFS con visitados (ciclos terminan). Duplicados: menor ruta ordinal gana + advertencia. Límite de 8192 caracteres por sentencia (BUG-002) — los cuerpos se parten por sentencia antes de aplicarlo, así que un procedimiento largo no se pierde entero.
**Por qué**: cubre los dos orígenes realistas (repositorio de scripts del cliente; export de `sys.sql_dependencies`/`sys.dm_sql_referenced_entities` a CSV) sin dependencias ni red; determinista.
**Alternativas**: parser SQL completo (dependencia nueva, principio VI); consulta a la base de datos (red, no reproducible).

## D7 — Peso de procedimientos en la inferencia

**Decisión**: `DataResources.of(component, dataAccess)` ⇒ lista ordenada de `(recurso, peso)`: tabla ⇒ 1.0; `sp:` ⇒ `procedureWeight`, omitido si `0`. Consumidores: `ClusteringAlgorithm.groupBySharedTables` (agrupa si el recurso aparece con peso > 0 en ≥ 2 componentes), `MetricsCalculator.findSharedTables` (lista: tablas ordinal, luego `sp:` ordinal), `ViabilityScorer.calculateDataCohesion` (cuenta ponderada), Jaccard de datos (`legacy`/`data_cohesion`) con pesos. Con `procedureWeight = 1.0` y sin `sp:` todo coincide con el cálculo actual (pesos 1 sobre los mismos conjuntos). El contrato de `tables_shared` no cambia (strings).
**Por qué**: el plan pide "mismo peso que una tabla por defecto" y configurable; un peso relativo a la tabla es lo que el usuario entiende y no interfiere con `evidence.weights.table` (que pondera la señal de datos frente a llamadas y tokens).
**Alternativas**: tratar `sp:` como tablas sin peso (no cumple FR-021); una señal de evidencia nueva (cambia la forma del grafo de evidencia y los baselines).

## D8 — Heurística de entidad

**Decisión**: `ProcedureEntityHeuristic.entityOf(name)`: quitar prefijo `^(?:[A-Za-z]{1,8})?sp_|^usp_` (sin distinguir mayúsculas), separar por `_` y por cambio de mayúscula, quitar el primer o último token si está en la lista fija de verbos (FR-040), unir el resto en PascalCase; vacío ⇒ sin entidad. `MicroserviceNameGenerator` añade la entidad más frecuente del clúster a los tokens candidatos solo con `entityHeuristic = true`. Nunca modifica `tables_used`.
**Por qué**: último recurso del plan, apagado por defecto; vive en nombrado (donde ya se decide el nombre) y no en extracción.
**Alternativas**: emitir la entidad en `annotations` (nuevo significado de un campo existente; se deja para 018 si hace falta).

## D9 — Pruebas

**Decisión**: Reqnroll para los `.feature` .NET de `specs/020-stored-procedures/tests/features/` (segundo `ItemGroup` en el csproj, excluyendo `*-engine.feature`); Cucumber-JVM `RunStoredProceduresFeaturesTest` para los `@engine` (configuración, puente con `--config`, inferencia con peso, heurística). Golden del corpus sintético con y sin catálogo (`<ROOT>` sustituido). Prueba `Corpus` opt-in: `VbCorpusSmokeTests` gana un caso con SC-002 (≥ 80 % de `*Adapter` con `tables_used`, ≥ 850 `sp:` distintos) usando la referencia externa si está presente.
**Por qué**: mismo mecanismo que 009 (research D9 de 009); los escenarios de inferencia necesitan el motor Java.

## D10 — Relación con 016 (imports del proyecto)

**Observación**: el disparador de BUG-001 (tipos no resueltos por falta de `Imports` del `.vbproj`) no afecta a esta pasada (sintáctica). 016.1 mejorará la resolución, sin cambiar las reglas de 020.
