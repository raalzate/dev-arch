// Shared handling of the 010 inference routes: token, job state, JSON body and error rendering (contracts/web-api.md).
import { ApiError, errorResponse } from '../api-error';
import { apiError, NO_STORE, notFound } from '../http';
import { isJobId, type Job } from '../jobs/job-store';
import { getRuntime, type Runtime } from '../runtime';
import { checkApiToken } from '../security/api-token';

export const MAX_BODY_BYTES = 64 * 1024;

export async function withCompletedJob(
  request: Request,
  idParam: Promise<{ id: string }>,
  handle: (rt: Runtime, job: Job, body: unknown) => Promise<Response>,
): Promise<Response> {
  const rt = getRuntime();
  const denied = checkApiToken(request, rt.config.apiToken);
  if (denied) return denied;
  const { id } = await idParam;
  if (!isJobId(id)) return notFound();
  const job = await rt.store.get(id);
  if (!job) return notFound();
  if (job.status !== 'completed') return apiError(409, 'NOT_COMPLETED', 'The analysis is not completed.', { status: job.status });
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return apiError(413, 'BODY_TOO_LARGE', `The JSON body exceeds ${MAX_BODY_BYTES} bytes.`);
  let body: unknown = {};
  if (raw.trim()) {
    try {
      body = JSON.parse(raw);
    } catch {
      return apiError(400, 'INVALID_REQUEST', 'The JSON body is not valid.');
    }
  }
  try {
    return await handle(rt, job, body);
  } catch (e) {
    if (e instanceof ApiError) return errorResponse(e, NO_STORE);
    throw e;
  }
}
