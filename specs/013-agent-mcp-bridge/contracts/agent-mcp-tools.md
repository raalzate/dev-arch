# Contract: herramientas MCP para agentes (`POST /api/mcp`)

Servidor `dev-arch` (nombre MCP), versión = `VERSION` del producto. Transporte HTTP streamable sin estado, respuestas
JSON. Autorización: `Authorization: Bearer <DEVARCH_API_TOKEN>` cuando el servidor tiene token (401 sin él).
Cada resultado: `content: [{type:"text", text: <JSON con claves en orden fijo>}]` (sin `structuredContent`: las
herramientas no declaran `outputSchema`).
Errores: `isError: true` y texto `{"error":{"code","message","action"}}`.

| Herramienta | Entrada | Salida (completado) |
|---|---|---|
| `analyze_project` | `path` (string, carpeta), `language?` (`java`\|`dotnet`\|`auto`), `wait_seconds?` (0..900, def. 300) | `AnalysisRef` + `summary`. **Por HTTP directo** solo si el servidor permite rutas locales (`DEVARCH_ALLOW_LOCAL_PATH`); si no → `LOCAL_PATH_DISABLED` con acción "usa el puente". **Por el puente**: empaqueta y sube |
| `get_analysis` | `analysis_id`, `wait_seconds?` (0..900, def. 0) | `AnalysisRef` (+ `summary` si completado) |
| `list_analyses` | `limit?` (1..200, def. 20) | `{ analyses: AnalysisRef[] }` en el orden del historial de la web |
| `get_summary` | `analysis_id` | `AnalysisSummary` |
| `get_proposals` | `analysis_id` | `{ proposals: ProposalView[] }` |
| `get_findings` | `analysis_id`, `min_severity?` (`CRITICAL`\|`ERROR`\|`WARNING`\|`INFO`), `group_by?` (`severity`\|`pattern`, def. `severity`) | `FindingsView` |
| `get_plan` | `analysis_id` | `PlanView` |
| `get_document` | `analysis_id`, `document` (`graph`\|`architecture`\|`contracts`) | documento tal como `GET /api/analyses/{id}/{doc}` |
| `get_inference_parameters` | — | `{ parameters: InferenceParameter[] }` |
| `reinfer_proposals` | `analysis_id`, `config` (objeto 008), `min_viability?` | `{ proposals: ProposalView[], parameters }` |

Códigos de error: `NOT_FOUND`, `NOT_READY` (con `status`, `phase`), `ANALYSIS_FAILED` (con motivo),
`INVALID_INPUT`, `LOCAL_PATH_DISABLED`, `UNAUTHORIZED`, `TOO_LARGE`, `UNREACHABLE` (solo puente), `ENGINE_ERROR`.

Determinismo: misma entrada sobre el mismo análisis → mismo texto byte a byte.
