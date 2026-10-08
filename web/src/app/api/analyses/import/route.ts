// POST /api/analyses/import — imports results produced by the engine without running it (007,
// contracts/analyses-api.md; FR-020, FR-021, FR-022, FR-035).
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ApiError, errorResponse, storageError } from '../../../../server/api-error';
import { apiError, NO_STORE } from '../../../../server/http';
import { validateImport } from '../../../../server/import/import-validator';
import { DOCUMENTS } from '../../../../server/jobs/job-runner';
import { getRuntime } from '../../../../server/runtime';
import { checkApiToken } from '../../../../server/security/api-token';
import { readBodyLimited } from '../../../../server/upload/stream-to-file';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const rt = getRuntime();
  const denied = checkApiToken(request, rt.config.apiToken);
  if (denied) return denied;
  let jobId: string | null = null;
  try {
    const raw = request.headers.get('content-length');
    const buf = await readBodyLimited(request.body, rt.config.maxUploadBytes, raw && /^\d+$/.test(raw) ? Number(raw) : undefined);
    let body: unknown;
    try {
      body = JSON.parse(buf.toString('utf8'));
    } catch {
      return apiError(400, 'INVALID_REQUEST', 'The import body is not valid JSON.');
    }
    const docs = validateImport(body);
    const summary = {
      componentCount: ((docs.graph as { components?: unknown[] }).components ?? []).length,
      edgeCount: ((docs.graph as { edges?: unknown[] }).edges ?? []).length,
      proposalCount: ((docs.architecture as { proposals?: unknown[] }).proposals ?? []).length,
      endpointCount: ((docs.entrypoints as { endpoints?: unknown[] } | undefined)?.endpoints ?? []).length,
    };
    const job = await rt.store.create({ origin: 'import', language: 'auto', status: 'completed', summary });
    jobId = job.id;
    const out = rt.store.paths(job.id).out;
    try {
      await fs.mkdir(out, { recursive: true });
      await fs.writeFile(path.join(out, DOCUMENTS.graph.file), JSON.stringify(docs.graph, null, 2));
      await fs.writeFile(path.join(out, DOCUMENTS.architecture.file), JSON.stringify(docs.architecture, null, 2));
      if (docs.entrypoints !== undefined) {
        await fs.writeFile(path.join(out, DOCUMENTS.contracts.file), JSON.stringify(docs.entrypoints, null, 2));
      }
    } catch (e) {
      throw storageError(e, 'storing the imported results');
    }
    return Response.json({ jobId: job.id, status: 'completed' }, {
      status: 201, headers: { ...NO_STORE, Location: `/api/analyses/${job.id}` },
    });
  } catch (e) {
    if (jobId) await rt.store.delete(jobId).catch(() => undefined);
    if (e instanceof ApiError) return errorResponse(e, NO_STORE);
    console.error('[analyses] import failed', e);
    return apiError(500, 'IO_ERROR', 'The import could not be stored.');
  }
}
