# Contract: inference configuration (`analysis-config.json`)

Normative schema: `schema/1.0.0/inference-config.schema.json`. Every property is optional; omitted properties keep the defaults of [data-model.md](../data-model.md). Unknown properties are rejected.

```json
{
  "viability": { "thresholds": { "high": 0.8, "medium": 0.6 } },
  "evidence": { "evidenceThreshold": 0.6, "weights": { "token": 0.45, "call": 0.20 } },
  "consolidation": { "infrastructureKeywords": ["config", "security", "gateway"] },
  "detection": { "maxDepth": 2 }
}
```

## Sources

| Entry point | How | Precedence |
|---|---|---|
| CLI | `java -jar engine.jar <project> <out.json> [--language=…] [--config=<file>]` (options in any order after the two positional arguments) | — |
| MCP `analyze_project`, `reinfer_architecture`, `score_proposal` | `config` (object) **or** `configPath` (string, absolute path) | both present → error `Pass either config or configPath, not both` |

No automatic discovery inside the analyzed project.

## Merge

Objects merge recursively; arrays, strings, numbers and maps such as `naming.infrastructureLabels` replace the default value as a whole.

## Errors (exact prefixes)

| Case | Message |
|---|---|
| unknown key | `Invalid inference configuration: <path>: unknown parameter` |
| wrong JSON type | `Invalid inference configuration: <path>: must be <a number\|an integer\|a string\|an array of strings\|an object>` |
| out of range | `Invalid inference configuration: <path>: must be between <min> and <max>` (or `must be >= 0`) |
| incoherent pair | `Invalid inference configuration: viability.thresholds.medium: must be <= viability.thresholds.high` (same form for rationale pairs) |
| bad enum | `Invalid inference configuration: <path>: must be one of <values>` |
| file missing/unreadable/not JSON | `Inference configuration file '<path>' does not exist` / `is not readable` / `is not valid JSON: <detail>` |
| root not an object | `Invalid inference configuration: (root): must be an object` |

CLI: message on stderr, exit code 1, no output files. MCP: `isError: true` with the message.
