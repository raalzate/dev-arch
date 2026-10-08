// In-process web harness for the 007 scenarios (research D12): the real route handlers of web/src/app/api are
// invoked with a temporary data directory, a stub engine launched through a fake JDK (the real locator, MCP client
// and runner are exercised) and optional fault injection / controllable clock. A "restart" drops the runtime and
// starts a new one over the same data directory. A second client (`RemoteApi`) talks to a running `next dev`.
import { After } from '@cucumber/cucumber';
import { chmodSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { layout } from './layout.ts';
import { tempDir } from './tools.ts';
import type { DevArchWorld } from './world.ts';

export interface ApiResponse {
  status: number;
  headers: Headers;
  text: string;
  json: Record<string, any>;
  elapsedMs: number;
}

export interface ApiInit {
  body?: BodyInit | Buffer;
  headers?: Record<string, string>;
}

export interface ApiClient {
  call(method: string, url: string, init?: ApiInit): Promise<ApiResponse>;
  /** Directories that must never appear in a response (data directory, web working directory). */
  secretDirs(): string[];
}

async function toResponse(res: Response, started: number): Promise<ApiResponse> {
  const text = await res.text();
  let json: Record<string, any> = {};
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return { status: res.status, headers: res.headers, text, json, elapsedMs: Date.now() - started };
}

const FAKE = path.join(__dirname, 'fake-mcp-server.mjs');
const api = (...p: string[]) => path.join(layout.webDir, 'src', 'app', 'api', ...p);
type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

async function route(file: string, method: string): Promise<Handler> {
  const mod = (await import(file)) as Record<string, Handler>;
  const h = mod[method];
  if (!h) throw new Error(`${file} has no ${method} handler`);
  return h;
}

// Loaded with the support code (not lazily inside a step): dynamic imports of the web server modules during a
// scenario can stall under tsx on recent Node versions.
import * as runtimeMod from '../../../web/src/server/runtime.ts';
import * as instrumentation from '../../../web/src/instrumentation.ts';
type RuntimeModule = typeof runtimeMod;
async function runtimeModule(): Promise<RuntimeModule> {
  return runtimeMod;
}

export interface HarnessOptions {
  control?: Record<string, unknown>;
  env?: Record<string, string | undefined>;
  /** Web working directory to use (default: a new temporary one). */
  cwd?: string;
  /** No staged engine and no override (ENGINE_NOT_BUILT). */
  noEngine?: boolean;
  overrides?: Parameters<RuntimeModule['setRuntimeOverrides']>[0];
}

export class WebHarness implements ApiClient {
  readonly root = realpathSync(tempDir('devarch-007'));
  readonly webCwd: string;
  readonly dataDir: string;
  readonly controlFile = path.join(this.root, 'engine-control.json');
  readonly launchCounter = path.join(this.root, 'launches.txt');
  readonly intervalsLog = path.join(this.root, 'intervals.jsonl');
  readonly logs: string[] = [];
  private control: Record<string, unknown> = {};
  private readonly savedEnv = { ...process.env };
  private readonly savedCwd = process.cwd();
  private readonly savedConsole = { error: console.error, warn: console.warn, log: console.log };
  private stopped = false;

  private constructor(private readonly opts: HarnessOptions) {
    this.webCwd = opts.cwd ?? path.join(this.root, 'web');
    mkdirSync(this.webCwd, { recursive: true });
    this.dataDir = path.join(this.root, 'data');
  }

  static async start(world: DevArchWorld, opts: HarnessOptions = {}): Promise<WebHarness> {
    const h = new WebHarness(opts);
    world.data.harness = h;
    world.data.api = h;
    await h.boot();
    return h;
  }

  private async boot(): Promise<void> {
    const jdk = path.join(this.root, 'fake-jdk');
    mkdirSync(path.join(jdk, 'bin'), { recursive: true });
    const java = path.join(jdk, 'bin', 'java');
    // The fake JDK runs the stub engine with the java arguments (--mcp: server mode; otherwise CLI mode).
    writeFileSync(java, `#!/bin/sh\nNODE_OPTIONS= exec "${process.execPath}" "${FAKE}" "$@"\n`);
    chmodSync(java, 0o755);
    const jar = path.join(jdk, 'engine.jar');
    writeFileSync(jar, 'stub');
    writeFileSync(this.launchCounter, '');
    this.setControl(this.opts.control ?? {});
    const env: Record<string, string | undefined> = {
      ARCHVIEW_DATA_DIR: this.dataDir,
      FAKE_ENGINE_CONTROL: this.controlFile,
      JAVA_HOME: this.opts.noEngine ? undefined : jdk,
      ENGINE_JAR_PATH: this.opts.noEngine ? undefined : jar,
      ENGINE_JAVA_OPTS: undefined,
      DEVARCH_API_TOKEN: undefined,
      DEVARCH_ALLOW_LOCAL_PATH: undefined,
      NODE_ENV: 'test',
      ...this.opts.env,
    };
    for (const [k, v] of Object.entries(env)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    process.chdir(this.webCwd);
    const capture = (orig: (...a: unknown[]) => void) => (...a: unknown[]) => {
      this.logs.push(a.map(String).join(' '));
      if (process.env.DEVARCH_HARNESS_VERBOSE === 'true') orig(...a);
    };
    console.error = capture(this.savedConsole.error);
    console.warn = capture(this.savedConsole.warn);
    console.log = capture(this.savedConsole.log);
    const rt = await runtimeModule();
    await rt.resetRuntime();
    rt.setRuntimeOverrides(this.opts.overrides);
    await this.register();
  }

  /** Server start: the Next.js instrumentation hook (recovery, cleaner, exposure warning). */
  private async register(): Promise<void> {
    process.env.NEXT_RUNTIME = 'nodejs';
    await instrumentation.register();
  }

  setControl(control: Record<string, unknown>): void {
    this.control = control;
    writeFileSync(this.controlFile, JSON.stringify({ launchCounter: this.launchCounter, intervalsLog: this.intervalsLog, ...control }));
  }

  updateControl(patch: Record<string, unknown>): void {
    this.setControl({ ...this.control, ...patch });
  }

  secretDirs(): string[] {
    return [this.dataDir, this.webCwd, this.root];
  }

  async runtime() {
    return (await runtimeModule()).getRuntime();
  }

  /** Overrides that undo the harness changes to process.env (for processes started while it is active). */
  envRestoration(): Record<string, string | undefined> {
    const out: Record<string, string | undefined> = {};
    for (const k of Object.keys(process.env)) if (!(k in this.savedEnv)) out[k] = undefined;
    for (const [k, v] of Object.entries(this.savedEnv)) if (process.env[k] !== v) out[k] = v;
    return out;
  }

  /** Changes an environment variable of the server (takes effect at the next restart). */
  setEnv(name: string, value: string | undefined): void {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }

  /** Simulates a web server restart over the same data directory. */
  async restart(): Promise<void> {
    const rt = await runtimeModule();
    await rt.resetRuntime();
    await this.register();
  }

  async call(method: string, url: string, init: ApiInit = {}): Promise<ApiResponse> {
    const u = new URL(url, 'http://localhost');
    const parts = u.pathname.split('/').filter(Boolean); // api, analyses, ...
    let file: string;
    let params: Record<string, string> = {};
    if (parts[1] === 'analyses' && parts.length === 2) file = api('analyses', 'route.ts');
    else if (parts[1] === 'analyses' && parts[2] === 'import' && parts.length === 3) file = api('analyses', 'import', 'route.ts');
    else if (parts[1] === 'analyses' && parts.length === 3) {
      file = api('analyses', '[id]', 'route.ts');
      params = { id: decodeURIComponent(parts[2]) };
    } else if (parts[1] === 'analyses' && parts.length === 4) {
      file = api('analyses', '[id]', '[doc]', 'route.ts');
      params = { id: decodeURIComponent(parts[2]), doc: decodeURIComponent(parts[3]) };
    } else if (parts[1] === 'source') file = api('source', 'route.ts');
    else if (parts[1] === 'analyze') file = api('analyze', 'route.ts');
    else throw new Error(`no route for ${url}`);
    const handler = await route(file, method);
    const body = init.body instanceof Buffer ? new Uint8Array(init.body) : init.body;
    const headers: Record<string, string> = { ...init.headers };
    if (init.body instanceof Buffer && !Object.keys(headers).some((k) => k.toLowerCase() === 'content-length')) {
      headers['content-length'] = String(init.body.length);
    }
    const req = new Request(u.toString(), { method, body, headers, duplex: 'half' } as RequestInit);
    const started = Date.now();
    const res = await handler(req, { params: Promise.resolve(params) });
    return toResponse(res, started);
  }

  async stop(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    const rt = await runtimeModule();
    await rt.resetRuntime();
    rt.setRuntimeOverrides(undefined);
    console.error = this.savedConsole.error;
    console.warn = this.savedConsole.warn;
    console.log = this.savedConsole.log;
    process.chdir(this.savedCwd);
    for (const k of Object.keys(process.env)) if (!(k in this.savedEnv)) delete process.env[k];
    Object.assign(process.env, this.savedEnv);
    rmSync(this.root, { recursive: true, force: true });
  }
}

/** Client of a running web server (`next dev`) with the real engine. */
export class RemoteApi implements ApiClient {
  constructor(
    readonly url: string,
    private readonly dirs: string[],
    private readonly token?: string,
  ) {}

  secretDirs(): string[] {
    return this.dirs;
  }

  async call(method: string, url: string, init: ApiInit = {}): Promise<ApiResponse> {
    const headers: Record<string, string> = { ...init.headers };
    if (this.token && !headers.authorization) headers.authorization = `Bearer ${this.token}`;
    const body = init.body instanceof Buffer ? new Uint8Array(init.body) : init.body;
    const started = Date.now();
    const res = await fetch(new URL(url, this.url), { method, body, headers, signal: AbortSignal.timeout(10 * 60_000) });
    return toResponse(res, started);
  }
}

After(async function (this: DevArchWorld) {
  const h = this.data.harness as WebHarness | undefined;
  if (h) await h.stop();
});
