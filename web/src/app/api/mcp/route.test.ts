// POST /api/mcp (013-agent-mcp-bridge): stateless streamable HTTP MCP endpoint for agents, token as the REST API.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupRouteEnv } from '../../../server/testing/route-harness.test.ts';
import { DELETE, GET, POST } from './route.ts';

const URL_ = 'http://127.0.0.1:9002/api/mcp';

function rpc(method: string, params: unknown, headers: Record<string, string> = {}, id = 1): Request {
  return new Request(URL_, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
}

const INIT = { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } };

test('initialize, tools/list and tools/call answer JSON without a session', async () => {
  const env = await setupRouteEnv();
  try {
    const { job } = await env.completedJob();
    const init = await POST(rpc('initialize', INIT));
    assert.equal(init.status, 200);
    const initBody = await init.json();
    assert.equal(initBody.result.serverInfo.name, 'dev-arch');

    const list = await (await POST(rpc('tools/list', {}))).json();
    const names = list.result.tools.map((t: { name: string }) => t.name);
    assert.equal(names.length, 10);
    assert.ok(names.includes('analyze_project') && names.includes('reinfer_proposals'));
    for (const t of list.result.tools) assert.equal(t.inputSchema.type, 'object');

    const call = await (await POST(rpc('tools/call', { name: 'get_analysis', arguments: { analysis_id: job.id } }, { host: 'dev-arch.example:9002' }))).json();
    const ref = JSON.parse(call.result.content[0].text);
    assert.equal(ref.analysis_id, job.id);
    assert.equal(ref.url, `http://dev-arch.example:9002/?analysis=${job.id}`);

    const bad = await (await POST(rpc('tools/call', { name: 'get_summary', arguments: { analysis_id: 'x' } }))).json();
    assert.equal(bad.result.isError, true);
  } finally {
    await env.restore();
  }
});

test('with an API token, calls without a valid token are unauthorized and reveal nothing', async () => {
  const env = await setupRouteEnv({ env: { DEVARCH_API_TOKEN: 'secret' } });
  try {
    const { job } = await env.completedJob();
    for (const headers of [{}, { authorization: 'Bearer wrong' }] as Record<string, string>[]) {
      const res = await POST(rpc('tools/call', { name: 'list_analyses', arguments: {} }, headers));
      assert.equal(res.status, 401);
      assert.ok(!(await res.text()).includes(job.id));
    }
    const ok = await POST(rpc('tools/call', { name: 'list_analyses', arguments: {} }, { authorization: 'Bearer secret' }));
    assert.equal(ok.status, 200);
    assert.ok((await ok.text()).includes(job.id));
  } finally {
    await env.restore();
  }
});

test('GET and DELETE are not supported by the stateless endpoint', async () => {
  const env = await setupRouteEnv();
  try {
    assert.equal((await GET()).status, 405);
    assert.equal((await DELETE()).status, 405);
  } finally {
    await env.restore();
  }
});
