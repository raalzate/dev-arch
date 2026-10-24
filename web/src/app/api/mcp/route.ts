// POST /api/mcp (013-agent-mcp-bridge, contracts/agent-mcp-tools.md): MCP endpoint for coding agents. Stateless
// streamable HTTP with JSON responses; the optional API token is required exactly as for the REST API.
import { NO_STORE } from '../../../server/http';
import { getRuntime } from '../../../server/runtime';
import { checkApiToken } from '../../../server/security/api-token';
import { baseUrlOf } from '../../../server/agent-mcp/links';
import { handleAgentRequest } from '../../../server/agent-mcp/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const rt = getRuntime();
  const denied = checkApiToken(request, rt.config.apiToken);
  if (denied) return denied;
  return handleAgentRequest(request, rt, baseUrlOf(request));
}

function notAllowed(): Response {
  return Response.json(
    { jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed: this MCP endpoint is stateless (POST only).' }, id: null },
    { status: 405, headers: { Allow: 'POST', ...NO_STORE } },
  );
}

export async function GET(): Promise<Response> {
  return notAllowed();
}

export async function DELETE(): Promise<Response> {
  return notAllowed();
}
