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
  constructor(message: string) {
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

const WARNINGS_META = 'static-inference/warnings';
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

  constructor(
    private readonly launch: () => EngineLaunchSpec,
    private readonly log: (line: string) => void = (l) => console.error(l),
  ) {}

  pid(): number | null {
    return this.transport?.pid ?? null;
  }

  async analyze(req: AnalyzeRequest, hooks: AnalyzeHooks): Promise<AnalyzeResult> {
    const client = await this.ensureStarted();
    this.inFlight.set(req.jobId, hooks);
    let last = -1;
    try {
      const result = await client.callTool(
        { name: 'analyze_project', arguments: { projectPath: req.projectPath, outputDir: req.outputDir, language: req.language } },
        undefined,
        {
          timeout: hooks.timeoutMs,
          onprogress: (p) => {
            const i = PHASES.indexOf(p.message as Phase);
            if (i > last) {
              last = i;
              hooks.onPhase(PHASES[i]);
            }
          },
        },
      );
      return this.parseResult(result);
    } finally {
      this.inFlight.delete(req.jobId);
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

  private parseResult(result: unknown): AnalyzeResult {
    const r = result as { isError?: boolean; content?: { type: string; text?: string }[]; _meta?: Record<string, unknown> };
    const text = r.content?.find((c) => c.type === 'text')?.text ?? '';
    if (r.isError) throw new EngineToolError(text || 'The engine reported an error without a message');
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new EngineToolError('The engine response is not valid JSON');
    }
    const check = analyzeProjectResponseSchema.safeParse(parsed);
    if (!check.success) throw new EngineToolError('The engine response violates the analyze_project contract 1.0.0');
    const s = check.data as AnalyzeSummary;
    const raw = r._meta?.[WARNINGS_META];
    const warnings = Array.isArray(raw) ? raw.map(String) : [];
    return {
      summary: { componentCount: s.componentCount, edgeCount: s.edgeCount, proposalCount: s.proposalCount, endpointCount: s.endpointCount },
      warnings,
    };
  }

  private async ensureStarted(): Promise<Client> {
    if (this.closed) throw new Error('The engine client is shut down');
    if (this.client) return this.client;
    if (!this.starting) {
      this.starting = this.start().finally(() => {
        this.starting = null;
      });
    }
    return this.starting;
  }

  private async start(): Promise<Client> {
    const generation = this.generation;
    const spec = this.launch();
    const transport = new StdioClientTransport({ command: spec.command, args: spec.args, env: spec.env, stderr: 'pipe' });
    this.pipeStderr(transport);
    const client = new Client({ name: 'dev-arch-web', version: VERSION });
    client.onclose = () => {
      if (this.client === client) {
        this.client = null;
        this.transport = null;
      }
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
