// Agent MCP tools (013-agent-mcp-bridge, contracts/agent-mcp-tools.md): thin adapters over the job store, the analyses
// route, the inference service (008) and the web modernization logic. No analysis logic lives here (principle II).
import { z } from 'zod';
import type { ConsolidatedArchitecture } from '@static-inference/schema';
import { POST as submitAnalysis } from '../../app/api/analyses/route';
import { ApiError } from '../api-error';
import { historyEntries, type TechnologyCache } from '../jobs/history';
import { isTerminal, type Job } from '../jobs/job-store';
import { projectRoots, publicJob } from '../jobs/job-view';
import { inferenceDefaults, parseReinferBody, reinfer } from '../inference/inference-service';
import type { Runtime } from '../runtime';
import { redactDocument } from '../security/path-redaction';
import { AgentError, errorResult, okResult, type ToolResult } from './errors';
import { AGENT_TOOL_NAMES, type AgentToolName } from './catalog';
import { analysisUrl } from './links';
import { completedJob, documentText, findingsOf, jobOrError, loadView, planOf, projectName, proposalsOf, summaryOf } from './views';

export type { ToolResult } from './errors';

export interface ToolContext {
  rt: Runtime;
  baseUrl: string;
  /** Authorization header of the agent request, forwarded to the REST routes the tools reuse. */
  authorization?: string | null;
  /** Milliseconds between two looks at the store while waiting (tests shorten it). */
  pollMs?: number;
}

const technologyCache = ((globalThis as Record<string, unknown>).__devarchTechnologyCache ??= new Map()) as TechnologyCache;

const SEVERITY = z.enum(['CRITICAL', 'ERROR', 'WARNING', 'INFO']);
const id = z.string().describe('Analysis id (from analyze_project or list_analyses).');
const wait = (def: number) => z.number().int().min(0).max(900).default(def).describe('Seconds to wait for the analysis to finish.');

const ANALYZE_DESCRIPTION =
  'Analyze a Java or .NET project folder with dev-arch and wait for the result. Returns the analysis id, its status, a ' +
  'link to open it in the web and, when it finishes, the executive summary. Through the dev-arch bridge the folder on ' +
  'this machine is packaged and uploaded; through the HTTP endpoint only folders the server can read are accepted.';

interface ToolDef {
  description: string;
  shape: z.ZodRawShape;
  run(args: any, ctx: ToolContext): Promise<unknown>;
}

