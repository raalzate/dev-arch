// Helpers of the 011-quality-delivery acceptance steps: workflow access, product files, Maven/npm runners and the
// web coverage target set (contracts/coverage.md).
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { layout } from './layout.ts';
import { jdk17Home, which } from './tools.ts';
import { run, type RunResult } from './process.ts';

export type CiStep = { name?: string; uses?: string; run?: string; with?: Record<string, unknown>; 'continue-on-error'?: unknown; 'working-directory'?: string };
export type CiJob = { if?: string; needs?: string | string[]; steps?: CiStep[]; 'continue-on-error'?: unknown; strategy?: unknown };
export type CiWorkflow = { on: Record<string, unknown>; jobs: Record<string, CiJob> };

export function workflow(world: { data: Record<string, unknown> }): CiWorkflow {
  if (!world.data.workflow) {
    world.data.workflow = parse(readFileSync(path.join(layout.monorepoRoot, '.github', 'workflows', 'dev-arch.yml'), 'utf8'));
  }
  return world.data.workflow as CiWorkflow;
}

export function job(wf: CiWorkflow, name: string): CiJob {
  const j = wf.jobs[name];
  assert.ok(j, `the workflow has no job "${name}"`);
  return j;
}

export const stepsOf = (j: CiJob): CiStep[] => j.steps ?? [];
export const needsOf = (j: CiJob): string[] => ([] as string[]).concat(j.needs ?? []);

export function tolerates(j: CiJob, s: CiStep): boolean {
  const truthy = (v: unknown) => v === true || String(v) === 'true';
  return truthy(j['continue-on-error']) || truthy(s['continue-on-error']) || /\|\|\s*true\b/.test(String(s.run ?? ''));
}

export function productFile(rel: string): string {
  const file = path.join(layout.productRoot, rel);
  assert.ok(existsSync(file), `missing ${rel}`);
  return readFileSync(file, 'utf8');
}

/** Body of a bash function `name() { ... }` of a script (up to the first line that is exactly "}"). */
export function bashFunction(script: string, name: string): string {
  const start = script.search(new RegExp(`^${name}\\(\\)\\s*\\{`, 'm'));
  assert.ok(start >= 0, `no function ${name}() in the script`);
  const rest = script.slice(start);
  const end = rest.search(/^\}\s*$/m);
  return end < 0 ? rest : rest.slice(0, end);
}

export function productVersion(): string {
  return readFileSync(path.join(layout.productRoot, 'VERSION'), 'utf8').trim();
}

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

export function filesUnder(dir: string): string[] {
  return walk(dir);
}

/** Web coverage target set (FR-018, contracts/coverage.md), paths relative to web/. */
export function webCoverageTargets(): string[] {
  const web = layout.webDir;
  const rel = (p: string) => path.relative(web, p).split(path.sep).join('/');
  const all = [
    ...walk(path.join(web, 'src', 'server')).filter((f) => f.endsWith('.ts')),
    ...walk(path.join(web, 'src', 'app', 'api')).filter((f) => path.basename(f) === 'route.ts'),
    ...walk(path.join(web, 'src', 'lib')).filter((f) => f.endsWith('.ts')),
  ].map(rel);
  return all
    .filter((f) => !f.endsWith('.test.ts') && !f.endsWith('.d.ts'))
    .filter((f) => f !== 'src/lib/modernization/test-fixtures.ts' && f !== 'src/lib/placeholder-images.ts')
    .sort();
}

export function mavenEnv(): NodeJS.ProcessEnv {
  return { JAVA_HOME: jdk17Home() ?? process.env.JAVA_HOME };
}

export function mvn(args: string[], extraEnv: NodeJS.ProcessEnv = {}): RunResult {
  const wrapper = path.join(layout.engineRoot, 'mvnw');
  const bin = which('mvn') ?? wrapper;
  return run(bin, ['-B', ...args], { cwd: layout.engineRoot, env: { ...mavenEnv(), ...extraEnv }, timeoutMs: 30 * 60 * 1000 });
}

export function npmWeb(script: string, extra: string[] = []): RunResult {
  return run('npm', ['run', script, '-w', 'web', ...(extra.length ? ['--', ...extra] : [])], {
    cwd: layout.productRoot,
    timeoutMs: 15 * 60 * 1000,
  });
}

export function mtime(file: string): number {
  return statSync(file).mtimeMs;
}
