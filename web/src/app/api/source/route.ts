// GET /api/source?jobId=<id>&path=<relative> — source viewer restricted to the project of one analysis
// (007-native-engine-runtime, contracts/analyses-api.md; FR-017, FR-018, FR-022, FR-035). The legacy form
// ?path=<absolute> without jobId (006) is rejected with INVALID_PATH.
import { ApiError, errorResponse } from '../../../server/api-error';
import { apiError, NO_STORE, notFound } from '../../../server/http';
import { isJobId } from '../../../server/jobs/job-store';
import { getRuntime } from '../../../server/runtime';
import { checkApiToken } from '../../../server/security/api-token';
import { readSource } from '../../../server/source/source-sandbox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const rt = getRuntime();
  const denied = checkApiToken(request, rt.config.apiToken);
  if (denied) return denied;
  const params = new URL(request.url).searchParams;
  const jobId = params.get('jobId');
  const relPath = params.get('path') ?? '';
  if (!jobId) return apiError(400, 'INVALID_PATH', 'The source viewer needs the analysis identifier (jobId) and a relative path.');
  if (!isJobId(jobId)) return notFound();
  const job = await rt.store.get(jobId);
  if (!job) return notFound();
  if (job.origin === 'import' || !job.projectRoot) {
    return apiError(409, 'NO_SOURCES', 'This analysis has no source code available (imported results).');
  }
  try {
    return Response.json(await readSource(job.projectRoot, relPath, rt.config), { headers: NO_STORE });
  } catch (e) {
    if (e instanceof ApiError) return errorResponse(e, NO_STORE);
    throw e;
  }
}