const TOOLS = {
  analyze_project: {
    description: ANALYZE_DESCRIPTION,
    shape: {
      path: z.string().min(1).describe('Absolute path of the project folder.'),
      language: z.enum(['java', 'dotnet', 'auto']).default('auto').describe('Project language; auto detects it.'),
      wait_seconds: wait(300),
    },
    async run(args, ctx) {
      if (!ctx.rt.config.allowLocalPath) {
        throw new AgentError('LOCAL_PATH_DISABLED', 'This dev-arch server cannot read folders of the agent machine.',
          'Connect the agent through the dev-arch bridge (node dev-arch-mcp.mjs --url <server>), which uploads the folder.');
      }
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (ctx.authorization) headers.authorization = ctx.authorization;
      const res = await submitAnalysis(new Request(`${ctx.baseUrl}/api/analyses`, {
        method: 'POST', headers, body: JSON.stringify({ localPath: args.path, language: args.language }),
      }));
      const body = (await res.json()) as { jobId?: string; error?: { code: string; message: string } };
      if (!res.ok || !body.jobId) throw submissionError(res.status, body.error);
      return analysisRef(ctx, await waitFor(ctx, body.jobId, args.wait_seconds));
    },
  },
  get_analysis: {
    description: 'Status of an analysis; waits up to wait_seconds for it to finish. Includes the summary once completed.',
    shape: { analysis_id: id, wait_seconds: wait(0) },
    async run(args, ctx) {
      const job = await jobOrError(ctx.rt, args.analysis_id);
      return analysisRef(ctx, await waitFor(ctx, job.id, args.wait_seconds));
    },
  },
  list_analyses: {
    description: 'Analyses of this dev-arch server, newest first, as in the web history.',
    shape: { limit: z.number().int().min(1).max(200).default(20).describe('Maximum number of analyses.') },
    async run(args, ctx) {
      const entries = await historyEntries(ctx.rt.store, ctx.rt.config, technologyCache);
      const out = [];
      for (const e of entries.slice(0, args.limit)) {
        const job = (await ctx.rt.store.get(e.jobId))!;
        out.push(refFields(ctx, job, e.technologyLabel ?? null));
      }
      return { analyses: out };
    },
  },
  get_summary: {
    description: 'Executive summary of a completed analysis (the web Summary step).',
    shape: { analysis_id: id },
    run: async (args, ctx) => summaryOf(await loadView(ctx.rt, args.analysis_id)),
  },
  get_proposals: {
    description: 'Microservice extraction proposals in the order of the web Proposals step, with viability, metrics, tables and components.',
    shape: { analysis_id: id },
    run: async (args, ctx) => proposalsOf(await loadView(ctx.rt, args.analysis_id)),
  },
  get_findings: {
    description: 'Code findings grouped as in the web Findings step, optionally from a minimum severity.',
    shape: {
      analysis_id: id,
      min_severity: SEVERITY.optional().describe('Only findings of this severity or worse.'),
      group_by: z.enum(['severity', 'pattern']).default('severity').describe('Grouping of the findings.'),
    },
    run: async (args, ctx) => findingsOf(await loadView(ctx.rt, args.analysis_id), args.min_severity ?? null, args.group_by),
  },
  get_plan: {
    description: 'Modernization plan by stages as the web exports it: Markdown text plus the structured plan.',
    shape: { analysis_id: id },
    run: async (args, ctx) => planOf(await loadView(ctx.rt, args.analysis_id)),
  },
  get_document: {
    description: 'A full result document (graph, architecture or contracts) exactly as the web API serves it. Large.',
    shape: { analysis_id: id, document: z.enum(['graph', 'architecture', 'contracts']) },
    async run(args, ctx) {
      const job = await completedJob(ctx.rt, args.analysis_id);
      return documentText(ctx.rt, job, args.document);
    },
  },
  get_inference_parameters: {
    description: 'Inference parameters of the web panel with description, default value and range.',
    shape: {},
    async run(_args, ctx) {
      const { parameters } = await engineCall(() => inferenceDefaults(ctx.rt.engine));
      return {
        parameters: parameters.map((p) => ({ name: p.path, description: p.label, default: p.default, min: p.min, max: p.max, step: p.step })),
      };
    },
  },
  reinfer_proposals: {
    description: 'Recompute the proposals of a completed analysis with other inference parameters, without analyzing the code again.',
    shape: {
      analysis_id: id,
      config: z.record(z.unknown()).describe('Inference parameters by name (see get_inference_parameters), e.g. {"viability": {"high_threshold": 0.8}}.'),
      min_viability: z.enum(['Alta', 'Media', 'Baja']).optional().describe('Only proposals of this viability or better.'),
    },
    async run(args, ctx) {
      const job = await completedJob(ctx.rt, args.analysis_id);
      const parsed = parseReinferBody({ config: args.config, minViability: args.min_viability });
      if (!parsed.ok) throw new AgentError('INVALID_INPUT', parsed.message, 'Use the names and ranges of get_inference_parameters.');
      const { text } = await engineCall(() => reinfer(ctx.rt.engine, job.id, parsed.value));
      const architecture = JSON.parse(job.origin === 'import' ? text : redactDocument(text, projectRoots(job))) as ConsolidatedArchitecture;
      const view = await loadView(ctx.rt, job.id, architecture);
      return { ...proposalsOf(view), parameters: { config: parsed.value.config ?? {}, min_viability: parsed.value.minViability ?? null } };
    },
  },
} satisfies Record<AgentToolName, ToolDef>;

