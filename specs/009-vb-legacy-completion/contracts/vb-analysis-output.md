# Contract: VB analysis output (dotnet-analyzer → engine)

Constitution I: **no change to the JSON contract 1.0.0** (`schema/1.0.0/*.schema.json`). Only values already allowed by the schema are produced for VB components. C# and Java outputs are byte-identical to the pre-009 outputs.

## Values used (all within 1.0.0)

| Field | Values produced for VB | Schema constraint |
|-------|------------------------|-------------------|
| `components[*].code_issues[*].pattern` | `ON_ERROR_RESUME_NEXT`, `OPTION_STRICT_OFF`, `GOTO_STATEMENT`, `LATE_BINDING`, `PLAINTEXT_SECRET_IN_CONFIG`, `EMPTY_CATCH_BLOCK`, `CATCH_GENERIC_EXCEPTION`, `MISSING_SWITCH_DEFAULT`, `HARDCODED_SECRET_IN_CODE`, `HIGH_CYCLOMATIC_COMPLEXITY` | open string set ("Rule identifier (open set of values)") |
| `components[*].code_issues[*].type` | `BUG_PATTERN`, `CODE_STYLE`, `SECURITY` | existing enum |
| `components[*].code_issues[*].severity` | `INFO`, `WARNING`, `ERROR`, `CRITICAL` | existing enum |
| `components[*].layer` | `Controlador`, `Negocio`, `Datos`, `Web`, `Compartida` | existing enum |
| `components[*].secrets_references[*]` | `ConfigurationManager`, `ConfigurationSettings`, `config:ConnectionStrings:<name>`, `config:<key>` | string array |
| `components[*].tables_used[*]` | simple table names | string array |
| `components[*].cbo`/`lcom`/`complexity_max`/`complexity_avg` | numbers | existing optional numeric fields |
| `api_contracts.endpoints[*]` | ASMX/WCF endpoints (`method` ∈ GET/POST/PUT/DELETE/PATCH…, `path` starting with `/`) | existing `ApiEndpoint` |
| `meta.source` | `roslyn-fallback` when a VB project used the Adhoc load | existing string |

Configuration values (passwords, keys, connection strings) never appear in any field or message.

## Determinism

Lists are ordered by the existing final ordering pass of `ProjectAnalyzer` (ordinal, distinct). Code issues are ordered by `(file:line, rule)` ordinal, exactly as C#. Two runs on the same input are byte-identical (excluding opt-in `meta.collected_at`).
