// Analysis parts for agents (013 FR-009, FR-010, research D5): the documents of a job, redacted as the web API serves
// them, assembled into the same AnalysisView the web builds and projected with the web modernization logic.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ConsolidatedArchitecture, DependencyGraph, EntrypointsDocument } from '@static-inference/schema';
import { allIssues, groupIssues, type IssueGroupMode } from '../../lib/modernization/findings';
import { planToMarkdown } from '../../lib/modernization/markdown';
import { orderProposals } from '../../lib/modernization/ordering';
import { buildPlan } from '../../lib/modernization/plan';
import type { AnalysisView } from '../../lib/modernization/sections';
import type { Severity } from '../../lib/modernization/severity';
import { summarize } from '../../lib/modernization/summary';
import { technologyProfile, type TechnologyProfile } from '../../lib/modernization/technology';
import { DOCUMENTS } from '../jobs/job-runner';
import { isJobId, type Job } from '../jobs/job-store';
import { projectRoots, publicJob } from '../jobs/job-view';
import type { Runtime } from '../runtime';
import { redactDocument } from '../security/path-redaction';
import { AgentError } from './errors';

export type DocumentName = keyof typeof DOCUMENTS;

export async function jobOrError(rt: Runtime, id: unknown): Promise<Job> {
  if (!isJobId(id)) throw new AgentError('INVALID_INPUT', `'${String(id)}' is not an analysis id.`, 'Use an analysis_id returned by analyze_project or list_analyses.');
  const job = await rt.store.get(id);
  if (!job) throw new AgentError('NOT_FOUND', `Analysis ${id} does not exist.`, 'Call list_analyses to see the available analyses.');
  return job;
}

export async function completedJob(rt: Runtime, id: unknown): Promise<Job> {
  const job = await jobOrError(rt, id);
  if (job.status === 'queued' || job.status === 'running') {
    throw new AgentError('NOT_READY', `Analysis ${job.id} is ${job.status}${job.phase ? ` (phase ${job.phase})` : ''}.`,
      'Call get_analysis with wait_seconds to wait for it.', { status: job.status, phase: job.phase });
  }
  if (job.status === 'failed') {
    const err = publicJob(job, rt.store, rt.config).error;
    throw new AgentError('ANALYSIS_FAILED', `Analysis ${job.id} failed: ${err?.message ?? 'unknown error'}`,
      'Check the reason and the warnings, fix the project or the language and analyze again.',
      { analysis_id: job.id, reason: err ?? null, warnings: publicJob(job, rt.store, rt.config).warnings });
  }
  return job;
}

/** One result document exactly as GET /api/analyses/{id}/{doc} serves it. */
export async function documentText(rt: Runtime, job: Job, name: DocumentName): Promise<string> {
  let text: string;
  try {
    text = await fs.readFile(path.join(rt.store.paths(job.id).out, DOCUMENTS[name].file), 'utf8');
  } catch {
    throw new AgentError('NOT_FOUND', `Analysis ${job.id} has no ${name} document.`, 'Use get_summary or get_proposals instead.');
  }
  return job.origin === 'import' ? text : redactDocument(text, projectRoots(job));
}

export interface LoadedView {
  job: Job;
  view: AnalysisView;
  profile: TechnologyProfile;
  project: string;
}

export function projectName(job: Job, rt: Runtime): string {
  const root = publicJob(job, rt.store, rt.config).projectRoot;
  return root && root !== '.' ? root : job.origin === 'import' ? 'resultados importados' : 'proyecto';
}

export async function loadView(rt: Runtime, id: unknown, architecture?: ConsolidatedArchitecture): Promise<LoadedView> {
  const job = await completedJob(rt, id);
  const graph = JSON.parse(await documentText(rt, job, 'graph')) as DependencyGraph;
  const arch = architecture ?? (JSON.parse(await documentText(rt, job, 'architecture')) as ConsolidatedArchitecture);
  let contracts: EntrypointsDocument | null = null;
  try {
    contracts = JSON.parse(await documentText(rt, job, 'contracts')) as EntrypointsDocument;
  } catch {
    contracts = null;
  }
  const warnings = publicJob(job, rt.store, rt.config).warnings;
  return { job, view: { graph, architecture: arch, contracts, warnings }, profile: technologyProfile(graph), project: projectName(job, rt) };
}

export const summaryOf = (v: LoadedView) => summarize(v.view, v.profile);

export const proposalsOf = (v: LoadedView) => ({ proposals: orderProposals(v.view.architecture.proposals) });

export function findingsOf(v: LoadedView, min: Severity | null, mode: IssueGroupMode) {
  const groups = groupIssues(allIssues(v.view.graph), mode, min);
  return { min_severity: min, group_by: mode, total: groups.reduce((n, g) => n + g.count, 0), groups };
}

export function planOf(v: LoadedView) {
  const plan = buildPlan(v.view, v.profile, { project: v.project, analysisId: v.job.id, finishedAt: v.job.finishedAt });
  return { markdown: planToMarkdown(plan), plan };
}
