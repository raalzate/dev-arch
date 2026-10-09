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

## Limitations

- SQL is recognized only in string literals and their concatenations; SQL built through variables, `StringBuilder`,
  resources or stored procedures (`EXEC`) is not followed. Temporary tables, table variables and table-valued functions
  are ignored.
- `LATE_BINDING` needs `System.Object` to be resolved; with Option Strict On late binding is a compile error and is not
  reported.
- Configuration is read only from `app.config` / `web.config` in the project directory; config transforms and external
  `configSource` files are not followed. Malformed files are skipped with a `[WARN]` diagnostic.
- The `Web` layer for forms and reports is a convention of the closed layer catalogue (it has no "presentation" layer).

## Tests

- Synthetic, redistributable corpus: `engine/src/test/dotnet/DotNetAnalyzer.Tests/Fixtures/VbLegacy/` (`SyntheticDesktop`,
  `SyntheticWebServices`), used by CI.
- The real reference corpus is external, not redistributable and opt-in: `dotnet test --filter "Category=Corpus"`.
