# Contract: registro estructurado y métricas de análisis (US6)

- Archivo: `<dataDir>/jobs/<id>/events.jsonl` (UTF-8, una línea JSON por evento, solo añadir).
- Secuencia para un análisis completado: `queued`, `started`, por cada fase observada `phase-start` y `phase-end` (`durationMs`), `completed` (`status`, `durationMs` = total).
- Análisis fallido: el último evento es `failed` con `status: "failed"`, `code`, `phase` (última observada si la hubo) y `durationMs`.
- `GET /api/analyses/{id}` añade `metrics: { queueMs, totalMs, phases } | null` (aditivo; el resto de la vista de 007 no cambia).
- Consola del servidor al terminar: una línea JSON `{"level":"info"|"warn","msg":"analysis finished","jobId","status","code"?,"totalMs"}`.
- Un error al escribir eventos se ignora (no cambia el estado final).
