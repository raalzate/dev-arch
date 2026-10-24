// 013-agent-mcp-bridge US2 + US3 (TS-010..TS-021): an MCP client on the agent endpoint reads the analysis by parts
// and recomputes proposals; every expectation is computed with the web modernization logic over the REST documents.
import { Given, Then, When } from '@cucumber/cucumber';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import assert from 'node:assert/strict';
import type { ConsolidatedArchitecture, DependencyGraph, EntrypointsDocument } from '@static-inference/schema';
import { allIssues, groupIssues } from '../../../web/src/lib/modernization/findings.ts';
import { planToMarkdown } from '../../../web/src/lib/modernization/markdown.ts';
import { orderProposals } from '../../../web/src/lib/modernization/ordering.ts';
import { buildPlan } from '../../../web/src/lib/modernization/plan.ts';
import { summarize } from '../../../web/src/lib/modernization/summary.ts';
import { technologyProfile } from '../../../web/src/lib/modernization/technology.ts';
import { api, completedAnalysis, jsonOf, mcpClient, startAgentWeb, textOf, type ToolCallResult } from '../support/agent-mcp.ts';
import type { WebHarness } from '../support/web-harness.ts';
import type { DevArchWorld } from '../support/world.ts';

const client = (w: DevArchWorld) => w.data.agentMcpClient as Client;
const result = (w: DevArchWorld) => w.data.result as ToolCallResult;
const plain = <T>(v: T): T => JSON.parse(JSON.stringify(v));

async function call(w: DevArchWorld, name: string, args: Record<string, unknown> = {}): Promise<ToolCallResult> {
  return (await client(w).callTool({ name, arguments: args })) as unknown as ToolCallResult;
}

async function webView(w: DevArchWorld) {
  const id = w.data.completedId as string;
  const doc = async (d: string) => (await api(w).call('GET', `/api/analyses/${id}/${d}`)).text;
  const texts = { graph: await doc('graph'), architecture: await doc('architecture'), contracts: await doc('contracts') };
  const graph = JSON.parse(texts.graph) as DependencyGraph;
  const architecture = JSON.parse(texts.architecture) as ConsolidatedArchitecture;
  const contracts = JSON.parse(texts.contracts) as EntrypointsDocument;
  const status = await api(w).call('GET', `/api/analyses/${id}`);
  const view = { graph, architecture, contracts, warnings: status.json.warnings as string[] };
  return { id, texts, view, profile: technologyProfile(graph), status: status.json };
}

// --- background -----------------------------------------------------------------------------------------------

Given('a dev-arch web server with a completed analysis of the demo project {string}', async function (this: DevArchWorld, project: string) {
  await startAgentWeb(this);
  await completedAnalysis(this, project);
});

Given('an MCP client connected to the agent endpoint of that server', async function (this: DevArchWorld) {
  await mcpClient(this);
});

// --- TS-010 ---------------------------------------------------------------------------------------------------

When('the client lists the tools', async function (this: DevArchWorld) {
  this.data.tools = (await client(this).listTools()).tools;
});

Then('the tools are exactly {string}, {string}, {string}, {string}, {string}, {string}, {string}, {string}, {string} and {string}', function (
  this: DevArchWorld, n1: string, n2: string, n3: string, n4: string, n5: string, n6: string, n7: string, n8: string, n9: string, n10: string,
) {
  const names = [n1, n2, n3, n4, n5, n6, n7, n8, n9, n10];
  const tools = this.data.tools as { name: string }[];
  assert.deepEqual(tools.map((t) => t.name).sort(), [...names].sort());
});

Then('every tool declares an input schema', function (this: DevArchWorld) {
  for (const t of this.data.tools as { name: string; inputSchema: { type: string } }[]) assert.equal(t.inputSchema?.type, 'object', t.name);
});

// --- TS-011..TS-015 -------------------------------------------------------------------------------------------

When('the client calls {string} for that analysis', async function (this: DevArchWorld, tool: string) {
  this.data.result = await call(this, tool, { analysis_id: this.data.jobId ?? this.data.analysisId });
});

