// POST /api/analyze — synchronous analysis of feature 006, DEPRECATED in favour of /api/analyses
// (007-native-engine-runtime, research D9; FR-033). Same request (multipart "file"), same response
// ({ componentsData, archData }) and error texts as 006, and the same engine invocation
// (`java -jar <jar> <projectRoot> output.json`), but every request works in its own analysis area: the ZIP is
// validated and extracted safely and the engine runs with that area as working directory, so concurrent
// requests never read each other's files and nothing is written to the server working directory.
import { execFile, type ExecFileException } from 'node:child_process';
import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';
import { ApiError } from '../../../server/api-error';
import { loadConfig } from '../../../server/config';
import { buildEngineCommand, resolveEngine } from '../../../server/engine/engine-path';
import { logRejection } from '../../../server/http';
import { JobStore } from '../../../server/jobs/job-store';
import { checkApiToken } from '../../../server/security/api-token';
import { extractZip, inspectZip } from '../../../server/upload/safe-extract';
import { findProjectRoot } from '../../../server/upload/project-root';
import { streamToFile } from '../../../server/upload/stream-to-file';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEPRECATION = { Deprecation: 'true', Link: '</api/analyses>; rel="successor-version"' };

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: DEPRECATION });
}

function executeFile(file: string, args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { cwd, env: process.env, maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Command failed: ${file} ${args.join(' ')}`);
        console.error(stderr);
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

export async function POST(request: Request): Promise<Response> {
  const config = loadConfig(process.env, process.cwd());
  const denied = checkApiToken(request, config.apiToken);
  if (denied) return denied;
  const store = new JobStore(config.dataDir);
  let jobId: string | null = null;
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return json({ error: 'No file provided' }, 400);

    // Locate the locally built engine (web/engine-dist/engine.jar or ENGINE_JAR_PATH), as in 006.
    const engine = resolveEngine(process.env, process.cwd(), existsSync);
    if (engine.kind === 'not-built') {
      console.error(engine.message);
      return json({ error: engine.message }, 500);
    }

    const job = await store.create({ origin: 'sync', language: 'auto', status: 'running' });
    jobId = job.id;
    const p = store.paths(job.id);
    try {
      await streamToFile(file.stream() as ReadableStream<Uint8Array>, p.upload, config.maxUploadBytes);
      inspectZip(p.upload, config);
      await extractZip(p.upload, p.source, config);
      await fs.rm(p.upload, { force: true });
    } catch (e) {
      if (e instanceof ApiError) {
        logRejection(e, 'synchronous upload');
        await store.delete(job.id);
        jobId = null;
        return json({ error: e.message }, e.status);
      }
      throw e;
    }
    const projectRoot = findProjectRoot(p.source);
    await fs.mkdir(p.out, { recursive: true });
    await store.update(job.id, { projectRoot });

    const command = buildEngineCommand(engine, projectRoot, 'output.json');
    console.log(`Executing: ${command.file} ${command.args.join(' ')} (cwd ${p.out})`);
    try {
      await executeFile(command.file, command.args, p.out);
    } catch (error) {
      console.error('Error running the engine:', error);
      await store.update(job.id, { status: 'failed', error: { code: 'ENGINE_ERROR', message: 'The engine failed' } });
      const execError = error as ExecFileException;
      return json({ error: `Failed to analyze the project with the Java tool.\n\nDetails:\n${execError.message}` }, 500);
    }
    let componentsData;
    let archData;
    try {
      componentsData = JSON.parse(await fs.readFile(path.join(p.out, 'output.json'), 'utf-8'));
      archData = JSON.parse(await fs.readFile(path.join(p.out, 'output_architecture.json'), 'utf-8'));
    } catch (readError) {
      console.error('Error reading output JSON files:', readError);
      await store.update(job.id, { status: 'failed', error: { code: 'ENGINE_ERROR', message: 'Unreadable results' } });
      return json({ error: 'Analysis completed, but failed to read result files. Check server logs for output file path.' }, 500);
    }
    await store.update(job.id, { status: 'completed' });
    return json({ componentsData, archData });
  } catch (error) {
    console.error('An unexpected error occurred:', error);
    if (jobId) await store.update(jobId, { status: 'failed', error: { code: 'IO_ERROR', message: 'Server error' } }).catch(() => undefined);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return json({ error: `Server error: ${errorMessage}` }, 500);
  }
}
