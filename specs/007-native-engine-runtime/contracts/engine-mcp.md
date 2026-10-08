# Contract: engine changes (MCP server and CLI)

Constitution I/II/IV: every change is additive; without the new inputs, CLI and MCP outputs are byte-identical to 006.

## Tool input schemas (`ToolSchemas`)

All five tools (`analyze_project`, `get_dependency_graph`, `get_architecture_proposal`, `get_api_contracts`, `get_component_metrics`) gain an optional property:

```json
"language": { "type": "string", "enum": ["java", "dotnet", "auto"],
              "description": "Analyzer to use. 'auto' (default) detects from marker files; required to resolve projects with both Java and .NET markers." }
```

`required` lists are unchanged. Invalid value → `CallToolResult{isError: true, content: "Invalid language '<x>'. Allowed: java, dotnet, auto"}`.
Ambiguous project with `auto` → `isError: true`, message contains `Ambiguous project type` and `language=java|dotnet`.

## Progress (`analyze_project` only)

If the request carries `_meta.progressToken`, the server sends, in order, before the result:

| # | `notifications/progress` params |
|---|---------------------------------|
| 1 | `{ progressToken, progress: 1, total: 4, message: "detection" }` |
| 2 | `{ progressToken, progress: 2, total: 4, message: "extraction" }` |
| 3 | `{ progressToken, progress: 3, total: 4, message: "inference" }` |
| 4 | `{ progressToken, progress: 4, total: 4, message: "writing" }` |

Without `progressToken`: no notification. Cache hits emit the same four notifications. Error before a phase → no further notifications.

## Warnings (`analyze_project` result)

- `content[0].text`: unchanged JSON (`schema/1.0.0/mcp/analyze_project.response.schema.json`, closed object).
- `_meta`: present **only** when warnings exist: `{ "static-inference/warnings": ["<warning>", ...] }`.
- Warning sources: .NET degraded mode (existing `DotNetBridgeAnalyzer`), Java files Spoon could not model (`"Skipped <rel path>: <reason>"`), zero components (`"No analyzable source files found in '<rel root>'"`).

## Cache (MCP mode only)

- Key: `(toRealPath(projectPath), language, sha256(sorted "<relpath>\t<size>\t<mtimeMillis>\n" of regular files, excluding root-level output.json, output_architecture.json, output_entrypoints.json))`.
- Capacity: `-Dstatic-inference.cache.size` > `STATIC_INFERENCE_CACHE_SIZE` > 8; `0` disables.
- All tools read through the cache; cached and fresh responses are byte-identical.

## CLI

```
java -jar engine.jar <projectPath> <outputFile> [--language=java|dotnet|auto]
```

- Without the third argument: unchanged behaviour and outputs.
- Invalid value: exit code 1, stderr `Invalid language '<x>'. Allowed: java, dotnet, auto`, no output files.
- After writing outputs, each warning is printed to stderr as `[warning] <text>`; stdout and output files unchanged.
