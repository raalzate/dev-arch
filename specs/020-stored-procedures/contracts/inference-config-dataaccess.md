# Contract: `inference-config` section `dataAccess` (020, additive to 1.0.0)

Added to `schema/1.0.0/inference-config.schema.json` (`properties.dataAccess`, object, `additionalProperties: false`, every key optional, defaults in `inference-defaults.json`):

| Key | Type | Default | Meaning |
|---|---|---|---|
| `procedures` | `"auto" \| "on" \| "off"` | `"auto"` | stored procedure detection in the .NET analyzer; `auto` = Visual Basic compilations only |
| `procedureCatalog` | `string \| null` | `null` | directory of `.sql` scripts or `.csv` file translating procedures to tables |
| `catalogMode` | `"complement" \| "replace"` | `"complement"` | keep `sp:` next to the tables, or tables only |
| `procedureWeight` | `number >= 0` | `1.0` | weight of an `sp:` resource relative to a table in shared-data grouping, `tables_shared` and data cohesion; `0` ignores procedures |
| `entityHeuristic` | `boolean` | `false` | derive a business entity from procedure names for proposal naming |

Accepted everywhere a configuration is accepted today: CLI `--config=<file>`, MCP `analyze_project`/`reinfer_architecture`/`score_proposal` (`config`, `configPath`), REST `POST /api/analyses/{id}/reinfer`. `meta` of the documents does not change; the applied configuration is reported as today (`inference_config` of the re-inference response).

Output conventions (no schema change): `components[].tables_used` may contain `sp:<Name>` strings; `proposals[].metrics.tables_shared` lists tables first, then `sp:` entries, each group in ordinal order.

Generated types: `schema/generated/types.ts` and `validators.ts` regenerated with `npm run generate -w schema`; `npm run check -w schema` must pass.
