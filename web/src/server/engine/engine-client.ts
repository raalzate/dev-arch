// Client of the engine in MCP server mode (007-native-engine-runtime, research D1, D14, contracts/engine-client.md).
// One long-lived `java -jar engine.jar --mcp` process per web server, started lazily and reused between analyses.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { analyzeProjectResponseSchema } from '@static-inference/schema';
import type { Language, Phase } from '../jobs/job-store';
import { PHASES } from '../jobs/job-store';

export interface EngineLaunchSpec {
  command: string;
  args: string[];
  env: Record<string, string>;
}

export interface AnalyzeRequest {
  jobId: string;
  projectPath: string;
  outputDir: string;
  language: Language;
}

export interface AnalyzeHooks {
  onPhase(phase: Phase): void;
  onStderr(line: string): void;
  timeoutMs: number;
}

export interface AnalyzeSummary {
  componentCount: number;
  edgeCount: number;
  proposalCount: number;
  endpointCount: number;
}

export interface AnalyzeResult {
  summary: AnalyzeSummary;
  warnings: string[];
}

/** The engine answered the tool call with isError (message from the engine). */
export class EngineToolError extends Error {
  readonly ambiguous: boolean;
  constructor(message: string, readonly warnings: string[] = []) {
    super(message);
    this.name = 'EngineToolError';
    this.ambiguous = message.includes('Ambiguous project type');
  }
}

/** The engine is not built (message of 006: "Engine not built", the tried path and `make build`). */
export class EngineNotBuiltError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EngineNotBuiltError';
  }
}

/** The engine process ended while analyses were running (FR-029). */
export class EngineCrashedError extends Error {
  constructor(message = 'The analysis engine stopped unexpectedly; it is restarted for the next analysis.') {
    super(message);
    this.name = 'EngineCrashedError';
  }
}

/** The engine crashed repeatedly and is not relaunched for a while (FR-029). */
export class EngineUnavailableError extends Error {
  constructor(message = 'The analysis engine crashed repeatedly and is temporarily unavailable; retry in a minute.') {
    super(message);
    this.name = 'EngineUnavailableError';
  }
}

/** The analysis exceeded its time limit (FR-030). */
export class EngineTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`The analysis exceeded the time limit of ${Math.round(timeoutMs / 60000) || timeoutMs / 60000} minutes (timeout).`);
    this.name = 'EngineTimeoutError';
  }
}

export interface EngineClientOptions {
  /** Delays before relaunching after the 1st, 2nd, 3rd crash of the window (research D14: 1, 2, 4 s). */
  backoffMs?: number[];
  /** Crashes within `crashWindowMs` that make the engine unavailable for `unavailableMs`. */
  maxCrashes?: number;
  crashWindowMs?: number;
  unavailableMs?: number;
}

const WARNINGS_META = 'static-inference/warnings';
const CONNECTION_CLOSED = -32000;
const REQUEST_TIMEOUT = -32001;
const VERSION = '1.2.0';

