# Research: 013-agent-mcp-bridge

## D1 — Dónde vive el servidor MCP para agentes

- **Decision**: En la web (`POST /api/mcp`), no en el motor.
- **Rationale**: El historial, la cola, el almacén, la redacción de rutas, el token y las vistas de modernización
  (resumen, propuestas ordenadas, hallazgos agrupados, plan) viven en la web. El motor solo conoce documentos y no
  ve análisis subidos. 012 FR-022 prohíbe transporte MCP por red en el motor/Compose; un endpoint de la web en el
  mismo puerto no añade servicio, perfil ni transporte al motor (TS-028 intacto).
- **Alternatives**: transporte HTTP en el motor (prohibido por 012 y sin historial); servidor MCP separado (un
  proceso/puerto más, VI).

## D2 — Transporte

- **Decision**: `WebStandardStreamableHTTPServerTransport` del SDK 1.32.1 en modo sin estado
  (`sessionIdGenerator: undefined`, `enableJsonResponse: true`), un `McpServer` nuevo por petición.
- **Rationale**: Las rutas de Next.js reciben `Request` y devuelven `Response` estándar; sin estado evita sesiones
  en memoria (contenedor reiniciable) y funciona detrás de proxies. Claude Code soporta `--transport http`.
- **Alternatives**: SSE (obsoleto en la especificación MCP); `StreamableHTTPServerTransport` de Node (requiere
  `IncomingMessage`/`ServerResponse`, no disponibles en el handler de Next).

## D3 — Envío de la carpeta local

- **Decision**: Puente stdio sin dependencias (`web/public/dev-arch-mcp.mjs`) que empaqueta la carpeta y la sube con
  la API REST existente (`POST /api/analyses`, ZIP).
- **Rationale**: El servidor puede estar en contenedor o remoto (FR-002). Reutiliza toda la validación de carga de
  007 (FR-004). Un archivo servido por la propia instancia se instala con una descarga.
- **Alternatives**: argumentos base64 en la herramienta (el modelo no puede generar ZIP grandes); `localPath` solo
  (no funciona en contenedor); paquete npm publicado (requiere registro y versión aparte).

## D4 — Escritura del ZIP

- **Decision**: Escritor ZIP mínimo (cabeceras locales + directorio central, `deflateRawSync`, CRC32 de
  `node:zlib.crc32` con alternativa en tabla), entradas en orden lexicográfico y fecha DOS fija (1980-01-01).
- **Rationale**: Sin dependencias; ZIP determinista; Node ≥ 20 trae `zlib`.
- **Exclusiones** (FR-003): `.git`, `.svn`, `.hg`, `node_modules`, `target`, `build`, `out`, `bin`, `obj`,
  `.gradle`, `.idea`, `.vs`, `.vscode`, `.next`, `dist`, `packages` (NuGet), `TestResults`, `.DS_Store`; enlaces
  simbólicos se omiten; límite previo de tamaño local = `ARCHVIEW_MAX_UPLOAD_MB` remoto (descubierto por el error
  413 del servidor, sin duplicar el valor).

## D5 — Vistas para el agente (FR-010)

- **Decision**: `views.ts` arma `AnalysisView` igual que `software-architecture-analyzer.tsx` (grafo, arquitectura,
  contratos, advertencias) leyendo los documentos redactados del almacén, y llama a `technologyProfile`,
  `summarize`, `orderProposals`, `allIssues` + `groupIssues`, `buildPlan` + `planToMarkdown`.
- **Rationale**: Una sola implementación; las respuestas coinciden con la web por construcción (SC-002).

## D6 — Enlace a la web

- **Decision**: `DEVARCH_PUBLIC_URL` si está definida; si no, el origen de la petición (`x-forwarded-proto/host` o
  `Host`). Ruta `/?analysis=<id>`; la web lo toma como análisis activo y limpia el parámetro.

## D7 — Token

- **Decision**: `checkApiToken` existente sobre la petición HTTP. El puente lee `DEVARCH_API_TOKEN` del entorno o
  `--token` y lo envía como `Authorization: Bearer` en REST y MCP.

## D8 — Salud / diagnóstico (FR-020)

- **Decision**: `GET /api/health` añade `agentMcp: { endpoint: "/api/mcp", bridge: "/dev-arch-mcp.mjs", tools: n }`
  (campo nuevo de primer nivel; el objeto `engine` fijado por 012 no cambia). El doctor no cambia (sus listas de
  verificaciones están fijadas por 012).

## D9 — Ícono y margen

- **Decision**: Marca geométrica propia (nodos conectados en un cuadrado redondeado, color de acento del tema) como
  componente SVG `BrandMark` y `web/src/app/icon.svg` (convención de Next para el ícono de pestaña; se elimina
  `favicon.ico`). Encabezado con relleno superior (`pt-3`) dentro del bloque fijo para que el espacio se mantenga al
  desplazarse.

## Tessl Tiles

No se instalan tiles nuevos: sin tecnologías nuevas.
