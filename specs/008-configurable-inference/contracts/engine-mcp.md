# Contract: engine MCP additions (008)

## Server startup

| Variable (env or `-D`) | Effect |
|---|---|
| `STATIC_INFERENCE_INFERENCE_TOOLS=true` | registers `reinfer_architecture` and `score_proposal` (default: only the five 001 tools) |
| `STATIC_INFERENCE_JOBS_DIR=<dir>` | enables `jobId` resolution: `<dir>/<jobId>/out/output.json` |

The web engine process sets both (`STATIC_INFERENCE_JOBS_DIR=<ARCHVIEW_DATA_DIR>/jobs`).

## `analyze_project` (additive inputs)

`config` (object, optional), `configPath` (string, optional) — see [inference-config.md](./inference-config.md). Non-default config bypasses the reuse cache. Response unchanged.

## `reinfer_architecture`

Input: `graphPath` (string) xor `jobId` (string); `config` | `configPath` (optional); `minViability` (`Alta|Media|Baja`, optional).

Success: text content = architecture document (`schema/1.0.0/mcp/reinfer_architecture.response.schema.json` → `architecture.schema.json`), same mapper as `get_architecture_proposal`; `_meta["static-inference/warnings"]` when the sibling architecture is missing.

Errors (`isError: true`):

| Case | Message |
|---|---|
| neither/both of graphPath, jobId | `Pass exactly one of graphPath or jobId` |
| graph missing | `Graph file '<path>' does not exist` |
| not a graph | `Graph file '<path>' is not a dependency graph: <detail>` |
| other contract version | `Graph file '<path>' declares schema_version '<v>'; supported: 1.0.0` |
| malformed jobId | `Invalid jobId '<id>'` |
| no jobs dir | `jobId requires STATIC_INFERENCE_JOBS_DIR; pass graphPath instead` |
| unknown job | `Analysis '<id>' has no dependency graph` |
| config errors | see inference-config.md |
| bad minViability | `Invalid minViability '<v>'. Allowed: Alta, Media, Baja` |

## `score_proposal`

Input: `components` (array of strings, required), `graphPath` xor `jobId`, `config` | `configPath` (optional).

Success: text content = `ProposalScore` (`schema/1.0.0/mcp/score_proposal.response.schema.json`).

Errors: graph/config errors as above; `components must contain at least one component id`; `Unknown components: <id1>, <id2>` (sorted).

## Resources (capability `resources`, always on)

| URI | name | mimeType | Content |
|---|---|---|---|
| `static-inference://algorithms` | algorithms | text/markdown | `engine/ALGORITHMS.md` of the build |
| `static-inference://configuration` | configuration | text/markdown | `engine/CONFIGURATION.md` of the build |
| `static-inference://configuration/defaults` | configuration-defaults | application/json | `InferenceConfigLoader.toJson(InferenceConfig.defaults())` (indented, keys in record order) |
| `static-inference://schema` | schema | application/json | `{"schema_version":"1.0.0","schemas":{"<relative path>": <schema>, …}}` sorted by path |

Unknown URI → MCP error from the SDK.

## CLI

`--config=<file>` accepted anywhere after the two positional arguments, together with `--language=`. Invalid config → stderr message, exit 1, no files written.
