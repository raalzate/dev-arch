// GET /api/analyses/{id} — status of an analysis (007, contracts/analyses-api.md; FR-002, FR-004, FR-034, FR-035).
import { NO_STORE, notFound } from '../../../../server/http';
import { isJobId } from '../../../../server/jobs/job-store';
import { publicJob } from '../../../../server/jobs/job-view';
import { getRuntime } from '../../../../server/runtime';
import { checkApiToken } from '../../../../server/security/api-token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const rt = getRuntime();
  const denied = checkApiToken(request, rt.config.apiToken);
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!isJobId(id)) return notFound();
  const job = await rt.store.get(id);
  if (!job) return notFound();
  return Response.json(publicJob(job, rt.store, rt.config), { headers: NO_STORE });
}
