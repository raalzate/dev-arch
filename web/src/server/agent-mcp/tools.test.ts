// Agent MCP tools (013-agent-mcp-bridge): thin adapters over the job store and the web modernization logic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ConsolidatedArchitecture, DependencyGraph, EntrypointsDocument } from '@static-inference/schema';
import { GET as getDoc } from '../../app/api/analyses/[id]/[doc]/route.ts';
import { allIssues, groupIssues } from '../../lib/modernization/findings.ts';
import { planToMarkdown } from '../../lib/modernization/markdown.ts';
import { orderProposals } from '../../lib/modernization/ordering.ts';
import { buildPlan } from '../../lib/modernization/plan.ts';
import { summarize } from '../../lib/modernization/summary.ts';
import { technologyProfile } from '../../lib/modernization/technology.ts';
import { setupRouteEnv, VALID_ID } from '../testing/route-harness.test.ts';
import { AGENT_TOOL_NAMES, callAgentTool, type ToolResult } from './tools.ts';

const BASE = 'http://dev-arch.test:9002';

async function webDocs(id: string) {
  const doc = async (name: string) => {
    const res = await getDoc(new Request(`${BASE}/api/analyses/${id}/${name}`), { params: Promise.resolve({ id, doc: name }) });
    return res.text();
  };
  return { graph: await doc('graph'), architecture: await doc('architecture'), contracts: await doc('contracts') };
}

function body(r: ToolResult): any {
  return JSON.parse(r.content[0].text);
}

test('the agent tools are the documented ten', () => {
  assert.deepEqual([...AGENT_TOOL_NAMES], [
    'analyze_project', 'get_analysis', 'list_analyses', 'get_summary', 'get_proposals',
    'get_findings', 'get_plan', 'get_document', 'get_inference_parameters', 'reinfer_proposals',
  ]);
});

test('read tools return what the web computes for the same documents, byte-identical on repeat', async () => {
  const env = await setupRouteEnv();
  try {
    const { job } = await env.completedJob();
    const ctx = { rt: env.rt(), baseUrl: BASE };
    const docs = await webDocs(job.id);
    const graph = JSON.parse(docs.graph) as DependencyGraph;
    const architecture = JSON.parse(docs.architecture) as ConsolidatedArchitecture;
    const contracts = JSON.parse(docs.contracts) as EntrypointsDocument;
    const view = { graph, architecture, contracts, warnings: job.warnings };
    const profile = technologyProfile(graph);

    const summary = await callAgentTool('get_summary', { analysis_id: job.id }, ctx);
    assert.equal(summary.isError, undefined);
    assert.deepEqual(body(summary), JSON.parse(JSON.stringify(summarize(view, profile))));

    const proposals = body(await callAgentTool('get_proposals', { analysis_id: job.id }, ctx));
    assert.deepEqual(proposals.proposals, JSON.parse(JSON.stringify(orderProposals(architecture.proposals))));

    const findings = body(await callAgentTool('get_findings', { analysis_id: job.id, min_severity: 'ERROR' }, ctx));
    const groups = groupIssues(allIssues(graph), 'severity', 'ERROR');
    assert.equal(findings.total, groups.reduce((n, g) => n + g.count, 0));
    assert.deepEqual(findings.groups, JSON.parse(JSON.stringify(groups)));
    for (const g of findings.groups) assert.ok(['CRITICAL', 'ERROR'].includes(g.key));

    const plan = body(await callAgentTool('get_plan', { analysis_id: job.id }, ctx));
    const expected = buildPlan(view, profile, { project: 'demo', analysisId: job.id, finishedAt: job.finishedAt });
    assert.equal(plan.markdown, planToMarkdown(expected));
    assert.deepEqual(plan.plan, JSON.parse(JSON.stringify(expected)));
    assert.ok(plan.plan.stages.length > 0);

    for (const name of ['graph', 'architecture', 'contracts'] as const) {
      const r = await callAgentTool('get_document', { analysis_id: job.id, document: name }, ctx);
      assert.equal(r.content[0].text, docs[name]);
    }

    for (const [tool, args] of [
      ['get_summary', {}], ['get_proposals', {}], ['get_findings', {}], ['get_plan', {}], ['get_analysis', {}],
    ] as const) {
      const a = await callAgentTool(tool, { analysis_id: job.id, ...args }, ctx);
      const b = await callAgentTool(tool, { analysis_id: job.id, ...args }, ctx);
      assert.equal(a.content[0].text, b.content[0].text, tool);
    }
  } finally {
    await env.restore();
  }
});

