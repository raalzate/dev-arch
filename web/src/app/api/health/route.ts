// GET /api/health (012-install-doctor-docker, contracts/health-api.md): runtime checks of the shared doctor
// (scripts/doctor) plus the live state of the engine process. 200 without FAIL, 503 with FAIL. No API token: the
// container health check calls it.
import { health, nodeDoctorRunner } from '../../../server/health/health';
import { NO_STORE } from '../../../server/http';
import { peekRuntime } from '../../../server/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const r = await health({
    env: process.env,
    cwd: process.cwd(),
    runDoctor: nodeDoctorRunner,
    enginePid: () => peekRuntime()?.engine.pid() ?? null,
    now: Date.now,
  });
  return Response.json(r.body, { status: r.status, headers: NO_STORE });
}
