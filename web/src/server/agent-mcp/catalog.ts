// Catalog of the agent MCP endpoint (013-agent-mcp-bridge): names only, so light modules (health) can report it
// without loading the tools.
export const AGENT_MCP_ENDPOINT = '/api/mcp';
export const AGENT_MCP_BRIDGE = '/dev-arch-mcp.mjs';

export const AGENT_TOOL_NAMES = [
  'analyze_project',
  'get_analysis',
  'list_analyses',
  'get_summary',
  'get_proposals',
  'get_findings',
  'get_plan',
  'get_document',
  'get_inference_parameters',
  'reinfer_proposals',
] as const;

export type AgentToolName = (typeof AGENT_TOOL_NAMES)[number];
