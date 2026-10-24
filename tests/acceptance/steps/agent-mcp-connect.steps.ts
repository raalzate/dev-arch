// 013-agent-mcp-bridge US4 (TS-022..TS-028): token, unreachable server, health, guide and bridge distribution.
import { Given, Then, When } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { bridge, BridgeClient, completedAnalysis, startAgentWeb } from '../support/agent-mcp.ts';
import { layout } from '../support/layout.ts';
import type { ApiResponse } from '../support/web-harness.ts';
import { freePort } from '../support/web.ts';
import type { DevArchWorld } from '../support/world.ts';

const BRIDGE = () => path.join(layout.webDir, 'public', 'dev-arch-mcp.mjs');
const TOOLS = ['analyze_project', 'get_analysis', 'list_analyses', 'get_summary', 'get_proposals', 'get_findings',
  'get_plan', 'get_document', 'get_inference_parameters', 'reinfer_proposals'];

Given('a dev-arch web server with the API token {string} and a completed analysis', async function (this: DevArchWorld, token: string) {
  await startAgentWeb(this, { env: { DEVARCH_API_TOKEN: token } });
  await completedAnalysis(this, 'java-standar', token);
});

When('an MCP client calls {string} on the agent endpoint with no token', async function (this: DevArchWorld, tool: string) {
  this.data.raw = await rawCall(this, tool, {});
});

When('an MCP client calls {string} on the agent endpoint with the token {string}', async function (this: DevArchWorld, tool: string, token: string) {
  this.data.raw = await rawCall(this, tool, { authorization: `Bearer ${token}` });
});

async function rawCall(w: DevArchWorld, tool: string, headers: Record<string, string>) {
  const res = await fetch(`${w.data.url as string}/api/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: tool, arguments: { analysis_id: w.data.analysisId } } }),
  });
  return { status: res.status, text: await res.text() };
}

Then('the response is unauthorized', function (this: DevArchWorld) {
  assert.equal((this.data.raw as { status: number }).status, 401);
});

Then('the response contains no analysis id', function (this: DevArchWorld) {
  assert.ok(!(this.data.raw as { text: string }).text.includes(this.data.analysisId as string));
});

Given('the agent bridge connected to that server with the token {string}', async function (this: DevArchWorld, token: string) {
  const b = bridge(this, ['--url', this.data.url as string, '--token', token]);
  await b.initialize();
});

When('the agent calls {string}', async function (this: DevArchWorld, tool: string) {
  this.data.result = await (this.data.bridge as BridgeClient).callTool(tool, {});
});

Given('the agent bridge connected to a server address where nothing listens', async function (this: DevArchWorld) {
  const port = await freePort();
  this.data.deadUrl = `http://127.0.0.1:${port}`;
  const b = bridge(this, ['--url', this.data.deadUrl as string]);
  await b.initialize();
});

Then('the error names that address and how to start dev-arch', function (this: DevArchWorld) {
  const err = JSON.parse((this.data.result as { content: { text: string }[] }).content[0].text).error;
  assert.ok(err.message.includes(this.data.deadUrl as string), err.message);
  assert.match(err.action, /make dev|docker compose/);
});

Then('the body reports the agent endpoint {string}, the bridge {string} and {int} tools', function (this: DevArchWorld, endpoint: string, file: string, tools: number) {
  const body = (this.data.response as ApiResponse).json as Record<string, any>;
  assert.deepEqual(body.agentMcp, { endpoint, bridge: file, tools });
});

// --- TS-027 ---------------------------------------------------------------------------------------------------

Given('the agent connection guide', function (this: DevArchWorld) {
  this.data.guide = readFileSync(path.join(layout.productRoot, 'docs', 'AGENTS-MCP.md'), 'utf8');
});

Then('it contains a {string} command for a local instance', function (this: DevArchWorld, cmd: string) {
  const guide = this.data.guide as string;
  assert.ok(guide.split('\n').some((l) => l.includes(cmd) && l.includes('127.0.0.1')), `no local "${cmd}"`);
});

Then('it contains a {string} command for a remote instance with a token', function (this: DevArchWorld, cmd: string) {
  const guide = this.data.guide as string;
  assert.ok(guide.split('\n').some((l) => l.includes(cmd) && /DEVARCH_API_TOKEN|Authorization: Bearer/.test(l) && /https:\/\//.test(l)), `no remote "${cmd}"`);
});

Then('it documents every agent tool and the upload limit', function (this: DevArchWorld) {
  const guide = this.data.guide as string;
  for (const t of TOOLS) assert.ok(guide.includes(`\`${t}\``), t);
  assert.match(guide, /MAX_UPLOAD_BYTES/);
});

Then('the install guide links to it', function () {
  assert.match(readFileSync(path.join(layout.productRoot, 'docs', 'INSTALL.md'), 'utf8'), /\(AGENTS-MCP\.md\)/);
});

// --- TS-028 ---------------------------------------------------------------------------------------------------

Given('the agent bridge source', function (this: DevArchWorld) {
  this.data.bridgeSource = readFileSync(BRIDGE(), 'utf8');
});

Then('it imports only built-in {string} modules', function (this: DevArchWorld, prefix: string) {
  const specs = [...(this.data.bridgeSource as string).matchAll(/^\s*import\s[^'"]*['"]([^'"]+)['"]/gm)].map((m) => m[1]);
  assert.ok(specs.length > 0);
  for (const s of specs) assert.ok(s.startsWith(prefix), s);
  assert.ok(!/\brequire\(/.test(this.data.bridgeSource as string));
});

Then('it is served by the web at {string}', function (this: DevArchWorld, urlPath: string) {
  assert.ok(existsSync(path.join(layout.webDir, 'public', urlPath.replace(/^\//, ''))));
});

Then('running it with {string} prints the product version', function (this: DevArchWorld, flag: string) {
  const out = execFileSync(process.execPath, [BRIDGE(), flag], { encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '' } }).trim();
  assert.equal(out, readFileSync(path.join(layout.productRoot, 'VERSION'), 'utf8').trim());
});