When('the client calls {string} for that analysis with the minimum severity {string}', async function (this: DevArchWorld, tool: string, min: string) {
  this.data.result = await call(this, tool, { analysis_id: this.data.analysisId, min_severity: min });
  this.data.minSeverity = min;
});

When('the client calls {string} for that analysis with the document {string}', async function (this: DevArchWorld, tool: string, document: string) {
  this.data.result = await call(this, tool, { analysis_id: this.data.analysisId, document });
});

Then('the result equals the summary computed by the web modernization logic for the same documents', async function (this: DevArchWorld) {
  const w = await webView(this);
  assert.deepEqual(jsonOf(result(this)), plain(summarize(w.view, w.profile)));
});

Then('the proposals are in the order of the web proposals step', async function (this: DevArchWorld) {
  const w = await webView(this);
  assert.deepEqual(jsonOf(result(this)).proposals, plain(orderProposals(w.view.architecture.proposals)));
});

Then('each proposal has its viability, cohesion, external coupling, tables and components', function (this: DevArchWorld) {
  const proposals = jsonOf(result(this)).proposals as any[];
  assert.ok(proposals.length > 0);
  for (const p of proposals) {
    assert.ok(['Alta', 'Media', 'Baja'].includes(p.viability));
    assert.equal(typeof p.metrics.cohesion_avg, 'number');
    assert.equal(typeof p.metrics.external_coupling, 'number');
    assert.ok(Array.isArray(p.tables ?? []));
    assert.ok(Array.isArray(p.components) && p.components.length > 0);
  }
});

Then('every finding returned has the severity {string} or {string}', function (this: DevArchWorld, a: string, b: string) {
  for (const g of jsonOf(result(this)).groups) for (const i of g.issues) assert.ok([a, b].includes(i.severity), i.severity);
});

Then('the total equals the number of findings of severity {string} or {string} in the web findings step', async function (this: DevArchWorld, a: string, b: string) {
  const w = await webView(this);
  const expected = allIssues(w.view.graph).filter((i) => i.severity === a || i.severity === b).length;
  assert.equal(jsonOf(result(this)).total, expected);
  assert.deepEqual(jsonOf(result(this)).groups, plain(groupIssues(allIssues(w.view.graph), 'severity', this.data.minSeverity as never)));
});

Then('the result has the markdown of the plan exported by the web', async function (this: DevArchWorld) {
  const w = await webView(this);
  const project = w.status.projectRoot && w.status.projectRoot !== '.' ? w.status.projectRoot : 'proyecto';
  const plan = buildPlan(w.view, w.profile, { project, analysisId: w.id, finishedAt: w.status.finishedAt });
  assert.equal(jsonOf(result(this)).markdown, planToMarkdown(plan));
});

Then('the result has the structured plan with its stages', function (this: DevArchWorld) {
  const plan = jsonOf(result(this)).plan;
  assert.ok(Array.isArray(plan.stages) && plan.stages.length > 0);
});

Then('the result equals the body of the web API document {string} of that analysis', async function (this: DevArchWorld, document: string) {
  const w = await webView(this);
  assert.equal(textOf(result(this)), w.texts[document as keyof typeof w.texts]);
});

// --- TS-016 ---------------------------------------------------------------------------------------------------

When('the client calls {string}', async function (this: DevArchWorld, tool: string) {
  this.data.result = await call(this, tool);
});

Then('the analyses are the ones of the web history in the same order', async function (this: DevArchWorld) {
  const web = (await api(this).call('GET', '/api/analyses')).json.analyses as { jobId: string }[];
  assert.deepEqual(jsonOf(result(this)).analyses.map((a: { analysis_id: string }) => a.analysis_id), web.map((a) => a.jobId));
});

Then('every analysis has its id, name, technology, status and link', function (this: DevArchWorld) {
  for (const a of jsonOf(result(this)).analyses) {
    for (const k of ['analysis_id', 'name', 'technology', 'status', 'url']) assert.ok(a[k], `${k} in ${JSON.stringify(a)}`);
  }
});

