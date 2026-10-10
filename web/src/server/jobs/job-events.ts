// Structured log and time metrics of one analysis (011-quality-delivery, contracts/job-events.md; FR-023..FR-028).
// Events are appended as JSON lines to <job dir>/events.jsonl. They carry only identifiers, phases, codes and
// durations (never paths or engine messages), and a write failure is ignored: logging never changes the result.
import { promises as fs } from 'node:fs';
import type { Phase } from './job-store';

export type JobEventType = 'queued' | 'started' | 'phase-start' | 'phase-end' | 'completed' | 'failed';

export interface JobMetrics {
  queueMs: number;
  totalMs: number;
  phases: Partial<Record<Phase, number>>;
}

export interface ObservabilityDeps {
  /** Clock in epoch milliseconds (injectable for tests). */
  now?: () => number;
  /** Appends text to a file (injectable to simulate a full disk). */
  appendEvent?: (file: string, text: string) => Promise<void>;
  /** Console of the server: one structured line per finished analysis. */
  log?: (line: string) => void;
}

const span = (from: number, to: number) => Math.max(0, Math.round(to - from));

export class JobEventLog {
  private readonly now: () => number;
  private readonly append: (file: string, text: string) => Promise<void>;
  private readonly log: (line: string, failed: boolean) => void;
  private writes: Promise<unknown> = Promise.resolve();
  private startedAt: number | null = null;
  private current: { phase: Phase; at: number } | null = null;
  private lastPhase: Phase | null = null;
  private readonly phases: Partial<Record<Phase, number>> = {};

  constructor(private readonly jobId: string, private readonly file: string, deps: ObservabilityDeps = {}) {
    this.now = deps.now ?? Date.now;
    this.append = deps.appendEvent ?? ((f, t) => fs.appendFile(f, t));
    const sink = deps.log;
    this.log = sink ? (l) => sink(l) : (l, failed) => (failed ? console.warn(l) : console.info(l));
  }

  private emit(event: JobEventType, at: number, fields: Record<string, unknown> = {}): void {
    const line = `${JSON.stringify({ ts: new Date(at).toISOString(), jobId: this.jobId, event, ...fields })}\n`;
    this.writes = this.writes.then(() => this.append(this.file, line)).catch(() => undefined);
  }

  queued(): void {
    this.emit('queued', this.now());
  }

  started(): void {
    this.startedAt = this.now();
    this.emit('started', this.startedAt);
  }

  /** Closes the current phase (if any) and opens `phase`; the time is taken when the engine reports it. */
  phase(phase: Phase): void {
    const at = this.now();
    this.closePhase(at);
    this.current = { phase, at };
    this.lastPhase = phase;
    this.emit('phase-start', at, { phase });
  }

  private closePhase(at: number): void {
    if (!this.current) return;
    const d = span(this.current.at, at);
    this.phases[this.current.phase] = (this.phases[this.current.phase] ?? 0) + d;
    this.emit('phase-end', at, { phase: this.current.phase, durationMs: d });
    this.current = null;
  }

  /** Writes the final event and the console line, waits for the pending writes and returns the metrics. */
  async finish(outcome: { status: 'completed' | 'failed'; code?: string }, queueMs: number): Promise<JobMetrics> {
    const at = this.now();
    this.closePhase(at);
    const totalMs = this.startedAt === null ? 0 : span(this.startedAt, at);
    const failed = outcome.status === 'failed';
    this.emit(outcome.status, at, {
      status: outcome.status,
      ...(failed ? { code: outcome.code, ...(this.lastPhase ? { phase: this.lastPhase } : {}) } : {}),
      durationMs: totalMs,
    });
    // Phase durations are clamped individually; with a backwards clock their sum may exceed the total: cap it.
    let budget = totalMs;
    const phases: Partial<Record<Phase, number>> = {};
    for (const [p, d] of Object.entries(this.phases) as [Phase, number][]) {
      phases[p] = Math.min(d, budget);
      budget -= phases[p]!;
    }
    this.log(JSON.stringify({
      level: failed ? 'warn' : 'info', msg: 'analysis finished', jobId: this.jobId, status: outcome.status,
      ...(outcome.code ? { code: outcome.code } : {}), totalMs,
    }), failed);
    await this.writes;
    return { queueMs: Math.max(0, Math.round(queueMs)), totalMs, phases };
  }
}
