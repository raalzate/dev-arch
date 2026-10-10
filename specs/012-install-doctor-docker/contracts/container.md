# Contract: imagen y Compose

## docker/Dockerfile (contexto = apps/dev-arch)

| Etapa | Base | Produce |
|---|---|---|
| engine | `maven:3.9-eclipse-temurin-17` | `/engine.jar` |
| analyzer | `mcr.microsoft.com/dotnet/sdk:8.0` | `/out/dotnet-analyzer` + `/out/dotnet-analyzer-publish/` (RID por `TARGETARCH`) |
| web | `node:20-bookworm-slim` | `web/.next/standalone` (+ `static`) |
| runtime (final, por defecto) | `mcr.microsoft.com/dotnet/runtime:8.0-bookworm-slim` + JRE de `eclipse-temurin:17-jre` + `node` de `node:20-bookworm-slim` | `/opt/dev-arch/{VERSION, scripts/doctor, web/server.js, web/engine-dist/{engine.jar,dotnet-analyzer,…}}`; `USER app`; `EXPOSE 9002`; `HEALTHCHECK` → `/api/health`; `CMD node server.js` |
| dev | `node:20-bookworm` + JRE + runtime .NET | analizador Linux en `/opt/dev-arch/engine`; fuentes montadas en `/app` |

Variables de la imagen: `PORT=9002`, `HOSTNAME=0.0.0.0`, `ENGINE_JAR_PATH=/opt/dev-arch/web/engine-dist/engine.jar`, `ARCHVIEW_DATA_DIR=/data`, `JAVA_HOME=/opt/java/openjdk`.

## docker/compose.yaml (`name: dev-arch`)

| Servicio | Perfil | Puertos | Notas |
|---|---|---|---|
| `web` | (ninguno = default) | `${DEV_ARCH_PORT:-9002}:9002` | `build: {context: .., dockerfile: docker/Dockerfile, target: runtime}`, `image: ${DEV_ARCH_IMAGE:-dev-arch:local}`, volumen `dev-arch-data:/data`, `mem_limit: ${DEV_ARCH_MEM_LIMIT:-4g}`, `JAVA_TOOL_OPTIONS=${JAVA_TOOL_OPTIONS:--Xmx2g}`, `GEMINI_API_KEY`, `GOOGLE_GENAI_API_KEY`, `LLM_MODEL`, `DEVARCH_API_TOKEN`, `ARCHVIEW_JOB_TTL_HOURS`, `restart: unless-stopped` |
| `web-dev` | `dev` | `9003:9002` | `target: dev`, `..:/app`, volúmenes anónimos de `node_modules`, `NODE_ENV=development` |

Sin perfil `split`, sin servicio `engine`, sin `ENGINE_TRANSPORT`/`--mcp-http`, sin configuración de proveedor.

## CI (`.github/workflows/dev-arch.yml`, trabajo `docker`)

`needs: changes`; `if` compuesto (filtro `docker`, `main`, tags `dev-arch-v*`); `timeout-minutes: 45`; pasos: checkout → setup-node 20 → `docker compose -f docker/compose.yaml build web` → `up -d web` → `bash docker/smoke-test.sh` → logs/down (`always()`) → en tags: login GHCR, tag y push `ghcr.io/${{ github.repository_owner }}/dev-arch:<VERSION>` y `:latest`.