// --- TS-017 ---------------------------------------------------------------------------------------------------

Given('an analysis id that does not exist', function (this: DevArchWorld) {
  this.data.analysisId = '0b5c6f3e-1d2a-4c3b-9e8f-7a6b5c4d3e2f';
});

// "an analysis that is still running" is the 007 step (native-runtime-async.steps.ts): it starts its own harness
// with a slow stub engine and registers data.jobId, which the calls below prefer over the background analysis.

Given('an analysis that failed', async function (this: DevArchWorld) {
  const rt = await (this.data.harness as WebHarness).runtime();
  const job = await rt.store.create({ origin: 'zip', language: 'auto', status: 'failed', error: { code: 'ENGINE_ERROR', message: 'engine crashed' } });
  this.data.analysisId = job.id;
});

Given('a malformed analysis id', function (this: DevArchWorld) {
  this.data.analysisId = 'not-an-id';
});

// --- TS-018 ---------------------------------------------------------------------------------------------------

When('the client calls each read tool twice for that analysis', async function (this: DevArchWorld) {
  const pairs: [string, string, string][] = [];
  for (const [tool, extra] of [
    ['get_analysis', {}], ['get_summary', {}], ['get_proposals', {}], ['get_findings', { min_severity: 'WARNING' }],
    ['get_plan', {}], ['get_document', { document: 'graph' }], ['list_analyses', {}],
  ] as const) {
    const args = tool === 'list_analyses' ? {} : { analysis_id: this.data.analysisId, ...extra };
    pairs.push([tool, textOf(await call(this, tool, args)), textOf(await call(this, tool, args))]);
  }
  this.data.pairs = pairs;
});

Then('each pair of results is byte-identical', function (this: DevArchWorld) {
  for (const [tool, a, b] of this.data.pairs as [string, string, string][]) assert.equal(a, b, tool);
});

// --- US3: TS-019..TS-021 --------------------------------------------------------------------------------------

Then('the parameters equal the ones of the web inference defaults with name, description, default and range', async function (this: DevArchWorld) {
  const web = (await api(this).call('GET', '/api/inference/defaults')).json.parameters as any[];
  assert.deepEqual(jsonOf(result(this)).parameters,
    web.map((p) => ({ name: p.path, description: p.label, default: p.default, min: p.min, max: p.max, step: p.step })));
});

When('the client calls {string} for that analysis with a different high viability threshold', async function (this: DevArchWorld, tool: string) {
  const rt = await (this.data.harness as WebHarness).runtime();
  this.data.jobsBefore = (await rt.store.list()).length;
  this.data.config = { viability: { thresholds: { high: 0.8 } } };
  this.data.result = await call(this, tool, { analysis_id: this.data.analysisId, config: this.data.config });
});

When('the client calls {string} for that analysis with a high viability threshold of {int}', async function (this: DevArchWorld, tool: string, value: number) {
  this.data.result = await call(this, tool, { analysis_id: this.data.analysisId, config: { viability: { thresholds: { high: value } } } });
});

Then('the proposals equal the web reinference of that analysis with the same values in the web order', async function (this: DevArchWorld) {
  const id = this.data.analysisId as string;
  const res = await api(this).call('POST', `/api/analyses/${id}/reinfer`, {
    body: JSON.stringify({ config: this.data.config }), headers: { 'content-type': 'application/json' },
  });
  assert.equal(res.status, 200, res.text);
  assert.deepEqual(jsonOf(result(this)).proposals, plain(orderProposals((res.json as unknown as ConsolidatedArchitecture).proposals)));
});

Then('the engine did not analyze the project again', async function (this: DevArchWorld) {
  const rt = await (this.data.harness as WebHarness).runtime();
  assert.equal((await rt.store.list()).length, this.data.jobsBefore);
});

Then('the error names the parameter', function (this: DevArchWorld) {
  assert.match(jsonOf(result(this)).error.message, /high/);
});
