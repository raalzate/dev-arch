# Using dev-arch from a coding agent (MCP)

dev-arch exposes its analysis to coding agents such as Claude Code through the Model Context Protocol. The agent
sends the project folder it is working on, waits for the analysis and receives the summary, the extraction
proposals, the findings and the modernization plan. Every analysis sent by an agent is a normal analysis of the
server: it appears in the web history, and each result carries a link (`/?analysis=<id>`) that opens it in the web.

![Claude Code using dev-arch over MCP](images/agent-claude-code.png)

*Real `claude -p` session: the agent sends the folder, receives proposals and findings, and the link to the same
analysis in the web.*

There are two ways to connect:

| Connection | Use it when | Sends local folders |
|---|---|---|
| **Bridge** `dev-arch-mcp.mjs` (stdio) | dev-arch runs in a container, on another machine, or locally | Yes: the bridge packages the folder and uploads it |
| **HTTP** `POST /api/mcp` | you only query existing analyses, or the server can read the agent's disk (`DEVARCH_ALLOW_LOCAL_PATH=true`) | Only paths the server can read |

## Register dev-arch in Claude Code

Start dev-arch first (`make dev`, or `docker compose -f docker/compose.yaml up -d`; see [INSTALL.md](INSTALL.md)).

### Local instance or container (recommended)

The bridge is one file with no dependencies (Node 20 or newer). Every dev-arch server serves it:

```bash
curl -fsSo ~/.dev-arch-mcp.mjs http://127.0.0.1:9002/dev-arch-mcp.mjs
claude mcp add dev-arch -- node ~/.dev-arch-mcp.mjs --url http://127.0.0.1:9002
```

From a checkout of the repository you can point at the file directly:
`claude mcp add dev-arch -- node <dev-arch checkout>/web/public/dev-arch-mcp.mjs`.

### Remote instance with an API token

When the server sets `DEVARCH_API_TOKEN`, the agent must send the same token:

```bash
curl -fsSo ~/.dev-arch-mcp.mjs https://dev-arch.example.com/dev-arch-mcp.mjs
claude mcp add dev-arch -e DEVARCH_API_TOKEN=<token> -- node ~/.dev-arch-mcp.mjs --url https://dev-arch.example.com
```

### HTTP only (queries)

```bash
claude mcp add --transport http dev-arch http://127.0.0.1:9002/api/mcp
# with a token
claude mcp add --transport http dev-arch https://dev-arch.example.com/api/mcp --header "Authorization: Bearer <token>"
```

Check the connection with `claude mcp list` or `/mcp` inside Claude Code. `GET /api/health` reports the endpoint in
`agentMcp`.

## Tools

| Tool | Input | Returns |
|---|---|---|
| `analyze_project` | `path`, `language` (`java`, `dotnet`, `auto`), `wait_seconds` (default 300, max 900) | analysis id, status, link and, once completed, the summary |
| `get_analysis` | `analysis_id`, `wait_seconds` (default 0) | status, phase, link; the summary once completed |
| `list_analyses` | `limit` (default 20) | the web history, newest first |
| `get_summary` | `analysis_id` | the Summary step: technology, totals, severities, top candidates and risky components |
| `get_proposals` | `analysis_id` | the Proposals step: proposals in the web order with viability, metrics, tables and components |
| `get_findings` | `analysis_id`, `min_severity`, `group_by` (`severity`, `pattern`) | the Findings step grouped and filtered |
| `get_plan` | `analysis_id` | the Plan step as Markdown plus the structured plan |
| `get_document` | `analysis_id`, `document` (`graph`, `architecture`, `contracts`) | the full result document, as the REST API serves it |
| `get_inference_parameters` | — | the inference parameters of the web panel with default and range |
| `reinfer_proposals` | `analysis_id`, `config`, `min_viability` | the proposals recomputed with other parameters, without analyzing again |

Errors come back as tool results with `isError` and `{"error": {"code", "message", "action"}}`. Codes:
`NOT_FOUND`, `NOT_READY` (still running: call `get_analysis` with `wait_seconds`), `ANALYSIS_FAILED`,
`INVALID_INPUT`, `LOCAL_PATH_DISABLED` (use the bridge), `UNAUTHORIZED`, `TOO_LARGE`, `UNREACHABLE` (bridge only:
dev-arch is not running at `--url`), `ENGINE_ERROR`.

## Limits and what is sent

- The bridge sends the source folder as a ZIP. It skips `.git`, `.svn`, `.hg`, `node_modules`, `target`, `build`,
  `out`, `bin`, `obj`, `.gradle`, `.idea`, `.vs`, `.vscode`, `.next`, `dist`, `packages`, `TestResults` and symbolic
  links.
- The upload limit is the server one: `MAX_UPLOAD_BYTES` (default 200 MB), `MAX_UNCOMPRESSED_BYTES` (1 GB) and
  `MAX_ZIP_ENTRIES` (100 000). Larger folders answer `TOO_LARGE`.
- An analysis longer than `wait_seconds` returns its id and status; ask again with `get_analysis`.
- Responses are deterministic: the same request on the same analysis returns the same bytes.
- Set `DEVARCH_PUBLIC_URL` on the server when it is behind a proxy so the links point to the public address.
