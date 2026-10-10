// Launch command of the engine in MCP server mode (007, contracts/engine-client.md). Extends the 006 resolution
// (engine-path.ts: ENGINE_JAR_PATH / JAVA_HOME and the same "Engine not built" message) without changing it.
import { resolveEngine } from './engine-path';
import type { Env } from '../config';

export type EngineLaunch =
  | { kind: 'resolved'; command: string; args: string[]; jarPath: string; env: Record<string, string> }
  | { kind: 'not-built'; jarPath: string; message: string };

// 008-configurable-inference (FR-027): the web always enables reinfer_architecture/score_proposal and tells the engine
// where the analyses live so a jobId resolves to <jobsDir>/<jobId>/out/output.json.
export const INFERENCE_TOOLS_ENV = 'STATIC_INFERENCE_INFERENCE_TOOLS';
export const JOBS_DIR_ENV = 'STATIC_INFERENCE_JOBS_DIR';

export function locateEngine(
  env: Env,
  cwd: string,
  exists: (p: string) => boolean,
  jobsDir?: string,
): EngineLaunch {
  const r = resolveEngine(env, cwd, exists);
  if (r.kind === 'not-built') return r;
  const javaOpts = (env.ENGINE_JAVA_OPTS ?? '').split(/\s+/).filter(Boolean);
  const childEnv: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) if (v !== undefined) childEnv[k] = v;
  childEnv[INFERENCE_TOOLS_ENV] = 'true';
  if (jobsDir) childEnv[JOBS_DIR_ENV] = jobsDir;
  return { kind: 'resolved', command: r.javaBin, args: [...javaOpts, '-jar', r.jarPath, '--mcp'], jarPath: r.jarPath, env: childEnv };
}
