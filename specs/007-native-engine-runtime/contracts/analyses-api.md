# Contract: Analyses API (web)

Runtime: Node (`export const runtime = 'nodejs'`), Next.js route handlers under `web/src/app/api/`. Errors always `{"error": {"code": "<CODE>", "message": "<text>", ...extra}}`.

## Authentication (FR-035, optional)

When `DEVARCH_API_TOKEN` is set (non-blank), **every** endpoint below (`/api/analyses`, `/api/analyses/{id}`, `/api/analyses/{id}/{doc}`, `/api/analyses/import`, `/api/source`, `/api/analyze`) requires `Authorization: Bearer <token>`. Missing, malformed or different token → `401 {"error":{"code":"UNAUTHORIZED","message":"A valid API token is required (Authorization: Bearer <token>)."}}` + `WWW-Authenticate: Bearer realm="dev-arch"`, checked first (before the quota, the body and the job store; identical for existing and unknown jobs). Without the variable, no header is required (behaviour of 006). Startup warning when listening beyond loopback without a token: see plan.md note 15 (FR-036).

## Path exposure (FR-034)

Responses never contain absolute server paths: `projectRoot` in the status is relative (folder name inside the analysis sources, `.`, or the local folder base name); `graph|architecture|contracts` are served with `redactDocument` (prefix `<root>/` removed, exact root → `.`); `warnings` and `error.message` with `redactText`. Exceptions: `ENGINE_NOT_BUILT` (keeps the tried path, FR-032), `POST /api/analyze` (006 format) and imported documents (served as imported).

## Storage failures (FR-037)

Disk full (`ENOSPC`/`EDQUOT`) while storing an upload → `507 STORAGE_FULL`; during extraction or result writing → job `failed` with `STORAGE_FULL`; other write errors → `IO_ERROR`. Partial files are always removed.

## POST /api/analyses

Registers an analysis and returns before it runs (FR-001).

| Input | Rules |
|-------|-------|
| Body `application/zip` or `application/octet-stream` | ZIP bytes, streamed to disk with byte counting (research D8) |
| Body `multipart/form-data` field `file` | same limits (compatibility) |
| Body `application/json` `{ "localPath": "<abs dir>", "language"?: ... }` | only when `allowLocalPath` (FR-005); else 403 `LOCAL_PATH_DISABLED` |
| Query `language` | `java\|dotnet\|auto` (default `auto`); other → 400 `INVALID_LANGUAGE` |

| Response | When |
|----------|------|
| `202 {"jobId": "<uuid>", "status": "queued"\|"running"}` + `Location: /api/analyses/<id>` | accepted |
| `400 INVALID_ZIP` / `ZIP_ENTRY_OUTSIDE_ROOT` (+`entry`) / `ZIP_SYMLINK` (+`entry`) / `ZIP_DUPLICATE_ENTRY` (+`entry`) / `ZIP_TOO_MANY_ENTRIES` (+`limit`) / `INVALID_LANGUAGE` / `LOCAL_PATH_NOT_DIRECTORY` | validation |
| `413 UPLOAD_TOO_LARGE` (+`limitBytes`) / `UNCOMPRESSED_TOO_LARGE` (+`limitBytes`) | limits |
| `429 TOO_MANY_ANALYSES` + `Retry-After: 30` | running = max and queue full — checked **before** reading the body (FR-011) |
| `401 UNAUTHORIZED` | token configured and missing/wrong (all endpoints) |
| `507 STORAGE_FULL` | disk full while storing the upload (FR-037) |
| `500 ENGINE_NOT_BUILT` — message contains `Engine not built`, the tried path and `make build` | engine jar missing (FR-032, same text as 006 `resolveEngine`) |

Rejected submissions leave no files (FR-016). Response time target < 2 s for the Java demo ZIP (SC-004).

## GET /api/analyses/{id}

`{id}` must match the UUID regex, else 404 `NOT_FOUND`.

`200` →
```json
{
  "jobId": "…", "origin": "zip", "language": "auto",
  "status": "running", "phase": "extraction",
  "createdAt": "…", "startedAt": "…", "finishedAt": null,
  "error": null, "warnings": [], "summary": null,
  "projectRoot": "demo",
  "hasSources": true
}
```
`404 NOT_FOUND` when unknown or expired (FR-004). `Cache-Control: no-store`.

## GET /api/analyses/{id}/graph | /architecture | /contracts

| Status | Body |
|--------|------|
| 200 | the engine document as written (`output.json`, `output_architecture.json`, `output_entrypoints.json`) with only the `redactDocument` path relativization applied (byte-for-byte otherwise; imported documents unchanged), `Content-Type: application/json` |
| 409 `NOT_READY` (+`status`, `phase`) | job queued/running |
| 409 `ANALYSIS_FAILED` (+`error`) | job failed |
| 404 `NOT_FOUND` | unknown/expired id; `contracts` of an import without entrypoints |

The server validates each document with `@static-inference/schema` when the job completes (FR-003); a document that fails validation turns the job `failed` with `ENGINE_ERROR` "engine output violates contract 1.0.0: <pointer>".

## POST /api/analyses/import

Body `application/json` `{ "graph": {...}, "architecture": {...}, "entrypoints"?: {...} }`, ≤ `maxUploadBytes`.

| Status | Body |
|--------|------|
| 201 `{"jobId": "…", "status": "completed"}` | valid |
| 400 `MISSING_DOCUMENT` (+`document`) | graph or architecture missing |
| 422 `UNSUPPORTED_SCHEMA_VERSION` (+`document`, `found`, `supported: "1.0.0"`) | version mismatch |
| 422 `SCHEMA_VIOLATION` (+`violations: [{document, pointer, message}]`) | contract violations (all, ordered by document then pointer) |
| 413 `UPLOAD_TOO_LARGE` | size |

## GET /api/source?jobId=&path=

| Status | When |
|--------|------|
| 200 `{"path": "<relative>", "content": "<utf-8>"}` | regular file inside the job project root, allowed extension, ≤ `maxSourceViewBytes` |
| 400 `INVALID_PATH` | missing/empty, absolute, drive letter, backslash, NUL, `..` segment (after one URL decode) |
| 400 `EXTENSION_NOT_ALLOWED` (+`extension`) | extension outside allowlist |
| 413 `FILE_TOO_LARGE` (+`limitBytes`) | size |
| 409 `NO_SOURCES` | job without sources (import) |
| 404 `NOT_FOUND` | unknown job, nonexistent file, directory, or any containment failure after `realpath` (uniform, no existence leak) |

The legacy form `/api/source?path=<absolute>` (no `jobId`) → 400 `INVALID_PATH`.

## POST /api/analyze (006, deprecated)

Unchanged request (multipart `file`) and response `{componentsData, archData}` and error texts (TS-014/015/018/019 of 006). Changes: per-request job area (`origin: "sync"`), ZIP validated as above, CLI spawned with `cwd = <job>/out`, headers `Deprecation: true`, `Link: </api/analyses>; rel="successor-version"`.
