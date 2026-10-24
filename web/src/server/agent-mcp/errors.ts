// Typed errors of the agent MCP tools (013-agent-mcp-bridge, contracts/agent-mcp-tools.md): rendered as an MCP tool
// result with isError and {"error": {"code", "message", "action"}}.
export type AgentErrorCode =
  | 'NOT_FOUND'
  | 'NOT_READY'
  | 'ANALYSIS_FAILED'
  | 'INVALID_INPUT'
  | 'LOCAL_PATH_DISABLED'
  | 'UNAUTHORIZED'
  | 'TOO_LARGE'
  | 'ENGINE_ERROR';

export class AgentError extends Error {
  constructor(
    readonly code: AgentErrorCode | string,
    message: string,
    readonly action: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'AgentError';
  }
}

export interface ToolResult {
  content: { type: 'text'; text: string }[];
  isError?: true;
}

export function okResult(value: unknown): ToolResult {
  return { content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }] };
}

export function errorResult(e: AgentError): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: { code: e.code, message: e.message, action: e.action, ...e.extra } }) }],
    isError: true,
  };
}