test('get_analysis and list_analyses expose id, name, technology, status and link', async () => {
  const env = await setupRouteEnv();
  try {
    const { job } = await env.completedJob();
    const ctx = { rt: env.rt(), baseUrl: BASE };
    const a = body(await callAgentTool('get_analysis', { analysis_id: job.id }, ctx));
    assert.equal(a.analysis_id, job.id);
    assert.equal(a.status, 'completed');
    assert.equal(a.technology, 'Java');
    assert.equal(a.url, `${BASE}/?analysis=${job.id}`);
    assert.ok(a.summary.components > 0);
    const list = body(await callAgentTool('list_analyses', {}, ctx));
    assert.deepEqual(list.analyses.map((x: any) => x.analysis_id), [job.id]);
    assert.deepEqual(Object.keys(list.analyses[0]), ['analysis_id', 'name', 'technology', 'status', 'phase', 'finished_at', 'url', 'warnings', 'error']);
  } finally {
    await env.restore();
  }
});

test('errors are specific: not found, not ready, failed, invalid input', async () => {
  const env = await setupRouteEnv();
  try {
    const ctx = { rt: env.rt(), baseUrl: BASE };
    const store = env.rt().store;
    const running = await store.create({ origin: 'zip', language: 'auto', status: 'running', phase: 'extraction' });
    const failed = await store.create({ origin: 'zip', language: 'auto', status: 'failed', error: { code: 'ENGINE_ERROR', message: 'boom' } });
    const code = async (args: Record<string, unknown>) => {
      const r = await callAgentTool('get_summary', args, ctx);
      assert.equal(r.isError, true);
      return body(r).error;
    };
    assert.equal((await code({ analysis_id: VALID_ID })).code, 'NOT_FOUND');
    const notReady = await code({ analysis_id: running.id });
    assert.equal(notReady.code, 'NOT_READY');
    assert.match(notReady.message, /extraction/);
    const failure = await code({ analysis_id: failed.id });
    assert.equal(failure.code, 'ANALYSIS_FAILED');
    assert.match(failure.message, /boom/);
    assert.equal((await code({ analysis_id: 'nope' })).code, 'INVALID_INPUT');
    const unknown = await callAgentTool('nope', {}, ctx);
    assert.equal(body(unknown).error.code, 'INVALID_INPUT');
    const badDoc = await callAgentTool('get_document', { analysis_id: running.id, document: 'secrets' }, ctx);
    assert.equal(body(badDoc).error.code, 'INVALID_INPUT');
  } finally {
    await env.restore();
  }
});

test('inference parameters are the web panel ones and reinfer_proposals reuses the engine without analyzing', async () => {
  const env = await setupRouteEnv();
  try {
    const { readFileSync } = await import('node:fs');
    const pathMod = await import('node:path');
    const callsLog = pathMod.join(env.dir, 'calls.jsonl');
    env.setControl({ callsLog });
    const { job } = await env.completedJob();
    const ctx = { rt: env.rt(), baseUrl: BASE };
    const { GET: defaultsRoute } = await import('../../app/api/inference/defaults/route.ts');
    const web = await (await defaultsRoute(new Request(`${BASE}/api/inference/defaults`))).json();
    const params = body(await callAgentTool('get_inference_parameters', {}, ctx)).parameters;
    assert.deepEqual(params, web.parameters.map((p: any) => ({ name: p.path, description: p.label, default: p.default, min: p.min, max: p.max, step: p.step })));

    const config = { viability: { thresholds: { high: 0.8 } } };
    const r = await callAgentTool('reinfer_proposals', { analysis_id: job.id, config }, ctx);
    assert.equal(r.isError, undefined, r.content[0].text);
    const out = body(r);
    const { POST: reinferRoute } = await import('../../app/api/analyses/[id]/reinfer/route.ts');
    const webArch = await (await reinferRoute(new Request(`${BASE}/api/analyses/${job.id}/reinfer`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ config }),
    }), { params: Promise.resolve({ id: job.id }) })).json();
    assert.deepEqual(out.proposals, JSON.parse(JSON.stringify(orderProposals(webArch.proposals))));
    const calls = readFileSync(callsLog, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l).name);
    assert.deepEqual(calls, ['reinfer_architecture', 'reinfer_architecture']);
    assert.equal((await env.rt().store.list()).length, 1);

    const bad = await callAgentTool('reinfer_proposals', { analysis_id: job.id, config: { viability: { thresholds: { high: 7 } } } }, ctx);
    assert.equal(bad.isError, true);
    const err = body(bad).error;
    assert.equal(err.code, 'INVALID_INPUT');
    assert.match(err.message, /high/);
  } finally {
    await env.restore();
  }
});