export class EngineClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private starting: Promise<Client> | null = null;
  private readonly inFlight = new Map<string, AnalyzeHooks>();
  /** Incremented by shutdown(): a start that finishes in an older generation is discarded. */
  private generation = 0;
  /** After shutdown() the client never starts the engine again (a new runtime creates a new client). */
  private closed = false;
  /** Clients closed on purpose (recycle), whose close is not a crash. */
  private readonly intentional = new WeakSet<Client>();

  private crashes: number[] = [];
  private unavailableUntil = 0;
  private recycleWhenIdle = false;
  private readonly opts: Required<EngineClientOptions>;

  constructor(
    private readonly launch: () => EngineLaunchSpec,
    private readonly log: (line: string) => void = (l) => console.error(l),
    opts: EngineClientOptions = {},
  ) {
    this.opts = { backoffMs: [1000, 2000, 4000], maxCrashes: 3, crashWindowMs: 60_000, unavailableMs: 60_000, ...opts };
  }

  pid(): number | null {
    return this.transport?.pid ?? null;
  }

  async analyze(req: AnalyzeRequest, hooks: AnalyzeHooks): Promise<AnalyzeResult> {
    const client = await this.ensureStarted();
    this.inFlight.set(req.jobId, hooks);
    let last = -1;
    try {
      return await this.call(client, req, hooks, (i) => {
        if (i > last) {
          last = i;
          hooks.onPhase(PHASES[i]);
        }
      });
    } finally {
      this.inFlight.delete(req.jobId);
      if (this.recycleWhenIdle && this.inFlight.size === 0) void this.recycle();
    }
  }

  private async call(client: Client, req: AnalyzeRequest, hooks: AnalyzeHooks, phase: (i: number) => void): Promise<AnalyzeResult> {
    try {
      const result = await client.callTool(
        { name: 'analyze_project', arguments: { projectPath: req.projectPath, outputDir: req.outputDir, language: req.language } },
        undefined,
        {
          timeout: hooks.timeoutMs,
          onprogress: (p) => phase(PHASES.indexOf(p.message as Phase)),
        },
      );
      return this.parseResult(result);
    } catch (e) {
      const code = (e as { code?: number }).code;
      if (code === REQUEST_TIMEOUT) {
        this.recycleWhenIdle = true;
        throw new EngineTimeoutError(hooks.timeoutMs);
      }
      if (code === CONNECTION_CLOSED && !this.closed) throw new EngineCrashedError();
      throw e;
    }
  }

  /** Restarts the process once no analysis is using it (after a timeout the engine may still be busy). */
  private async recycle(): Promise<void> {
    this.recycleWhenIdle = false;
    const c = this.client;
    this.client = null;
    this.transport = null;
    if (c) {
      this.intentional.add(c);
      await c.close().catch(() => undefined);
    }
  }

  async shutdown(): Promise<void> {
    this.closed = true;
    this.generation++;
    const pending = this.starting;
    const c = this.client;
    this.client = null;
    this.transport = null;
    this.starting = null;
    if (c) await c.close().catch(() => undefined);
    // A start in progress closes its own client when it notices the new generation.
    if (pending) await pending.catch(() => undefined);
  }

  private recordCrash(): void {
    const now = Date.now();
    this.crashes = [...this.crashes.filter((t) => now - t < this.opts.crashWindowMs), now];
    this.log(`[engine] process exited unexpectedly (${this.crashes.length} crash(es) in the last minute)`);
    if (this.crashes.length >= this.opts.maxCrashes) {
      this.unavailableUntil = now + this.opts.unavailableMs;
      this.crashes = [];
    }
  }

  private parseResult(result: unknown): AnalyzeResult {
    const r = result as { isError?: boolean; content?: { type: string; text?: string }[]; _meta?: Record<string, unknown> };
    const text = r.content?.find((c) => c.type === 'text')?.text ?? '';
    const raw = r._meta?.[WARNINGS_META];
    const warnings = Array.isArray(raw) ? raw.map(String) : [];
    if (r.isError) throw new EngineToolError(text || 'The engine reported an error without a message', warnings);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new EngineToolError('The engine response is not valid JSON');
    }
    const check = analyzeProjectResponseSchema.safeParse(parsed);
    if (!check.success) throw new EngineToolError('The engine response violates the analyze_project contract 1.0.0');
    const s = check.data as AnalyzeSummary;
    return {
      summary: { componentCount: s.componentCount, edgeCount: s.edgeCount, proposalCount: s.proposalCount, endpointCount: s.endpointCount },
      warnings,
    };
  }

  private async ensureStarted(): Promise<Client> {
    if (this.closed) throw new Error('The engine client is shut down');
    if (this.client) return this.client;
    const now = Date.now();
    if (now < this.unavailableUntil) throw new EngineUnavailableError();
    if (!this.starting) {
      this.starting = this.start().finally(() => {
        this.starting = null;
      });
    }
    return this.starting;
  }

  private async start(): Promise<Client> {
    const generation = this.generation;
    const recent = this.crashes.length;
    if (recent > 0) {
      const delay = this.opts.backoffMs[Math.min(recent, this.opts.backoffMs.length) - 1];
      await new Promise((r) => setTimeout(r, delay));
    }
    const spec = this.launch();
    const transport = new StdioClientTransport({ command: spec.command, args: spec.args, env: spec.env, stderr: 'pipe' });
    this.pipeStderr(transport);
    const client = new Client({ name: 'dev-arch-web', version: VERSION });
    client.onclose = () => {
      if (this.client === client) {
        this.client = null;
        this.transport = null;
      }
      if (!this.closed && !this.intentional.has(client)) this.recordCrash();
    };
    try {
      await client.connect(transport);
    } catch (e) {
      await client.close().catch(() => undefined);
      throw e;
    }
    if (generation !== this.generation) {
      await client.close().catch(() => undefined);
      throw new Error('The engine client was shut down while starting');
    }
    this.client = client;
    this.transport = transport;
    return client;
  }

  private pipeStderr(transport: StdioClientTransport): void {
    const stream = transport.stderr;
    if (!stream) return;
    let buffer = '';
    stream.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).replace(/\r$/, '');
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        this.log(`[engine] ${line}`);
        for (const h of this.inFlight.values()) h.onStderr(line);
      }
    });
  }
}
