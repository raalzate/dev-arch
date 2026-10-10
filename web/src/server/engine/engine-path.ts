// Resolution of the locally built engine used by POST /api/analyze (006-devarch-monorepo,
// contracts/engine-resolution.md). Pure functions: the route passes process.env, process.cwd() and fs.existsSync.
import path from 'node:path';
import type { Env } from '../config';

export type EngineResolution =
  | { kind: 'resolved'; javaBin: string; jarPath: string }
  | { kind: 'not-built'; jarPath: string; message: string };

/** Default location of the staged engine, relative to the web working directory (`make build` puts it there). */
export const DEFAULT_ENGINE_JAR = path.join('engine-dist', 'engine.jar');

/**
 * Resolves the engine archive and the Java executable.
 * - archive: ENGINE_JAR_PATH when set and not empty (relative paths resolve against cwd), else <cwd>/engine-dist/engine.jar
 * - java: $JAVA_HOME/bin/java when JAVA_HOME is set, else `java` from the PATH
 */
export function resolveEngine(
  env: Env,
  cwd: string,
  exists: (p: string) => boolean,
): EngineResolution {
  const override = env.ENGINE_JAR_PATH?.trim();
  const jarPath = override ? path.resolve(cwd, override) : path.join(cwd, DEFAULT_ENGINE_JAR);
  if (!exists(jarPath)) {
    return {
      kind: 'not-built',
      jarPath,
      message:
        `Engine not built: ${jarPath} was not found. ` +
        'Run `make build` from apps/dev-arch (or set ENGINE_JAR_PATH to an engine archive).',
    };
  }
  const javaHome = env.JAVA_HOME?.trim();
  const javaBin = javaHome ? path.join(javaHome, 'bin', 'java') : 'java';
  return { kind: 'resolved', javaBin, jarPath };
}

/** Command executed by /api/analyze, without a shell: every argument is passed as is (paths with spaces). */
export function buildEngineCommand(
  r: { javaBin: string; jarPath: string },
  projectRoot: string,
  outputFile = 'output.json',
): { file: string; args: string[] } {
  return { file: r.javaBin, args: ['-jar', r.jarPath, projectRoot, outputFile] };
}
