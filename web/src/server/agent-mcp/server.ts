// MCP server for agents (013-agent-mcp-bridge, research D2): a new stateless server per HTTP request over the
// web-standard streamable transport, with JSON responses. The tools are the adapters of tools.ts.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import webPackage from '../../../package.json';
import type { Runtime } from '../runtime';
import { agentToolDefinitions, callAgentTool, type ToolContext } from './tools';

const INSTRUCTIONS =
  'dev-arch analyzes Java and .NET projects for modernization. Call analyze_project with a project folder, then ' +
  'get_summary, get_proposals, get_findings or get_plan with the returned analysis_id. Open the returned url to see ' +
  'the same analysis in the dev-arch web.';

export function createAgentServer(ctx: ToolContext): McpServer {
  const server = new McpServer({ name: 'dev-arch', version: webPackage.version }, { instructions: INSTRUCTIONS });
  for (const tool of agentToolDefinitions()) {
    server.registerTool(tool.name, { description: tool.description, inputSchema: tool.shape }, async (args: unknown) =>
      (await callAgentTool(tool.name, args, ctx)) as never);
  }
  return server;
}

export async function handleAgentRequest(request: Request, rt: Runtime, baseUrl: string): Promise<Response> {
  const server = createAgentServer({ rt, baseUrl, authorization: request.headers.get('authorization') });
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    await server.close();
  }
}
