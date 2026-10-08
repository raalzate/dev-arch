// Git helpers: clean clones, tracked files and history lookups.
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runOk, run } from './process.ts';

export function git(args: string[], cwd: string): string {
  return runOk('git', args, { cwd }).stdout.trim();
}

export function gitOk(args: string[], cwd: string): boolean {
  return run('git', args, { cwd }).code === 0;
}

/**
 * Clean clone of the checkout under test at its current HEAD commit (committed content only, as a fresh
 * `git clone` of the feature branch would see it). With checkout=false only the object database is cloned.
 */
export function cleanClone(source: string, checkout: boolean): { dir: string; commit: string } {
  const commit = git(['rev-parse', 'HEAD'], source);
  const dir = path.join(mkdtempSync(path.join(os.tmpdir(), 'devarch-006 clone-')), 'repo');
  runOk('git', ['clone', '--quiet', '--no-checkout', source, dir], { cwd: os.tmpdir(), timeoutMs: 15 * 60 * 1000 });
  // A clone only copies the source's local branches: carry its main branch too (as origin/main), so scenarios
  // comparing against the monorepo main branch also work inside nested clones (clean clone of a clone, CI).
  const main = ['refs/heads/main', 'refs/remotes/origin/main'].find((ref) => gitOk(['rev-parse', '--verify', '--quiet', ref], source));
  if (main) runOk('git', ['fetch', '--quiet', source, `+${main}:refs/remotes/origin/main`], { cwd: dir, timeoutMs: 15 * 60 * 1000 });
  if (checkout) runOk('git', ['checkout', '--quiet', commit], { cwd: dir, timeoutMs: 15 * 60 * 1000 });
  return { dir, commit };
}

/** Paths tracked at a commit below a directory (relative to the repository root). */
export function trackedFiles(repo: string, commit: string, dir: string): string[] {
  const out = git(['ls-tree', '-r', '--name-only', '-z', commit, '--', dir], repo);
  return out ? out.split('\0').filter(Boolean) : [];
}

/** Root entry names of a directory at a commit. */
export function rootEntries(repo: string, commit: string, dir: string): { name: string; type: string }[] {
  const out = git(['ls-tree', '-z', `${commit}:${dir}`], repo);
  return out
    .split('\0')
    .filter(Boolean)
    .map((line) => {
      const [meta, name] = line.split('\t');
      return { name, type: meta.split(' ')[1] };
    });
}

export function revList(repo: string, ref: string, extra: string[] = []): string[] {
  const out = git(['rev-list', ...extra, ref], repo);
  return out ? out.split('\n') : [];
}
