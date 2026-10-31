# Contract: `dotnet-analyzer` configuration option (020)

```
dotnet-analyzer <path> [--config=<file>]
```

- `<path>`: as today (`.sln`, `.csproj`, `.vbproj` or directory). Without `--config` the behaviour, output and diagnostics are exactly those of 014b.
- `--config=<file>`: JSON file. Only the `dataAccess` section is read in 020; unknown sections and keys are ignored (forward compatibility with 016-019). Invalid values (unknown mode, negative weight, non-object) ⇒ exit code 1 and `Error: invalid --config: <reason>` on stderr; unreadable file ⇒ same.

```json
{ "dataAccess": { "procedures": "auto|on|off", "procedureCatalog": "<path or null>", "catalogMode": "complement|replace" } }
```

`procedureWeight` and `entityHeuristic` are inference parameters: the analyzer ignores them.

Bridge rule (`DotNetBridgeAnalyzer`): the option is appended **only** when `InferenceConfig.dataAccess` differs from the defaults; the temporary file lives under the engine working directory and is deleted after the run. `procedureCatalog` is made absolute before writing.

Diagnostics (stderr, not the user-warning channel): `[info] Stored procedure detection: on (auto: Visual Basic)` / `off (auto: C#)` / `on (config)` / `off (config)`.
User warnings (stderr `[warning] …` after the JSON, collected by the bridge): see data-model §Advertencias.
