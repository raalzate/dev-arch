// Runs analyses in the background (007-native-engine-runtime, research D2, D7, D14; FR-008..FR-011, FR-029..FR-031,
// FR-037): FIFO queue, semaphore of `maxConcurrent`, ZIP extraction, engine call, contract validation of the three
// documents and mapping of every failure to a coded, summarized error.
import { promises as fs, realpathSync } from 'node:fs';
import path from 'node:path';
import {
  consolidatedArchitectureSchema,
  dependencyGraphSchema,
  entrypointsDocumentSchema,
} from '@static-inference/schema';
import { ApiError, isStorageFull } from '../api-error';
import type { AppConfig } from '../config';
import type { AnalyzeHooks, AnalyzeRequest, AnalyzeResult } from '../engine/engine-client';
import { EngineNotBuiltError, EngineToolError } from '../engine/engine-client';
import { redactText } from '../security/path-redaction';
import { extractZip, type ExtractIo } from '../upload/safe-extract';
import type { StreamIo } from '../upload/stream-to-file';
import { findProjectRoot } from '../upload/project-root';
import type { Job, JobError, JobStore, Phase } from './job-store';
import { JobEventLog, type ObservabilityDeps } from './job-events';

export interface Engine {
  analyze(req: AnalyzeRequest, hooks: AnalyzeHooks): Promise<AnalyzeResult>;
}

/** File-system operations of the pipeline that can fail with a full disk (injectable, FR-037). */
export type JobRuntimeDeps = Partial<ExtractIo & StreamIo> & ObservabilityDeps;

export const DOCUMENTS = {
  graph: { file: 'output.json', schema: dependencyGraphSchema },
  architecture: { file: 'output_architecture.json', schema: consolidatedArchitectureSchema },
  contracts: { file: 'output_entrypoints.json', schema: entrypointsDocumentSchema },
} as const;

export class JobFailure extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

