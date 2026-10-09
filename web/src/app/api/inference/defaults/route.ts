// GET /api/inference/defaults — panel parameters with the engine defaults and the contract ranges (010 FR-022;
// contracts/web-api.md).
import { ApiError, errorResponse } from '../../../../server/api-error';
import { NO_STORE } from '../../../../server/http';
import { inferenceDefaults } from '../../../../server/inference/inference-service';
import { getRuntime } from '../../../../server/runtime';
import { checkApiToken } from '../../../../server/security/api-token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const rt = getRuntime();
  const denied = checkApiToken(request, rt.config.apiToken);
  if (denied) return denied;
  try {
    return Response.json(await inferenceDefaults(rt.engine), { headers: NO_STORE });
  } catch (e) {
    if (e instanceof ApiError) return errorResponse(e, NO_STORE);
    const message = e instanceof Error ? e.message : String(e);
    return errorResponse(new ApiError(503, e instanceof Error && e.name === 'EngineNotBuiltError' ? 'ENGINE_NOT_BUILT' : 'ENGINE_UNAVAILABLE', message), NO_STORE);
  }
}
