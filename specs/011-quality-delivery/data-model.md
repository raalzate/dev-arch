# Data Model: 011-quality-delivery

## JobEvent (línea de `<dataDir>/jobs/<id>/events.jsonl`)

| Campo | Tipo | Regla |
|---|---|---|
| ts | string ISO-8601 | instante del evento (reloj del servidor) |
| jobId | string UUID v4 | identificador del análisis |
| event | `queued` \| `started` \| `phase-start` \| `phase-end` \| `completed` \| `failed` | orden: queued → started → (phase-start → phase-end)* → completed\|failed |
| phase | `detection` \| `extraction` \| `inference` \| `writing` | solo en `phase-*` y en `failed` (última fase observada, si la hubo) |
| durationMs | entero ≥ 0 | en `phase-end` (fase) y en `completed`/`failed` (total) |
| status | `completed` \| `failed` | en el evento final |
| code | string | en `failed` (código de error de 007) |

Nunca contiene rutas ni mensajes del motor (FR-026).

## JobMetrics (campo `metrics` de `job.json` y de la vista pública)

| Campo | Tipo | Regla |
|---|---|---|
| queueMs | entero ≥ 0 | `startedAt − createdAt` |
| totalMs | entero ≥ 0 | `finishedAt − startedAt` |
| phases | objeto parcial `{ fase: ms }` | solo fases observadas; Σ phases ≤ totalMs |

Estado: ausente (`null`) hasta que el análisis termina.

## CoverageSummary (`web/coverage/summary.json`)

`{ "lines": { "covered": n, "total": n, "pct": n }, "files": { "<ruta>": { "covered", "total", "pct" } }, "threshold": 85, "missing": [] }`

## Decisión de frescura del analizador

`reuse` | `rebuild: missing` | `rebuild: forced` | `rebuild: <ruta relativa> is newer`
