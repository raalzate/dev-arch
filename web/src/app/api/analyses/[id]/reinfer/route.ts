// POST /api/analyses/{id}/reinfer — re-infers the architecture of a stored analysis with new parameters, without
// re-analyzing the code (010 FR-023, FR-024, FR-027; contracts/web-api.md). The stored documents are not changed.
import { apiError, NO_STORE } from '../../../../../server/http';
import { parseReinferBody, reinfer } from '../../../../../server/inference/inference-service';
import { withCompletedJob } from '../../../../../server/inference/routes';
import { projectRoots } from '../../../../../server/jobs/job-view';
import { redactDocument } from '../../../../../server/security/path-redaction';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return withCompletedJob(request, ctx.params, async (rt, job, body) => {
    const parsed = parseReinferBody(body);
    if (!parsed.ok) return apiError(400, 'INVALID_REQUEST', parsed.message);
    const { text } = await reinfer(rt.engine, job.id, parsed.value);
    const out = job.origin === 'import' ? text : redactDocument(text, projectRoots(job));
    return new Response(out, { headers: { 'Content-Type': 'application/json; charset=utf-8', ...NO_STORE } });
  });
}
