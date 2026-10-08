# Data Model: 007-native-engine-runtime

**Date**: 2026-10-08 | **Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

## Job (web, `.archview/jobs/<id>/job.json`)

| Campo | Tipo | Reglas |
|-------|------|--------|
| `id` | string | `crypto.randomUUID()`; regex `^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`; también nombre del directorio |
| `origin` | `"zip" \| "localPath" \| "import" \| "sync"` | `sync` = petición de `/api/analyze` (006, obsoleta) |
| `language` | `"java" \| "dotnet" \| "auto"` | por defecto `auto`; `import` no aplica (`auto`) |
| `status` | `"queued" \| "running" \| "completed" \| "failed"` | transiciones abajo |
| `phase` | `null \| "detection" \| "extraction" \| "inference" \| "writing"` | monótona no decreciente mientras `running`; `null` en `queued` |
| `createdAt`, `startedAt`, `finishedAt` | ISO-8601 UTC \| null | `finishedAt` fija la caducidad |
| `error` | `null \| { code, message }` | `code` ∈ `ENGINE_NOT_BUILT`, `AMBIGUOUS_PROJECT`, `ENGINE_ERROR`, `ENGINE_CRASHED`, `ENGINE_UNAVAILABLE`, `TIMEOUT`, `INTERRUPTED`, `UNCOMPRESSED_TOO_LARGE`, `STORAGE_FULL`, `IO_ERROR`; `message` resumido (sin trazas, rutas relativizadas al exponerse, FR-034) |
| `warnings` | string[] | copiadas de `_meta["static-inference/warnings"]`; `[]` si no hay |
| `projectRoot` | string \| null | ruta absoluta pasada al motor (`source/<raíz>` o carpeta local); `null` en `import`. **Solo interno**: la API expone su forma relativa (FR-034) |
| `summary` | `null \| { componentCount, edgeCount, proposalCount, endpointCount }` | de la respuesta `analyze_project` (contrato 1.0.0) |
| `uploadBytes` | integer \| null | tamaño recibido |

**Transiciones**: `queued → running → completed | failed`; `queued → failed` (`INTERRUPTED` al reiniciar, `ENGINE_NOT_BUILT`); `running → failed` (`ENGINE_*`, `TIMEOUT`, `INTERRUPTED`, `IO_ERROR`, `AMBIGUOUS_PROJECT`); `import` nace `completed`; `sync` nace `running` y termina como la ruta síncrona. Estados terminales: `completed`, `failed`. Solo terminales caducan.

**Persistencia**: escritura atómica (`job.json.tmp` + `rename`); cada cambio de `status`/`phase` se persiste antes de notificarse.

## Área de trabajo del job

```text
<ARCHVIEW_DATA_DIR>/jobs/<id>/
  job.json
  upload.zip        # borrado tras extracción correcta o ante rechazo
  source/           # extracción validada (ausente en import)
  out/              # output.json, output_architecture.json, output_entrypoints.json
  engine.log        # líneas stderr del motor mientras el job estuvo en vuelo
```

## Política de carga (`UploadPolicy`, web)

`apiToken` (opcional, FR-035), `maxUploadBytes`, `maxUncompressedBytes`, `maxZipEntries`, `maxConcurrent`, `maxQueued`, `jobTtlHours`, `cleanupIntervalMs`, `analysisTimeoutMs`, `maxSourceViewBytes`, `allowLocalPath`, `sourceExtensions` (lista blanca, research D10). Se carga una vez desde el entorno (research D13) y valida tipos/rangos.

## Servicio del motor (`EngineService`, web)

| Campo | Tipo | Reglas |
|-------|------|--------|
| `state` | `"stopped" \| "starting" \| "ready" \| "crashed" \| "unavailable"` | `unavailable` tras > 3 caídas en 60 s, durante 60 s |
| `inFlight` | Map<jobId, AbortController> | llamadas activas |
| `recycleWhenIdle` | boolean | tras un `TIMEOUT` (research D14) |
| `restarts` | timestamps | ventana de 60 s |

## Motor (Java, núcleo `com.extractor.service`)

- **`AnalysisPhase`** (enum): `DETECTION`, `EXTRACTION`, `INFERENCE`, `WRITING` — nombre en protocolo: minúsculas inglesas (`detection`…).
- **`AnalysisProgressListener`** (interfaz funcional): `onPhase(AnalysisPhase)`; `NOOP`.
- **`AnalysisLanguage`** (enum): `JAVA`, `DOTNET`, `AUTO`; `parse(String)` acepta `java|dotnet|auto` (minúsculas, sin espacios) o lanza `IllegalArgumentException("Invalid language '<x>'. Allowed: java, dotnet, auto")`; `null` → `AUTO`.
- **`AnalysisOptions`** (record): `language` (por defecto `AUTO`).
- **`AnalysisCache`**: clave `(realPath, language, treeFingerprint)`; valor `AnalysisResult`; capacidad configurable (D6); `0` = desactivada; estadística `hits`/`misses` para pruebas.
- **`AnalysisResult.warnings`**: lista ordenada por aparición; textos con forma `"<qué>: <por qué> (<qué se omitió>)"`, rutas relativas a la raíz del proyecto.

## Importación (web)

Petición `{ graph, architecture, entrypoints? }` → validación por documento → `ImportViolation { document: "graph" | "architecture" | "entrypoints", pointer: string (JSON Pointer), message: string }`.
