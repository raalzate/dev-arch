// Analyses persisted on disk under <dataDir>/jobs/<id>/ (007-native-engine-runtime, data-model.md, research D7).
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { JobMetrics } from './job-events';

export type JobOrigin = 'zip' | 'localPath' | 'import' | 'sync';
export type Language = 'java' | 'dotnet' | 'auto';
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';
export type Phase = 'detection' | 'extraction' | 'inference' | 'writing';
export const PHASES: readonly Phase[] = ['detection', 'extraction', 'inference', 'writing'];
export const LANGUAGES: readonly Language[] = ['java', 'dotnet', 'auto'];

export interface JobError {
  code: string;
  message: string;
}

export interface JobSummary {
  componentCount: number;
  edgeCount: number;
  proposalCount: number;
  endpointCount: number;
}

export interface Job {
  id: string;
  origin: JobOrigin;
  language: Language;
  status: JobStatus;
  phase: Phase | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: JobError | null;
  warnings: string[];
  projectRoot: string | null;
  summary: JobSummary | null;
  uploadBytes: number | null;
  /** Time metrics of a finished analysis (011 FR-024); absent until it finishes. */
  metrics?: JobMetrics | null;
  /** Extraction configuration sent with the submission (026); null or absent = engine defaults. */
  extractionConfig?: Record<string, unknown> | null;
}

export interface JobPaths {
  dir: string;
  jobJson: string;
  upload: string;
  source: string;
  out: string;
  log: string;
  /** Structured events of the analysis (011 FR-023). */
  events: string;
}

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isJobId(id: unknown): id is string {
  return typeof id === 'string' && ID_RE.test(id);
}

const TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  queued: ['queued', 'running', 'failed'],
  running: ['running', 'completed', 'failed'],
  completed: ['completed'],
  failed: ['failed'],
};

export function isTerminal(status: JobStatus): boolean {
  return status === 'completed' || status === 'failed';
}

export class JobStore {
  constructor(
    readonly dataDir: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  get jobsDir(): string {
    return path.join(this.dataDir, 'jobs');
  }

  paths(id: string): JobPaths {
    if (!isJobId(id)) throw new Error(`invalid job id '${id}'`);
    const dir = path.join(this.jobsDir, id);
    return {
      dir,
      jobJson: path.join(dir, 'job.json'),
      upload: path.join(dir, 'upload.zip'),
      source: path.join(dir, 'source'),
      out: path.join(dir, 'out'),
      log: path.join(dir, 'engine.log'),
      events: path.join(dir, 'events.jsonl'),
    };
  }

  async create(init: Partial<Job> & Pick<Job, 'origin' | 'language'>): Promise<Job> {
    const id = randomUUID();
    const nowIso = this.now().toISOString();
    const status = init.status ?? 'queued';
    const job: Job = {
      id,
      origin: init.origin,
      language: init.language,
      extractionConfig: init.extractionConfig ?? null,
      status,
      phase: init.phase ?? null,
      createdAt: nowIso,
      startedAt: init.startedAt ?? (status === 'running' ? nowIso : null),
      finishedAt: init.finishedAt ?? (status === 'completed' || status === 'failed' ? nowIso : null),
      error: init.error ?? null,
      warnings: init.warnings ?? [],
      projectRoot: init.projectRoot ?? null,
      summary: init.summary ?? null,
      uploadBytes: init.uploadBytes ?? null,
    };
    await fs.mkdir(this.paths(id).dir, { recursive: true });
    await this.write(job);
    return job;
  }

  async get(id: string): Promise<Job | null> {
    if (!isJobId(id)) return null;
    try {
      return JSON.parse(await fs.readFile(this.paths(id).jobJson, 'utf8')) as Job;
    } catch {
      return null;
    }
  }

  /** Applies a patch; status changes follow data-model.md and the phase never goes backwards. */
  async update(id: string, patch: Partial<Omit<Job, 'id' | 'origin' | 'createdAt'>>): Promise<Job> {
    const job = await this.get(id);
    if (!job) throw new Error(`job ${id} not found`);
    const next: Job = { ...job, ...patch };
    if (!TRANSITIONS[job.status].includes(next.status)) {
      throw new Error(`invalid transition ${job.status} -> ${next.status} for job ${id}`);
    }
    if (patch.phase !== undefined && job.phase && next.phase && PHASES.indexOf(next.phase) < PHASES.indexOf(job.phase)) {
      throw new Error(`phase cannot go backwards (${job.phase} -> ${next.phase})`);
    }
    const nowIso = this.now().toISOString();
    if (next.status === 'running' && !next.startedAt) next.startedAt = nowIso;
    if (isTerminal(next.status) && !isTerminal(job.status) && !patch.finishedAt) next.finishedAt = nowIso;
    await this.write(next);
    return next;
  }

  async list(): Promise<Job[]> {
    let names: string[];
    try {
      names = await fs.readdir(this.jobsDir);
    } catch {
      return [];
    }
    const jobs: Job[] = [];
    for (const n of names.sort()) {
      const j = await this.get(n);
      if (j) jobs.push(j);
    }
    return jobs;
  }

  async delete(id: string): Promise<void> {
    await fs.rm(this.paths(id).dir, { recursive: true, force: true });
  }

  private async write(job: Job): Promise<void> {
    const p = this.paths(job.id);
    const tmp = `${p.jobJson}.${process.pid}.${randomUUID()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(job, null, 2));
    await fs.rename(tmp, p.jobJson);
  }
}