export { AGENT_TOOL_NAMES };

export function agentToolDefinitions(): { name: AgentToolName; description: string; shape: z.ZodRawShape }[] {
  return AGENT_TOOL_NAMES.map((name) => ({ name, description: TOOLS[name].description, shape: TOOLS[name].shape }));
}

export async function callAgentTool(name: string, args: unknown, ctx: ToolContext): Promise<ToolResult> {
  try {
    if (!Object.hasOwn(TOOLS, name)) {
      throw new AgentError('INVALID_INPUT', `Unknown tool '${name}'.`, `Use one of: ${AGENT_TOOL_NAMES.join(', ')}.`);
    }
    const tool: ToolDef = TOOLS[name as AgentToolName];
    const parsed = z.object(tool.shape).safeParse(args ?? {});
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new AgentError('INVALID_INPUT', `Invalid '${issue.path.join('.') || 'arguments'}': ${issue.message}`, `Check the input schema of ${name}.`);
    }
    return okResult(await tool.run(parsed.data, ctx));
  } catch (e) {
    if (e instanceof AgentError) return errorResult(e);
    if (e instanceof ApiError) return errorResult(new AgentError(e.status === 400 ? 'INVALID_INPUT' : 'ENGINE_ERROR', e.message, 'Retry later or check the dev-arch logs.'));
    const message = e instanceof Error ? e.message : String(e);
    return errorResult(new AgentError('ENGINE_ERROR', message, 'Retry later or check the dev-arch logs.'));
  }
}

async function engineCall<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ApiError && (e.status === 400 || e.status === 422)) {
      throw new AgentError('INVALID_INPUT', e.message, 'Use the names and ranges of get_inference_parameters.');
    }
    throw e;
  }
}

function submissionError(status: number, error?: { code: string; message: string }): AgentError {
  const message = error?.message ?? `dev-arch answered ${status}.`;
  if (status === 401) return new AgentError('UNAUTHORIZED', message, 'Configure DEVARCH_API_TOKEN for the agent.');
  if (status === 413) return new AgentError('TOO_LARGE', message, 'Analyze a smaller folder or raise MAX_UPLOAD_BYTES on the server.');
  if (status === 403) return new AgentError('LOCAL_PATH_DISABLED', message, 'Connect the agent through the dev-arch bridge, which uploads the folder.');
  return new AgentError('INVALID_INPUT', message, 'Check the folder path and the language.', { server_code: error?.code ?? null });
}

async function waitFor(ctx: ToolContext, jobId: string, seconds: number): Promise<Job> {
  const deadline = Date.now() + seconds * 1000;
  for (;;) {
    const job = await jobOrError(ctx.rt, jobId);
    if (isTerminal(job.status) || Date.now() >= deadline) return job;
    await new Promise((r) => setTimeout(r, Math.min(ctx.pollMs ?? 250, Math.max(0, deadline - Date.now()))));
  }
}

function refFields(ctx: ToolContext, job: Job, technology: string | null) {
  const pub = publicJob(job, ctx.rt.store, ctx.rt.config);
  return {
    analysis_id: job.id,
    name: projectName(job, ctx.rt),
    technology,
    status: job.status,
    phase: job.phase,
    finished_at: job.finishedAt,
    url: analysisUrl(ctx.baseUrl, job.id),
    warnings: pub.warnings,
    error: pub.error,
  };
}

async function analysisRef(ctx: ToolContext, job: Job) {
  if (job.status === 'failed') await completedJob(ctx.rt, job.id); // throws ANALYSIS_FAILED with the reason
  if (job.status !== 'completed') return { ...refFields(ctx, job, null), summary: null };
  const view = await loadView(ctx.rt, job.id);
  return { ...refFields(ctx, job, view.profile.label), summary: summaryOf(view) };
}
