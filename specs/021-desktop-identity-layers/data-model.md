# Data Model: 021-desktop-identity-layers

## `VbProjectFile`
`Path`, `RootNamespace: string?` (identificador calificado válido o null), `GlobalImports: IReadOnlyList<string>`, `OptionStrictOff: bool`, `IsExe: bool`, `StartupObject: string?`, `ReportDefinitions: IReadOnlySet<string>` (nombres sin extensión de `*.rdlc`), `Diagnostics`.

## Capa fina y anotaciones
| Evidencia | Anotación | `layer` |
|---|---|---|
| base termina en `Form`/`UserControl`/`XtraForm`/`XtraUserControl`/`WaitForm`, o `<Nombre>.Designer.vb` hermano | `Layer:Presentación` | `Web` |
| base contiene `Report`, usa `LocalReport`, o `<Nombre>.rdlc` en el proyecto | `Layer:Reportes` | `Web` |
| `Module` con `Sub Main` (o `StartupObject` = módulo) | `Layer:Batch`, `EntryPoint:Main` | `Negocio` |
| nombre termina en `Validator` o proyecto `*.Validators` | — | `Negocio` |
Las anotaciones se añaden a `annotations` (ordenación final ordinal existente). Un componente lleva a lo sumo una `Layer:*` (prioridad: Presentación > Reportes > Batch).

## Configuración `debt`
| Campo | Tipo | Default | Validación |
|---|---|---|---|
| `enabled` | `auto\|on\|off` | `auto` | enum |
| `godClass.minLoc` | int | 1000 | ≥ 1 |
| `godClass.minComplexity` | int | 15 | ≥ 1 |

## Reglas de deuda (issues)
| Regla | Tipo | Severidad | Condición | Línea |
|---|---|---|---|---|
| `PROJECT_OPTION_STRICT_OFF` | CODE_STYLE | WARNING | `<OptionStrict>Off` en el proyecto del componente | 0, `Location = <archivo>.vbproj` |
| `UI_CALL_IN_BUSINESS_LAYER` | BUG_PATTERN | WARNING | invocación `MsgBox`/`MessageBox.Show`/`InputBox` y capa fina ≠ Presentación | línea de la invocación |
| `SQL_CONCAT_INJECTION` | SECURITY | CRITICAL | texto de comando plegado con palabra clave SQL (`SELECT|INSERT|UPDATE|DELETE|MERGE|EXEC|WHERE`) y ≥ 1 hueco | línea de la asignación/argumento |
| `STATIC_FACADE` | CODE_STYLE | INFO | clase con todos los métodos/propiedades `Shared`, ≥ 1 campo `Shared` mutable, sin miembros de instancia salvo constructores | línea de la clase |
| `MIXED_TRANSACTION_MODELS` | BUG_PATTERN | WARNING | identificadores `BeginTransaction` o `*Transaction` (tipo) y `TransactionScope` en el mismo tipo | línea del primer `TransactionScope` |
| `GOD_CLASS` | CODE_STYLE | WARNING | `Loc > minLoc` y `ComplexityMax > minComplexity` | línea de la clase; mensaje `… <loc> lines and complexity <cc> …` |

## `legacy_entrypoint` por lotes
`{"type":"internal","primary_entry_class":"<menor id con EntryPoint:Main>","exposed_operations":["Main"],"endpoints":[],"description":"Proceso por lotes (Sub Main) sin endpoints: se ejecuta por línea de comandos o planificador. Entrada principal: <Simple>."}`
