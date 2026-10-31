# Contract: `POST /api/analyses` with `config` (026, additive to 007 analyses-api)
- Query `config` (URL-encoded JSON object) with a ZIP/multipart body, or `config` object in the JSON body (`localPath`).
- Constraints: JSON object, ≤ 8192 characters → otherwise 400 `INVALID_CONFIG`.
- Stored as `extractionConfig` on the analysis; returned by `GET /api/analyses/{id}` and the history.
- Forwarded verbatim as `config` to the engine tool `analyze_project`; engine rejection → `failed` with `INFERENCE_CONFIG_INVALID`.
