// POST /api/analyses — registers an analysis and answers before it runs (007, contracts/analyses-api.md;
// FR-001, FR-005, FR-006, FR-011, FR-013..FR-016, FR-032, FR-035, FR-037).
import { promises as fs, statSync } from 'node:fs';
import path from 'node:path';
import { ApiError, errorResponse } from '../../../server/api-error';
import { apiError, logRejection, NO_STORE } from '../../../server/http';
import { LANGUAGES, type Language } from '../../../server/jobs/job-store';
import { engineLaunchOrError, getRuntime } from '../../../server/runtime';
import { checkApiToken } from '../../../server/security/api-token';
import { historyEntries, type TechnologyCache } from '../../../server/jobs/history';
import { inspectZip } from '../../../server/upload/safe-extract';
import { streamToFile, uploadTooLarge } from '../../../server/upload/stream-to-file';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const technologyCache = ((globalThis as Record<string, unknown>).__devarchTechnologyCache ??= new Map()) as TechnologyCache;

/** GET /api/analyses — history of the analyses of the server store, newest first (010 FR-036). */
export async function GET(request: Request): Promise<Response> {
  const rt = getRuntime();
  const denied = checkApiToken(request, rt.config.apiToken);
  if (denied) return denied;
  const analyses = await historyEntries(rt.store, rt.config, technologyCache);
  return Response.json({ analyses }, { headers: NO_STORE });
}

function contentLength(request: Request): number | undefined {
  const raw = request.headers.get('content-length');
  return raw && /^\d+$/.test(raw) ? Number(raw) : undefined;
}

export async function POST(request: Request): Promise<Response> {
  const rt = getRuntime();
  const denied = checkApiToken(request, rt.config.apiToken);
  if (denied) return denied;

  const contentType = (request.headers.get('content-type') ?? '').toLowerCase();
  let language = new URL(request.url).searchParams.get('language') ?? 'auto';
  let localPath: string | undefined;
  if (contentType.includes('application/json')) {
    let body: { localPath?: unknown; language?: unknown };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return apiError(400, 'INVALID_REQUEST', 'The JSON body is not valid.');
    }
    if (typeof body.language === 'string') language = body.language;
    if (typeof body.localPath !== 'string' || !body.localPath) {
      return apiError(400, 'INVALID_REQUEST', 'A JSON submission must contain "localPath".');
    }
    localPath = body.localPath;
  }
  if (!LANGUAGES.includes(language as Language)) {
    return apiError(400, 'INVALID_LANGUAGE', `Invalid language '${language}'. Allowed: java, dotnet, auto`);
  }
  if (localPath !== undefined) {
    if (!rt.config.allowLocalPath) {
      return apiError(403, 'LOCAL_PATH_DISABLED', 'Local folder analysis is only available in development mode.');
    }
    let isDir = false;
    try {
      isDir = path.isAbsolute(localPath) && statSync(localPath).isDirectory();
    } catch {
      isDir = false;
    }
    if (!isDir) return apiError(400, 'LOCAL_PATH_NOT_DIRECTORY', 'The local path is not an existing absolute directory.');
  }
  const engine = engineLaunchOrError(rt.cwd);
  if (engine.kind === 'not-built') {
    console.error(engine.message);
    return apiError(500, 'ENGINE_NOT_BUILT', engine.message);
  }
  if (!rt.runner.reserve()) {
    return apiError(429, 'TOO_MANY_ANALYSES', 'Too many analyses in progress; retry later.', {}, { 'Retry-After': '30' });
  }

  let jobId: string | null = null;
  try {
    const job = await rt.store.create({ origin: localPath !== undefined ? 'localPath' : 'zip', language: language as Language });
    jobId = job.id;
    const p = rt.store.paths(job.id);
    if (localPath !== undefined) {
      await rt.store.update(job.id, { projectRoot: localPath });
    } else {
      const length = contentLength(request);
      if (contentType.startsWith('multipart/form-data')) {
        const part = `${p.upload}.part`;
        await streamToFile(request.body, part, rt.config.maxUploadBytes + 64 * 1024, length, rt.deps);
        const form = await new Request('http://local/', {
          method: 'POST', headers: { 'content-type': contentType }, body: await fs.readFile(part),
        }).formData();
        await fs.rm(part, { force: true });
        const file = form.get('file');
        if (!(file instanceof Blob)) throw new ApiError(400, 'INVALID_ZIP', 'No file was provided in the "file" field.');
        if (file.size > rt.config.maxUploadBytes) throw uploadTooLarge(rt.config.maxUploadBytes);
        await streamToFile(file.stream() as ReadableStream<Uint8Array>, p.upload, rt.config.maxUploadBytes, undefined, rt.deps);
      } else {
        await streamToFile(request.body, p.upload, rt.config.maxUploadBytes, length, rt.deps);
      }
      inspectZip(p.upload, rt.config);
      const { size } = await fs.stat(p.upload);
      await rt.store.update(job.id, { uploadBytes: size });
    }
    const status = rt.runner.submit(job.id, localPath);
    return Response.json({ jobId: job.id, status }, {
      status: 202, headers: { ...NO_STORE, Location: `/api/analyses/${job.id}` },
    });
  } catch (e) {
    rt.runner.release();
    if (jobId) await rt.store.delete(jobId).catch(() => undefined);
    if (e instanceof ApiError) {
      logRejection(e, 'upload');
      return errorResponse(e, NO_STORE);
    }
    console.error('[analyses] submission failed', e);
    return apiError(500, 'IO_ERROR', 'The submission could not be stored.');
  }
}
