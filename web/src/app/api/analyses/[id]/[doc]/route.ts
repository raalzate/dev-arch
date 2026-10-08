// GET /api/analyses/{id}/graph|architecture|contracts — result documents (007, contracts/analyses-api.md;
// FR-003, FR-004, FR-034: paths relativized to the project root, otherwise byte for byte).
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { apiError, NO_STORE, notFound } from '../../../../../server/http';
import { DOCUMENTS } from '../../../../../server/jobs/job-runner';
import { isJobId } from '../../../../../server/jobs/job-store';
import { projectRoots, publicJob } from '../../../../../server/jobs/job-view';
import { getRuntime } from '../../../../../server/runtime';
import { checkApiToken } from '../../../../../server/security/api-token';
import { redactDocument } from '../../../../../server/security/path-redaction';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, ctx: { params: Promise<{ id: string; doc: string }> }): Promise<Response> {
  const rt = getRuntime();
  const denied = checkApiToken(request, rt.config.apiToken);
  if (denied) return denied;
  const { id, doc } = await ctx.params;
  if (!isJobId(id) || !Object.hasOwn(DOCUMENTS, doc)) return notFound();
  const job = await rt.store.get(id);
  if (!job) return notFound();
  if (job.status === 'queued' || job.status === 'running') {
    return apiError(409, 'NOT_READY', 'The analysis has not finished yet.', { status: job.status, phase: job.phase });
  }
  if (job.status === 'failed') {
    return apiError(409, 'ANALYSIS_FAILED', 'The analysis failed.', { error: publicJob(job, rt.store, rt.config).error });
  }
  let text: string;
  try {
    text = await fs.readFile(path.join(rt.store.paths(id).out, DOCUMENTS[doc as keyof typeof DOCUMENTS].file), 'utf8');
  } catch {
    return notFound();
  }
  const body = job.origin === 'import' ? text : redactDocument(text, projectRoots(job));
  return new Response(body, { headers: { 'Content-Type': 'application/json; charset=utf-8', ...NO_STORE } });
}
