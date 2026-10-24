# Quickstart: 013-agent-mcp-bridge

1. `make build && make dev` (o `docker compose -f docker/compose.yaml up -d`).
2. `curl -fsSo ~/.dev-arch-mcp.mjs http://127.0.0.1:9002/dev-arch-mcp.mjs`
3. `claude mcp add dev-arch -- node ~/.dev-arch-mcp.mjs --url http://127.0.0.1:9002`
4. En Claude Code: "Analiza `engine/test-for-demo/java-standar` con dev-arch y dame las propuestas".
   - Esperado: `analyze_project` → resumen con componentes > 0, `analysis_id` y `url`.
   - `get_proposals`, `get_findings {min_severity: "ERROR"}`, `get_plan` responden.
5. Abrir la `url`: la web muestra ese análisis y aparece en Historial.
6. Con `DEVARCH_API_TOKEN=secreto` en el servidor y sin token en el puente: cada herramienta → `UNAUTHORIZED`.
7. UI: el encabezado muestra el ícono y espacio superior; la pestaña muestra el ícono de dev-arch.

Pruebas: `npm test -w web` (herramientas, vistas, ruta MCP y puente), `make test` (incluye los escenarios 013
no lentos) y `DEVARCH_E2E=true` con `--tags @slow` para el recorrido real puente → web → motor.
