// POST /api/analyses/{id}/score — scores a user-edited proposal with the engine formulas (010 FR-026; contracts/
// web-api.md).
import { apiError, NO_STORE } from '../../../../../server/http';
import { parseScoreBody, score } from '../../../../../server/inference/inference-service';
import { withCompletedJob } from '../../../../../server/inference/routes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return withCompletedJob(request, ctx.params, async (rt, job, body) => {
    const parsed = parseScoreBody(body);
    if (!parsed.ok) return apiError(400, 'INVALID_REQUEST', parsed.message);
    return Response.json(await score(rt.engine, job.id, parsed.value), { headers: NO_STORE });
  });
}
