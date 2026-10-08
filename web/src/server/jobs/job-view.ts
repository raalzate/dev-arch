// Public view of a job for the API (contracts/analyses-api.md; FR-002, FR-034: no absolute server paths).
import { realpathSync } from 'node:fs';
import path from 'node:path';
import type { AppConfig } from '../config';
import { redactText } from '../security/path-redaction';
import type { Job, JobStore } from './job-store';

/** Absolute forms of the project root of a job (as passed to the engine and resolved). */
export function projectRoots(job: Job): string[] {
  if (!job.projectRoot) return [];
  const roots = [job.projectRoot];
  try {
    roots.push(realpathSync(job.projectRoot));
  } catch {
    /* removed or not yet extracted */
  }
  return roots;
}

export function dataDirs(config: AppConfig): string[] {
  const dirs = [config.dataDir];
  try {
    dirs.push(realpathSync(config.dataDir));
  } catch {
    /* not created yet */
  }
  return dirs;
}

/** Project root relative to the analysis sources (".", "<folder>") or the base name of a local folder. */
export function publicProjectRoot(job: Job, store: JobStore): string | null {
  if (!job.projectRoot) return null;
  if (job.origin === 'localPath') return path.basename(job.projectRoot);
  const rel = path.relative(store.paths(job.id).source, job.projectRoot);
  return rel === '' ? '.' : rel.split(path.sep).join('/');
}

export function publicJob(job: Job, store: JobStore, config: AppConfig) {
  const roots = projectRoots(job);
  const dirs = dataDirs(config);
  const tidy = (t: string) => redactText(t, roots, dirs);
  return {
    jobId: job.id,
    origin: job.origin,
    language: job.language,
    status: job.status,
    phase: job.phase,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    error: job.error && job.error.code !== 'ENGINE_NOT_BUILT' ? { ...job.error, message: tidy(job.error.message) } : job.error,
    warnings: job.warnings.map(tidy),
    summary: job.summary,
    projectRoot: publicProjectRoot(job, store),
    hasSources: job.origin !== 'import',
  };
}
