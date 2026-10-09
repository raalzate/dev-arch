// History of the analyses kept by the server (010-modernization-ux FR-036; contracts/web-api.md): the 007 public
// view of every job, newest first, plus the technology detected from its dependency graph (completed analyses only;
// computed once per analysis and cached, since completed documents never change).
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { DependencyGraph } from '@static-inference/schema';
import { technologyProfile, type Technology } from '../../lib/modernization/technology';
import type { AppConfig } from '../config';
import { DOCUMENTS } from './job-runner';
import type { JobStore } from './job-store';
import { publicJob } from './job-view';

export type TechnologyCache = Map<string, { technology: Technology; label: string } | null>;

async function detect(store: JobStore, id: string): Promise<{ technology: Technology; label: string } | null> {
  try {
    const graph = JSON.parse(await fs.readFile(path.join(store.paths(id).out, DOCUMENTS.graph.file), 'utf8')) as DependencyGraph;
    if (!graph?.meta?.source || !Array.isArray(graph.components)) return null;
    const p = technologyProfile(graph);
    return { technology: p.technology, label: p.label };
  } catch {
    return null;
  }
}

export async function historyEntries(store: JobStore, config: AppConfig, cache: TechnologyCache) {
  const jobs = await store.list();
  jobs.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : a.id < b.id ? -1 : 1));
  const out = [];
  for (const job of jobs) {
    let tech: { technology: Technology; label: string } | null = null;
    if (job.status === 'completed') {
      if (!cache.has(job.id)) cache.set(job.id, await detect(store, job.id));
      tech = cache.get(job.id) ?? null;
    }
    out.push({ ...publicJob(job, store, config), technology: tech?.technology ?? null, technologyLabel: tech?.label ?? null });
  }
  return out;
}
