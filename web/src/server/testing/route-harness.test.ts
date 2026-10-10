// Shared set-up of the API route unit tests (011-quality-delivery): a temporary web working directory and data
// directory, the process environment read by the runtime, and a fake JDK whose `bin/java` runs the stub MCP engine
// (tests/acceptance/support/fake-mcp-server.mjs), as tests/acceptance/support/web-harness.ts does. This file only
// exports helpers (it is named *.test.ts so that it stays out of the production modules); it declares no tests.
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Job } from '../jobs/job-store.ts';
import { getRuntime, resetRuntime, setRuntimeOverrides, type Runtime } from '../runtime.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
export const DEV_ARCH = path.resolve(here, '../../../..');
export const FAKE_ENGINE = path.join(DEV_ARCH, 'tests/acceptance/support/fake-mcp-server.mjs');
export const JAVA_FIXTURES = path.join(DEV_ARCH, 'schema/fixtures/valid/java-standar');
export const VALID_ID = '0b5c6f3e-1d2a-4c3b-9e8f-7a6b5c4d3e2f';

export interface RouteEnv {
  dir: string;
  dataDir: string;
  controlFile: string;
  /** Captured console.error / warn / log lines and engine log lines. */
  logs: string[];
  setControl(control: Record<string, unknown>): void;
  rt(): Runtime;
  /** A completed analysis whose documents are the java-standar fixtures, with files rebased under its project root. */
  completedJob(init?: Partial<Job>): Promise<{ job: Job; projectRoot: string }>;
  restore(): Promise<void>;
}

export interface RouteEnvOptions {
  /** Without a fake engine (JAVA_HOME / ENGINE_JAR_PATH unset): the engine is "not built". */
  noEngine?: boolean;
  env?: Record<string, string | undefined>;
  control?: Record<string, unknown>;
}

export async function setupRouteEnv(opts: RouteEnvOptions = {}): Promise<RouteEnv> {
  const dir = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'devarch-route-')));
  const web = path.join(dir, 'web');
  const dataDir = path.join(dir, 'data');
  const jdk = path.join(dir, 'fake-jdk');
  mkdirSync(web, { recursive: true });
  mkdirSync(path.join(jdk, 'bin'), { recursive: true });
  const java = path.join(jdk, 'bin', 'java');
  writeFileSync(java, `#!/bin/sh\nNODE_OPTIONS= exec "${process.execPath}" "${FAKE_ENGINE}" "$@"\n`);
  chmodSync(java, 0o755);
  const jar = path.join(jdk, 'engine.jar');
  writeFileSync(jar, 'stub');
  const controlFile = path.join(dir, 'control.json');
  const setControl = (c: Record<string, unknown>) => writeFileSync(controlFile, JSON.stringify(c));
  setControl(opts.control ?? {});

  const previousEnv = { ...process.env };
  const previousCwd = process.cwd();
  const env: Record<string, string | undefined> = {
    ARCHVIEW_DATA_DIR: dataDir,
    FAKE_ENGINE_CONTROL: controlFile,
    JAVA_HOME: opts.noEngine ? undefined : jdk,
    ENGINE_JAR_PATH: opts.noEngine ? undefined : jar,
    ENGINE_JAVA_OPTS: undefined,
    DEVARCH_API_TOKEN: undefined,
    DEVARCH_ALLOW_LOCAL_PATH: undefined,
    MAX_UPLOAD_BYTES: undefined,
    MAX_CONCURRENT_ANALYSES: undefined,
    MAX_QUEUED_ANALYSES: undefined,
    HOSTNAME: undefined,
    NODE_ENV: 'test',
    ...opts.env,
  };
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  process.chdir(web);
  const logs: string[] = [];
  const saved = { error: console.error, warn: console.warn, log: console.log };
  console.error = (...a: unknown[]) => void logs.push(a.map(String).join(' '));
  console.warn = (...a: unknown[]) => void logs.push(a.map(String).join(' '));
  console.log = (...a: unknown[]) => void logs.push(a.map(String).join(' '));
  await resetRuntime();
  setRuntimeOverrides({ log: (l) => logs.push(l) });

  const rt = () => getRuntime();
  return {
    dir, dataDir, controlFile, logs, setControl, rt,
    async completedJob(init = {}) {
      const store = rt().store;
      const created = await store.create({ origin: 'zip', language: 'auto', status: 'completed', ...init });
      const p = store.paths(created.id);
      const projectRoot = init.projectRoot ?? path.join(p.source, 'demo');
      mkdirSync(projectRoot, { recursive: true });
      const job = await store.update(created.id, { projectRoot });
      mkdirSync(p.out, { recursive: true });
      const graph = JSON.parse(readFileSync(path.join(JAVA_FIXTURES, 'output.json'), 'utf8'));
      for (const c of graph.components) {
        c.files = (c.files ?? []).map((f: string) => path.join(projectRoot, f.replace(/^.*?java-standar\//, '')));
      }
      writeFileSync(path.join(p.out, 'output.json'), JSON.stringify(graph, null, 2));
      copyFileSync(path.join(JAVA_FIXTURES, 'output_architecture.json'), path.join(p.out, 'output_architecture.json'));
      copyFileSync(path.join(JAVA_FIXTURES, 'output_entrypoints.json'), path.join(p.out, 'output_entrypoints.json'));
      return { job, projectRoot };
    },
    async restore() {
      await resetRuntime();
      setRuntimeOverrides(undefined);
      console.error = saved.error;
      console.warn = saved.warn;
      console.log = saved.log;
      process.chdir(previousCwd);
      for (const k of Object.keys(process.env)) if (!(k in previousEnv)) delete process.env[k];
      Object.assign(process.env, previousEnv);
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

export const ctxId = (id: string) => ({ params: Promise.resolve({ id }) });

export function jsonRequest(url: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

/** Polls the store until the analysis ends (the runner works in the background). */
export async function waitTerminal(rt: Runtime, id: string, timeoutMs = 15_000): Promise<Job> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const job = await rt.store.get(id);
    if (job && (job.status === 'completed' || job.status === 'failed')) return job;
    if (Date.now() > deadline) throw new Error(`analysis ${id} did not finish: ${JSON.stringify(job)}`);
    await new Promise((r) => setTimeout(r, 50));
  }
}