/** First line of an engine message without Java exception class names, at most 300 characters. */
export function summarize(message: string): string {
  const first = message.split('\n').find((l) => l.trim()) ?? message;
  const clean = first
    .replace(/\b(?:[a-z_$][\w$]*\.)+[A-Z][\w$]*(?:Exception|Error)\b:?\s*/g, '')
    .replace(/\s+at\s+[\w$.]+\(.*$/, '')
    .trim();
  return (clean || 'The analysis failed').slice(0, 300);
}

export class JobRunner {
  private readonly queue: string[] = [];
  private readonly running = new Set<string>();
  private reserved = 0;
  private disposed = false;
  private readonly settled = new Set<Promise<void>>();
  /** Project folder of each queued/running job (realpath), for the per-project mutex (FR-010). */
  private readonly keys = new Map<string, string>();
  /** Structured event log of each queued/running job (011 FR-023). */
  private readonly eventLogs = new Map<string, JobEventLog>();

  constructor(
    private readonly store: JobStore,
    private readonly engine: Engine,
    private readonly config: AppConfig,
    private readonly deps: JobRuntimeDeps = {},
  ) {}

  /** Takes a slot of the quota (running + queued) before the body of a submission is read (FR-011). */
  reserve(): boolean {
    const used = this.running.size + this.queue.length + this.reserved;
    if (used >= this.config.maxConcurrent + this.config.maxQueued) return false;
    this.reserved++;
    return true;
  }

  release(): void {
    if (this.reserved > 0) this.reserved--;
  }

  /** Queues a stored job (status queued) and returns at once whether it started or waits. */
  submit(jobId: string, projectFolder?: string): 'running' | 'queued' {
    this.release();
    if (projectFolder) {
      let key = projectFolder;
      try {
        key = realpathSync(projectFolder);
      } catch {
        /* the runner reports the missing folder */
      }
      this.keys.set(jobId, key);
    }
    const events = new JobEventLog(jobId, this.store.paths(jobId).events, this.deps);
    events.queued();
    this.eventLogs.set(jobId, events);
    this.queue.push(jobId);
    this.pump();
    return this.running.has(jobId) ? 'running' : 'queued';
  }

  /** Stops starting queued jobs and waits (bounded) for the running ones to settle (server shutdown). */
  async dispose(timeoutMs = 5000): Promise<void> {
    this.disposed = true;
    this.queue.length = 0;
    await Promise.race([Promise.allSettled([...this.settled]), new Promise((r) => setTimeout(r, timeoutMs).unref())]);
  }

  activeCount(): number {
    return this.running.size + this.queue.length;
  }

  /** Marks every job left queued or running by a previous server process as interrupted (FR-009). */
  async recoverOnStart(): Promise<number> {
    let n = 0;
    for (const job of await this.store.list()) {
      if (job.status !== 'queued' && job.status !== 'running') continue;
      if (this.running.has(job.id) || this.queue.includes(job.id)) continue;
      await this.store.update(job.id, {
        status: 'failed',
        error: { code: 'INTERRUPTED', message: 'The web server restarted while the analysis was active (interrupted).' },
      });
      n++;
    }
    return n;
  }

  private nextRunnable(): number {
    const busy = new Set([...this.running].map((id) => this.keys.get(id)).filter(Boolean));
    return this.queue.findIndex((id) => !busy.has(this.keys.get(id)));
  }

  private pump(): void {
    while (!this.disposed && this.running.size < this.config.maxConcurrent && this.queue.length > 0) {
      const index = this.nextRunnable();
      if (index < 0) return;
      const id = this.queue.splice(index, 1)[0];
      this.running.add(id);
      const p: Promise<void> = this.run(id)
        .catch((e) => console.error(`[analyses] job ${id} could not be recorded:`, e))
        .finally(() => {
          this.running.delete(id);
          this.keys.delete(id);
          this.eventLogs.delete(id);
          this.settled.delete(p);
          if (!this.disposed) this.pump();
        });
      this.settled.add(p);
    }
  }

  private roots(job: Job): string[] {
    return job.projectRoot ? [job.projectRoot] : [];
  }

  private async run(id: string): Promise<void> {
    const p = this.store.paths(id);
    let job = await this.store.update(id, { status: 'running' });
    const events = this.eventLogs.get(id) ?? new JobEventLog(id, p.events, this.deps);
    events.started();
    const queueMs = Date.parse(job.startedAt ?? job.createdAt) - Date.parse(job.createdAt);
    let updates: Promise<unknown> = Promise.resolve();
    const enqueue = (fn: () => Promise<unknown>) => {
      updates = updates.then(fn).catch(() => undefined);
      return updates;
    };
    try {
      if (job.origin === 'zip') {
        try {
          await extractZip(p.upload, p.source, this.config, this.deps);
        } catch (e) {
          if (e instanceof ApiError) throw new JobFailure(e.code, e.message);
          throw e;
        }
        await fs.rm(p.upload, { force: true });
        job = await this.store.update(id, { projectRoot: findProjectRoot(p.source) });
      }
      const projectRoot = job.projectRoot;
      if (!projectRoot) throw new JobFailure('IO_ERROR', 'The analysis has no project to analyze.');
      if (this.disposed) throw new JobFailure('INTERRUPTED', 'The web server stopped while the analysis was active.');
      await fs.mkdir(p.out, { recursive: true });
      const result = await this.engine.analyze(
        { jobId: id, projectPath: projectRoot, outputDir: p.out, language: job.language, config: job.extractionConfig ?? undefined },
        {
          timeoutMs: this.config.analysisTimeoutMs,
          onPhase: (phase: Phase) => {
            events.phase(phase);
            void enqueue(() => this.store.update(id, { phase }));
          },
          // Queued with the status updates so the log is complete before the final status is stored.
          onStderr: (line: string) => void enqueue(() => fs.appendFile(p.log, `${line}\n`)),
        },
      );
      await updates;
      if (this.disposed) return;
      await this.validateDocuments(p.out);
      const roots = this.roots(job);
      const metrics = await events.finish({ status: 'completed' }, queueMs);
      await this.store.update(id, {
        status: 'completed',
        metrics,
        summary: result.summary,
        warnings: result.warnings.map((w) => redactText(w, roots, [this.config.dataDir])),
      });
    } catch (e) {
      await updates;
      // A server shutdown leaves the job as it is: the next start marks it INTERRUPTED (recoverOnStart).
      if (this.disposed) return;
      const error = this.toJobError(e, job);
      if (error.code === 'STORAGE_FULL' || error.code === 'UNCOMPRESSED_TOO_LARGE') {
        await fs.rm(p.source, { recursive: true, force: true });
        await fs.rm(p.upload, { force: true });
        if (error.code === 'STORAGE_FULL') await fs.rm(p.out, { recursive: true, force: true });
      }
      const warnings = e instanceof EngineToolError
        ? e.warnings.map((w) => redactText(w, this.roots(job), [this.config.dataDir]))
        : undefined;
      const metrics = await events.finish({ status: 'failed', code: error.code }, queueMs);
      await this.store.update(id, { status: 'failed', error, metrics, ...(warnings?.length ? { warnings } : {}) }).catch(() => undefined);
    }
  }

  private async validateDocuments(outDir: string): Promise<void> {
    for (const { file, schema } of Object.values(DOCUMENTS)) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(await fs.readFile(path.join(outDir, file), 'utf8'));
      } catch {
        throw new JobFailure('ENGINE_ERROR', `The engine did not produce a readable ${file}.`);
      }
      const check = schema.safeParse(parsed);
      if (!check.success) {
        const pointer = '/' + (check.error.issues[0]?.path ?? []).join('/');
        throw new JobFailure('ENGINE_ERROR', `engine output violates contract 1.0.0: ${file} ${pointer}`);
      }
    }
  }

  protected toJobError(e: unknown, job: Job): JobError {
    const roots = this.roots(job);
    const tidy = (m: string) => redactText(summarize(m), roots, [this.config.dataDir]);
    if (e instanceof JobFailure) return { code: e.code, message: tidy(e.message) };
    if (e instanceof EngineNotBuiltError) return { code: 'ENGINE_NOT_BUILT', message: e.message };
    if (e instanceof EngineToolError && /Invalid inference configuration|configuration/i.test(e.message) && /must be|unknown parameter|not valid JSON|must have/i.test(e.message)) {
      // 026 (FR-004): the engine rejected the submitted configuration; keep its message for the user.
      return { code: 'INFERENCE_CONFIG_INVALID', message: tidy(e.message) };
    }
    if (e instanceof EngineToolError) {
      if (e.ambiguous) return { code: 'AMBIGUOUS_PROJECT', message: tidy(e.message) };
      if (/No space left on device|ENOSPC|Disk quota exceeded/i.test(e.message)) {
        return { code: 'STORAGE_FULL', message: 'Insufficient disk space while writing the results.' };
      }
      return { code: 'ENGINE_ERROR', message: tidy(e.message) };
    }
    if (isStorageFull(e)) return { code: 'STORAGE_FULL', message: 'Insufficient disk space during the analysis.' };
    const name = (e as { name?: string })?.name;
    if (name === 'EngineCrashedError') return { code: 'ENGINE_CRASHED', message: (e as Error).message };
    if (name === 'EngineUnavailableError') return { code: 'ENGINE_UNAVAILABLE', message: (e as Error).message };
    if (name === 'EngineTimeoutError') return { code: 'TIMEOUT', message: (e as Error).message };
    return { code: 'ENGINE_ERROR', message: tidy(e instanceof Error ? e.message : String(e)) };
  }
}
