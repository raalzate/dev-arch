# VB.NET legacy support

What the .NET analyzer (`dotnet-analyzer`, Roslyn) extracts from Visual Basic .NET legacy projects
(.NET Framework 4.8 desktop applications: WinForms, ADO.NET, Crystal Reports, ASMX/WCF services), how fidelity depends
on the host, and the known limitations. Feature 009-vb-legacy-completion. The JSON contract is unchanged (1.0.0).

## Full and reduced fidelity

| Host | Loading | `meta.source` | Fidelity |
|------|---------|---------------|----------|
| Windows with Visual Studio Build Tools 2019/2022 and the VB workload | MSBuild (`MSBuildWorkspace`) | `roslyn` | Full: .NET Framework reference assemblies resolve |
| macOS, Linux, or Windows without Build Tools | Adhoc Roslyn compilation of the `*.vb` files (references: the analyzer's own runtime BCL) | `roslyn-fallback` | Reduced |

A legacy `.vbproj` imports `Microsoft.VisualBasic.targets`; without the Build Tools MSBuild either returns no source files
or a compilation where `System.Object` is unresolved. In both cases the analyzer switches that project to the Adhoc
fallback (FR-065), skipping `bin/` and `obj/` and the designer files (`*.Designer.vb`, `Reference.vb`, ...).

With reduced fidelity the analyzer reports one **user warning** per VB project:

```
VB project 'Shop.vbproj' analyzed with reduced fidelity (Adhoc fallback: MSBuild with Visual Studio Build Tools and the VB workload is unavailable). .NET Framework types are unresolved; coupling to framework types and detections that need them may be incomplete. See docs/VB-LEGACY.md.
```

- `dotnet-analyzer` prints it on stderr after the JSON as a `[warning] <text>` line.
- The engine collects those lines: MCP `analyze_project` lists them in `_meta["static-inference/warnings"]`; the CLI prints
  `[warning] <text>` on stderr. Output documents are unchanged. C# analyses never produce these warnings.

### What reduced fidelity loses

- .NET Framework types (`System.Windows.Forms`, `System.Data.SqlClient`, `System.Web.Services`, `System.ServiceModel`,
  Crystal Reports, ...) are unresolved: they never count for coupling (CBO ignores unresolved and `System.*` types anyway).
- Members inherited from unresolved framework bases (for example `Show()` of a `Form`) are unresolved.
- Every detection below is syntactic or uses only project types, so tables, issues, configuration, layers and endpoints
  are still produced. To get full fidelity, run the analysis on Windows with Visual Studio Build Tools and the VB workload.

## What is extracted from VB components

| Field | Rule |
|-------|------|
| `tables_used` | Literal SQL (`SELECT`/`INSERT`/`UPDATE`/`DELETE`/`MERGE`, strict grammar) folded from `&`/`+` concatenations and line continuations; variable parts never produce tables. Typed DataSets: `<X>TableAdapter` and `<X>DataTable` classes resolved through the project's `*.xsd` (`DbObjectName`, else the `CommandText`, else the adapter name). |
| `cbo`, `lcom`, `complexity_max`, `complexity_avg` | Same definitions as C#: distinct project types referenced (no `System.*`, `Microsoft.*` or unresolved types); Henderson-Sellers LCOM over fields and instance `Sub`/`Function` blocks (modules: 0); cyclomatic complexity per `Sub`/`Function` (`If`, `ElseIf`, single-line `If`, loops, `Catch`, `If(c, a, b)`, each `Case` value, `AndAlso`, `OrElse`). |
| `secrets_references`, `sensitive_data` | `ConfigurationManager`, `ConfigurationSettings`, `config:ConnectionStrings:<name>`, `config:<key>` (`AppSettings`, `My.Settings`) read from `app.config` / `web.config`. A referenced plaintext credential (connection string with `Password`/`Pwd`, or a secret-named setting) marks the component as sensitive. Values are never emitted. |
| `code_issues` | See below. |
| `layer` | Forms, user controls and reports → `Web`; `*Controller` → `Negocio`; data access (tables, `*Repository`, `*DataAccess`, `*DAL`, `*TableAdapter`, `DataSet` bases, ...) → `Datos`; modules → `Compartida`; ASMX services and WCF implementations → `Controlador`. Interfaces keep the general classification. |
| `api_contracts.endpoints` | ASMX `WebMethod` → `POST /<Class>.asmx/<Method>`; WCF `OperationContract` → `/<Class>.svc/...` with `WebGet`/`WebInvoke` verb and `UriTemplate` (default `POST /<Class>.svc/<Operation>`). |

### VB code issues

| Rule | Type | Severity |
|------|------|----------|
| `ON_ERROR_RESUME_NEXT` | BUG_PATTERN | WARNING |
| `OPTION_STRICT_OFF` (explicit `Option Strict Off`, one per component of the file) | CODE_STYLE | WARNING |
| `GOTO_STATEMENT` | CODE_STYLE | INFO |
| `LATE_BINDING` (late-bound member access, invocation or indexer on `Object`, `CreateObject`/`GetObject`; one per line) | BUG_PATTERN | WARNING |
| `EMPTY_CATCH_BLOCK`, `CATCH_GENERIC_EXCEPTION`, `MISSING_SWITCH_DEFAULT` (`Select Case` without `Case Else`) | BUG_PATTERN | WARNING / INFO / INFO |
| `HARDCODED_SECRET_IN_CODE` | BUG_PATTERN | CRITICAL |
| `HIGH_CYCLOMATIC_COMPLEXITY` (> 10 WARNING, > 15 ERROR) | CODE_STYLE | WARNING / ERROR |
| `PLAINTEXT_SECRET_IN_CONFIG` | SECURITY | CRITICAL |

## Stored procedures (feature 020)

Legacy .NET Framework applications rarely write SQL: they invoke stored procedures. The analyzer recognizes,
syntactically and without resolving the data access libraries (so it works under reduced fidelity):

| Form | Recognized shape |
|---|---|
| Enterprise Library | `GetStoredProcCommand("usp_X")`; `ExecuteDataSet` / `ExecuteNonQuery` / `ExecuteScalar` / `ExecuteReader(db, "usp_X", …)` |
| ADO.NET | `cmd.CommandType = CommandType.StoredProcedure` in the type plus `cmd.CommandText = "usp_X"` (or `New SqlCommand("usp_X", …)`) whose text has the shape of an identifier; texts with spaces stay literal SQL |
| Dapper | `Query*` / `Execute*(…, commandType:=CommandType.StoredProcedure)` with a literal text |

The name may be split across concatenated literals; schema and delimiters are dropped (`[dbo].[usp_X]` → `usp_X`).
Each procedure is emitted in `tables_used` as **`sp:<name>`**, one entry per component, in the same ordinal order as
the tables (contract 1.0.0 unchanged). A non-literal name (variable, `String.Format`) produces the user warning
`Procedure name is not a literal in <component> (<file>:<line>)` and no entry.

**Catalog** (`dataAccess.procedureCatalog`): a directory of `.sql` scripts with `CREATE [OR ALTER] PROCEDURE` /
`ALTER PROCEDURE` definitions, or a `.csv` file with the header `procedimiento,tabla,operación` (or
`procedure,table,operation`, as exported from `sys.sql_dependencies`). Tables come from the procedure bodies with the
same SQL grammar as literal SQL; `EXEC`/`EXECUTE` calls are followed transitively (cycles terminate). With
`catalogMode` = `complement` (default) the component lists the tables **and** `sp:<name>`; with `replace` it lists the
tables only, keeping `sp:` for procedures absent from the catalog. Files are read in ordinal path order; a procedure
defined twice keeps the lowest path and warns; a missing path or a CSV without the header degrades to `sp:` only
with a warning that names the cause. Warnings never carry absolute paths or procedure bodies.

**Activation**: `dataAccess.procedures` = `auto` (default: Visual Basic compilations only, so C# and Java outputs do
not change), `on` (every compilation, for C# legacy projects with Enterprise Library or ADO.NET) or `off`. The
effective state is written to the analysis log as `[info] Stored procedure detection: on|off for <language>
(auto|config)`. The engine passes the section to the analyzer as `dotnet-analyzer <path> --config=<file>` only when
it differs from the defaults.

**Inference**: `sp:` entries are shared data resources like tables, with `dataAccess.procedureWeight` relative to a
table (`1.0` by default, `0` ignores them) in the shared-data grouping, in `tables_shared` (tables first, then `sp:`)
and in the data cohesion. `dataAccess.entityHeuristic` (off by default) derives a business entity from procedure
names (`usp_Policy_Read` → `Policy`) only to name proposals; it never emits tables.

Limitations: names are read from literals only (no data flow); `CommandType.StoredProcedure` and `CommandText` must
be in the same type; views referenced by a procedure are emitted as tables; `EXEC` with a non-literal name is not
followed.

## Identity, desktop layers and debt rules (feature 021)

**Identity.** Under reduced fidelity the loader reads the `.vbproj`: `<RootNamespace>` becomes the root namespace of
the compilation (types without a `Namespace` block are qualified by it, explicit blocks nest under it) and the global
`<Import Include>` entries become compilation imports, so framework names such as `Int64` resolve without a file
`Imports`. A directory of nested `.vbproj` files without a solution is compiled one project at a time, in
`ProjectReference` order, each project referencing the previous compilations; `.vb` files outside every project form
a residual compilation. An invalid `RootNamespace` is ignored with a `[WARN]` diagnostic.

**Desktop fine layers** (annotations, the `layer` catalogue of contract 1.0.0 does not change):

| Evidence | Annotation | `layer` |
|---|---|---|
| base type (symbol or `Inherits` chain) ending in `Form`, `UserControl`, `XtraForm`, `XtraUserControl`, `WaitForm`, or a sibling `<Name>.Designer.vb` | `Layer:Presentación` | `Web` |
| base type containing `Report`, use of `LocalReport`, or a `<Name>.rdlc` in the project | `Layer:Reportes` | `Web` |
| `Module` with `Sub Main` (or the project `StartupObject`) | `Layer:Batch` and `EntryPoint:Main` | `Negocio` |
| name ending in `Validator`, or project `*.Validators` | — | `Negocio` |

A proposal that contains an `EntryPoint:Main` component declares `legacy_entrypoint` of type `internal` with that
component as primary entry class, `Main` as exposed operation and a batch-process description (the `type` catalogue is
closed).

**Legacy debt rules** (`debt.enabled`: `auto` = Visual Basic only, `on`, `off`; thresholds `debt.godClass.minLoc` =
1000 and `debt.godClass.minComplexity` = 15):

| Rule | Type / severity | Condition |
|---|---|---|
| `PROJECT_OPTION_STRICT_OFF` | CODE_STYLE / WARNING | `<OptionStrict>Off</OptionStrict>` in the project; one issue per component, located at the project file |
| `UI_CALL_IN_BUSINESS_LAYER` | BUG_PATTERN / WARNING | `MsgBox`, `MessageBox.Show` or `InputBox` in a component whose fine layer is not Presentación |
| `SQL_CONCAT_INJECTION` | SECURITY / CRITICAL | `CommandText`, `GetSqlStringCommand(...)` or `New *Command(...)` whose text concatenates a SQL literal with a non-literal value |
| `STATIC_FACADE` | CODE_STYLE / INFO | class whose methods and properties are all `Shared`, with a mutable `Shared` field and no instance members |
| `MIXED_TRANSACTION_MODELS` | BUG_PATTERN / WARNING | `BeginTransaction`/`*Transaction` and `TransactionScope` in the same component |
| `GOD_CLASS` | CODE_STYLE / WARNING | lines of code above `minLoc` **and** maximum method complexity above `minComplexity` |

The rules are syntactic (they work under reduced fidelity) and deterministic. `detection.maxDepth` keeps its default
(0): the nested search stays opt-in.

## Limitations

- SQL is recognized only in string literals and their concatenations; SQL built through variables, `StringBuilder`,
  resources or stored procedures (`EXEC`) is not followed. Temporary tables, table variables and table-valued functions
  are ignored. A folded literal longer than 8192 characters is ignored with a `[WARN]` diagnostic (BUG-002: the bound
  is on the input, never on wall-clock time, so the tables of a component depend only on its source).
- `LATE_BINDING` needs `System.Object` to be resolved; with Option Strict On late binding is a compile error and is not
  reported. Under reduced fidelity Roslyn may fail to build the operation tree of expressions in a class whose
  implicit `MyBase.New()` call resolves to a constructor with an optional parameter of an unresolved type (for example
  `Optional ByVal x As Int64 = 0` without the project-level `Imports System`); the late-binding check of those
  expressions is skipped with a `[WARN] VbCodeAnalyzer: late-binding detection skipped …` diagnostic and every other
  rule of the type still applies (BUG-001).
- Configuration is read only from `app.config` / `web.config` in the project directory; config transforms and external
  `configSource` files are not followed. Malformed files are skipped with a `[WARN]` diagnostic.
- The `Web` layer for forms and reports is a convention of the closed layer catalogue (it has no "presentation" layer).

## Tests

- Synthetic, redistributable corpus: `engine/src/test/dotnet/DotNetAnalyzer.Tests/Fixtures/VbLegacy/` (`SyntheticDesktop`,
  `SyntheticWebServices`), used by CI.
- The real reference corpus is external, not redistributable and opt-in: `dotnet test --filter "Category=Corpus"`.
