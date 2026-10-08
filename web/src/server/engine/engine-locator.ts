// Launch command of the engine in MCP server mode (007, contracts/engine-client.md). Extends the 006 resolution
// (engine-path.ts: ENGINE_JAR_PATH / JAVA_HOME and the same "Engine not built" message) without changing it.
import { resolveEngine } from './engine-path';

export type EngineLaunch =
  | { kind: 'resolved'; command: string; args: string[]; jarPath: string; env: Record<string, string> }
  | { kind: 'not-built'; jarPath: string; message: string };

export function locateEngine(env: NodeJS.ProcessEnv, cwd: string, exists: (p: string) => boolean): EngineLaunch {
  const r = resolveEngine(env, cwd, exists);
  if (r.kind === 'not-built') return r;
  const javaOpts = (env.ENGINE_JAVA_OPTS ?? '').split(/\s+/).filter(Boolean);
  const childEnv: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) if (v !== undefined) childEnv[k] = v;
  return { kind: 'resolved', command: r.javaBin, args: [...javaOpts, '-jar', r.jarPath, '--mcp'], jarPath: r.jarPath, env: childEnv };
}
