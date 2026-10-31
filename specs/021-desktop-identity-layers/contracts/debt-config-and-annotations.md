# Contract: `inference-config` section `debt` and the desktop annotations (021, additive to 1.0.0)

`debt` (object, additionalProperties false, every key optional):
| Key | Type | Default | Meaning |
|---|---|---|---|
| `enabled` | `auto` \| `on` \| `off` | `auto` | legacy debt rules in the .NET analyzer; `auto` = Visual Basic compilations only |
| `godClass.minLoc` | integer ≥ 1 | 1000 | LOC above which a type may be a god class |
| `godClass.minComplexity` | integer ≥ 1 | 15 | maximum method complexity above which a type may be a god class |

Transport: same `--config=<file>` as `dataAccess` (020); the file carries `{ "dataAccess": …, "debt": { "enabled", "godClass": {…} } }` only when a section differs from its defaults.

Output conventions (no schema change): `components[].annotations` may contain `Layer:Presentación`, `Layer:Reportes`, `Layer:Batch` and `EntryPoint:Main`; `components[].layer` keeps the 1.0.0 catalogue (`Web` for Presentación/Reportes, `Negocio` for Batch and validators); `proposals[].legacy_entrypoint` of a proposal containing an `EntryPoint:Main` component is `{"type":"internal","primary_entry_class":…,"exposed_operations":["Main"],…}`. New `code_issues[].rule` values: `PROJECT_OPTION_STRICT_OFF`, `UI_CALL_IN_BUSINESS_LAYER`, `SQL_CONCAT_INJECTION`, `STATIC_FACADE`, `MIXED_TRANSACTION_MODELS`, `GOD_CLASS` (`type` ∈ existing open set, `SECURITY` already used by C# rules).
