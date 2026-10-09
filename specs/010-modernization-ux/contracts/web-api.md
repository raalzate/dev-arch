# Contract: web API additions (010)

All endpoints honour the 007 rules: optional bearer token (`DEVARCH_API_TOKEN`, 401 first), path redaction, error body `{"error":{"code","message",...}}`, `Cache-Control: no-store`.

## GET /api/analyses

200 `{ "analyses": HistoryEntry[] }` sorted by `createdAt` descending (ties: `jobId`). `HistoryEntry` = the 007 status view (`jobId, origin, language, status, phase, createdAt, startedAt, finishedAt, error, warnings, summary, projectRoot, hasSources`) + `technology` (`java|csharp|vb|dotnet-mixed|dotnet|null`) + `technologyLabel` (string|null). Never absolute server paths.

## GET /api/inference/defaults

200 `{ "parameters": [{ "path", "label", "min", "max", "step", "default" }], "defaults": <engine defaults JSON> }`.
- `defaults` = MCP resource `static-inference://configuration/defaults`.
- `min/max` from `schema/1.0.0/inference-config.schema.json`.
- Engine not built → 503 `ENGINE_NOT_BUILT`; inference tools disabled → 503 `INFERENCE_UNAVAILABLE` ("The engine inference tools are disabled (STATIC_INFERENCE_INFERENCE_TOOLS)").

## POST /api/analyses/{id}/reinfer

Body `{ "config"?: InferenceConfig, "minViability"?: "Alta"|"Media"|"Baja" }` (JSON, ≤ 64 KiB).
- 200 `ConsolidatedArchitecture` (validated with `reinferArchitectureResponseSchema`).
- 400 `INVALID_REQUEST` (malformed body / `config` fails `inferenceConfigSchema` / bad `minViability`).
- 404 `NOT_FOUND` unknown or expired job; 409 `NOT_COMPLETED` job not completed.
- 422 `INFERENCE_CONFIG_INVALID` engine message starting with `Invalid inference configuration:` (message preserved).
- 502 `ENGINE_ERROR` other engine errors or contract violation.

## POST /api/analyses/{id}/score

Body `{ "components": string[] (≥1), "config"?: InferenceConfig }`.
- 200 `ScoreProposalResponse` (validated with `scoreProposalResponseSchema`).
- 400 `INVALID_REQUEST`; 404; 409; 422 `UNKNOWN_COMPONENTS` (`Unknown components: …`) or `INFERENCE_CONFIG_INVALID`; 502 `ENGINE_ERROR`.

## Engine client (internal)

`EngineClient.callTool(name, args, timeoutMs) → { text, warnings }` (throws `EngineToolError` on `isError`); `EngineClient.readResource(uri) → string`. Same lifecycle/crash handling as `analyze`.
