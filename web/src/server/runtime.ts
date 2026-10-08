// Per-process runtime of the analyses API (007-native-engine-runtime): configuration, job store, engine client and
// runner, kept on globalThis so that route modules, instrumentation and `next dev` HMR share one instance.
import { existsSync } from 'node:fs';
import { loadConfig, type AppConfig } from './config';
import { EngineClient, EngineNotBuiltError } from './engine/engine-client';
import { locateEngine } from './engine/engine-locator';
import { JobRunner, type JobRuntimeDeps } from './jobs/job-runner';
import { JobStore } from './jobs/job-store';

export interface Runtime {
  config: AppConfig;
  cwd: string;
  store: JobStore;
  engine: EngineClient;
  runner: JobRunner;
  timers: NodeJS.Timeout[];
}

export interface RuntimeOverrides {
  deps?: JobRuntimeDeps;
  now?: () => Date;
  log?: (line: string) => void;
}

type Holder = { runtime?: Runtime; overrides?: RuntimeOverrides };
const holder = ((globalThis as Record<string, unknown>).__devarchRuntime ??= {}) as Holder;

/** Test seam: dependencies used by the next runtime created (fault injection, controllable clock). */
export function setRuntimeOverrides(overrides: RuntimeOverrides | undefined): void {
  holder.overrides = overrides;
}

/** Locates the engine now (FR-032: ENGINE_NOT_BUILT is reported at submission). */
export function engineLaunchOrError(cwd: string) {
  return locateEngine(process.env, cwd, existsSync);
}

export function getRuntime(): Runtime {
  if (holder.runtime) return holder.runtime;
  const cwd = process.cwd();
  const config = loadConfig(process.env, cwd);
  const o = holder.overrides ?? {};
  const store = new JobStore(config.dataDir, o.now);
  const engine = new EngineClient(() => {
    const l = engineLaunchOrError(cwd);
    if (l.kind === 'not-built') throw new EngineNotBuiltError(l.message);
    return { command: l.command, args: l.args, env: l.env };
  }, o.log);
  const runner = new JobRunner(store, engine, config, o.deps);
  holder.runtime = { config, cwd, store, engine, runner, timers: [] };
  return holder.runtime;
}

/** Stops the engine process and the timers and forgets the runtime (server restart in tests, shutdown). */
export async function resetRuntime(): Promise<void> {
  const r = holder.runtime;
  holder.runtime = undefined;
  if (!r) return;
  for (const t of r.timers) clearInterval(t);
  const settled = r.runner.dispose();
  await r.engine.shutdown();
  await settled;
}
