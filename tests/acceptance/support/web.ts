// Web helpers: free port, dev server lifecycle, demo ZIPs and in-process route invocation.
import AdmZip from 'adm-zip';
import { readFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { git } from './git.ts';
import { start, type Background } from './process.ts';

export async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as net.AddressInfo).port;
      srv.close(() => resolve(port));
    });
  });
}

/** NODE_OPTIONS for the web, as scripts/lib.sh node_options_for_web (Node >= 22: no global localStorage). */
export function webNodeOptions(): string {
  const major = Number(/^v(\d+)/.exec(process.version)?.[1] ?? 0);
  return major >= 22 ? '--no-experimental-webstorage' : '';
}

/**
 * Starts `next dev` of the web (same command as `npm run dev` / `make dev`, on a free port) and waits until the
 * analysis route answers (GET -> 405).
 */
export async function startDevServer(webDir: string, env: NodeJS.ProcessEnv): Promise<{ server: Background; url: string }> {
  const port = await freePort();
  const server = start('npx', ['--no-install', 'next', 'dev', '--turbopack', '--port', String(port)], {
    cwd: webDir,
    env: { ...env, NODE_OPTIONS: webNodeOptions() },
  });
  const url = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    if (server.exited() !== null) throw new Error(`next dev exited (${server.exited()}):\n${server.output().slice(-4000)}`);
    try {
      const res = await fetch(`${url}/api/analyze`, { signal: AbortSignal.timeout(60_000) });
      if (res.status === 405) return { server, url };
    } catch {
      /* not ready yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  await server.stop();
  throw new Error(`next dev did not answer within 3 minutes:\n${server.output().slice(-4000)}`);
}

/** ZIP of a demo project of the engine with its git-tracked files only (no build outputs), rooted at its name. */
export function demoZip(engineRoot: string, project: string): Buffer {
  const files = git(['ls-files', '-z', '--', `test-for-demo/${project}`], engineRoot).split('\0').filter(Boolean);
  if (files.length === 0) throw new Error(`demo project ${project} has no tracked files`);
  const zip = new AdmZip();
  for (const f of files) {
    const rel = path.posix.relative('test-for-demo', f);
    zip.addFile(rel, readFileSync(path.join(engineRoot, f)));
  }
  return zip.toBuffer();
}

export function analyzeForm(zip: Buffer, name: string): FormData {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(zip)]), name);
  return form;
}

/**
 * Calls the analysis route handler in process with the given web working directory and environment
 * (same handler `next dev` serves; used by the fast scenarios that do not need a running server).
 */
export async function callAnalyzeRoute(
  webDir: string,
  cwd: string,
  env: Record<string, string | undefined>,
  form: FormData,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const route = (await import(path.join(webDir, 'src', 'app', 'api', 'analyze', 'route.ts'))) as {
    POST: (req: Request) => Promise<Response>;
  };
  const previousCwd = process.cwd();
  const previousEnv = { ...process.env };
  try {
    process.chdir(cwd);
    for (const [k, v] of Object.entries(env)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    const res = await route.POST(new Request('http://localhost/api/analyze', { method: 'POST', body: form }));
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  } finally {
    process.chdir(previousCwd);
    process.env = previousEnv;
  }
}
