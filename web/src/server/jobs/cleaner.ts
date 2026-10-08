// Removal of expired analyses (007, research D7; FR-012, SC-011): terminal jobs whose finishedAt + TTL is past,
// and orphan directories without job.json older than one hour. Queued or running jobs never expire.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { isJobId, isTerminal, type JobStore } from './job-store';

const HOUR = 3600_000;

export async function cleanupExpired(store: JobStore, ttlHours: number, now: Date): Promise<string[]> {
  const removed: string[] = [];
  let names: string[];
  try {
    names = await fs.readdir(store.jobsDir);
  } catch {
    return removed;
  }
  for (const name of names) {
    if (!isJobId(name)) continue;
    const job = await store.get(name);
    if (job) {
      if (!isTerminal(job.status) || !job.finishedAt) continue;
      if (Date.parse(job.finishedAt) + ttlHours * HOUR < now.getTime()) {
        await store.delete(job.id);
        removed.push(job.id);
      }
      continue;
    }
    try {
      const st = await fs.stat(path.join(store.jobsDir, name));
      if (st.mtimeMs + HOUR < now.getTime()) await fs.rm(path.join(store.jobsDir, name), { recursive: true, force: true });
    } catch {
      /* gone meanwhile */
    }
  }
  return removed;
}
