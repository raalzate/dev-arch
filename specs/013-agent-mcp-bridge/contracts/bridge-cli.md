# Contract: puente `dev-arch-mcp.mjs`

```
node dev-arch-mcp.mjs [--url <base>] [--token <token>]
```

- `--url`: base de la instancia (por defecto `DEVARCH_URL` o `http://127.0.0.1:9002`).
- `--token`: por defecto `DEVARCH_API_TOKEN`.
- Habla MCP por stdio (JSON-RPC por líneas). `initialize`, `tools/list` y cualquier `tools/call` distinto de
  `analyze_project` se reenvían tal cual a `<base>/api/mcp`.
- `tools/call analyze_project {path, language?, wait_seconds?}`: valida la carpeta, la empaqueta (exclusiones de
  research D4, sin enlaces simbólicos, ZIP determinista), `POST <base>/api/analyses?language=…` con
  `Content-Type: application/zip`, y llama `get_analysis {analysis_id, wait_seconds}` en el servidor; devuelve su
  resultado.
- Servidor inalcanzable → resultado `isError` `UNREACHABLE` con la URL intentada y "arranca dev-arch (`make dev` o
  `docker compose -f docker/compose.yaml up -d`)".
- Errores HTTP de la carga (400/401/413/422) → `isError` con el código del servidor.
- `--version` imprime la versión y termina; `--help` imprime el uso.
- Sin dependencias: solo módulos `node:` (Node ≥ 20).

Registro en Claude Code:

```
# instancia local o contenedor
curl -fsSo ~/.dev-arch-mcp.mjs http://127.0.0.1:9002/dev-arch-mcp.mjs
claude mcp add dev-arch -- node ~/.dev-arch-mcp.mjs --url http://127.0.0.1:9002
# remota con token
claude mcp add dev-arch -e DEVARCH_API_TOKEN=<token> -- node ~/.dev-arch-mcp.mjs --url https://dev-arch.example.com
# solo consultas (sin envío de carpetas) por HTTP directo
claude mcp add --transport http dev-arch http://127.0.0.1:9002/api/mcp
```
