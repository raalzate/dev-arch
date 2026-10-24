// GET /api/health reports the agent MCP endpoint (013-agent-mcp-bridge, FR-020, research D8).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AGENT_TOOL_NAMES } from '../agent-mcp/catalog.ts';
import { toHealth, type DoctorReport } from './health.ts';

const report: DoctorReport = {
  tool: 'dev-arch doctor', version: '1.2.0', mode: 'local', platform: 'linux', status: 'OK', checks: [], engine: null,
};

test('the health body reports the agent endpoint, the bridge and the number of tools', () => {
  const { body } = toHealth(report, null);
  assert.deepEqual(body.agentMcp, { endpoint: '/api/mcp', bridge: '/dev-arch-mcp.mjs', tools: 10 });
  assert.equal(AGENT_TOOL_NAMES.length, 10);
});
