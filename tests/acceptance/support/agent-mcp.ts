// Support of the 013-agent-mcp-bridge scenarios: an in-process web (WebHarness: real route handlers, stub engine)
// served over a real HTTP port, a completed demo analysis, an MCP client on the agent endpoint and the stdio bridge.
import { After } from '@cucumber/cucumber';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import assert from 'node:assert/strict';
import path from 'node:path';
import { BridgeClient, startWebServer, type ToolCallResult, type WebServer } from '../../../web/src/server/testing/agent-http.test.ts';
import { layout } from './layout.ts';
import { demoZip } from './web.ts';
import { WebHarness, type ApiClient, type HarnessOptions } from './web-harness.ts';
import type { DevArchWorld } from './world.ts';

export { BridgeClient, type ToolCallResult };

export const demoFolder = (project: string) => path.join(layout.engineRoot, 'test-for-demo', project);

/** In-process web with the stub engine, reachable over HTTP (/api/analyses and /api/mcp). */
export async function startAgentWeb(world: DevArchWorld, opts: HarnessOptions = {}): Promise<WebServer> {
  world.data.agentHarness = await WebHarness.start(world, opts);
  const web = await startWebServer();
  world.data.agentWeb = web;
  world.data.url = web.url;
  return web;
}

export function api(world: DevArchWorld): ApiClient {
  const a = world.data.api as ApiClient | undefined;
  assert.ok(a, 'no web server');
  return a;
}

/** Uploads the ZIP of a demo project through the REST API and waits until the analysis ends. */
export async function completedAnalysis(world: DevArchWorld, project: string, token?: string): Promise<string> {
  const headers: Record<string, string> = { 'content-type': 'application/zip' };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await api(world).call('POST', '/api/analyses', { body: demoZip(layout.engineRoot, project), headers });
  assert.equal(res.status, 202, res.text);
  const id = res.json.jobId as string;
  const deadline = Date.now() + 60_000;
  for (;;) {
    const s = await api(world).call('GET', `/api/analyses/${id}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
    if (s.json.status === 'completed') break;
    assert.notEqual(s.json.status, 'failed', s.text);
    assert.ok(Date.now() < deadline, `analysis ${id} did not finish`);
    await new Promise((r) => setTimeout(r, 100));
  }
  world.data.analysisId = id;
  world.data.completedId = id;
  return id;
}

export async function mcpClient(world: DevArchWorld, token?: string): Promise<Client> {
  const web = world.data.agentWeb as WebServer;
  const client = new Client({ name: 'devarch-013-acceptance', version: '0' });
  const transport = new StreamableHTTPClientTransport(new URL(`${web.url}/api/mcp`), {
    requestInit: token ? { headers: { authorization: `Bearer ${token}` } } : undefined,
  });
  await client.connect(transport);
  world.data.agentMcpClient = client;
  return client;
}

export function bridge(world: DevArchWorld, args: string[], env: Record<string, string | undefined> = {}, script?: string): BridgeClient {
  const b = new BridgeClient(args, { DEVARCH_API_TOKEN: undefined, ...env }, script);
  world.data.bridge = b;
  return b;
}

export function textOf(r: ToolCallResult | { content: unknown }): string {
  return (r.content as { text: string }[])[0].text;
}

export function jsonOf(r: ToolCallResult | { content: unknown }): any {
  return JSON.parse(textOf(r));
}

After(async function (this: DevArchWorld) {
  await (this.data.bridge as BridgeClient | undefined)?.close();
  await (this.data.agentMcpClient as Client | undefined)?.close().catch(() => undefined);
  await (this.data.agentWeb as WebServer | undefined)?.close();
  // A later step may start its own harness (007 "an analysis that is still running"): stop the newest one first,
  // then the first one, so the original working directory and environment are restored (stop() is idempotent).
  const first = this.data.agentHarness as WebHarness | undefined;
  if (first && first !== this.data.harness) {
    await (this.data.harness as WebHarness).stop();
    await first.stop();
  }
});
