// Process helpers: run product commands with a controlled environment and capture exit code and output.
import { spawn, spawnSync } from 'node:child_process';

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
  /** stdout + stderr in arrival order is not guaranteed; both concatenated. */
  output: string;
  elapsedMs: number;
}

export interface RunOptions {
  cwd: string;
  env?: NodeJS.ProcessEnv;
  /** Replace the environment instead of extending process.env. */
  replaceEnv?: boolean;
  timeoutMs?: number;
  input?: string;
}

/** Environment of nested product commands: marks them as running inside the acceptance suite. */
export function childEnv(extra: NodeJS.ProcessEnv = {}, replace = false): NodeJS.ProcessEnv {
  const base = replace ? {} : { ...process.env };
  return { ...base, DEVARCH_TEST_RUNNING: '1', ...extra };
}

export function run(file: string, args: string[], opts: RunOptions): RunResult {
  const started = Date.now();
  const res = spawnSync(file, args, {
    cwd: opts.cwd,
    env: childEnv(opts.env ?? {}, opts.replaceEnv ?? false),
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    timeout: opts.timeoutMs ?? 10 * 60 * 1000,
    input: opts.input,
  });
  const stdout = res.stdout ?? '';
  const stderr = (res.stderr ?? '') + (res.error ? `\n${res.error.message}` : '');
  return {
    code: res.status ?? (res.signal ? 128 : 1),
    stdout,
    stderr,
    output: `${stdout}\n${stderr}`,
    elapsedMs: Date.now() - started,
  };
}

/** Runs a shell-free command and fails with its output when the exit code is not 0. */
export function runOk(file: string, args: string[], opts: RunOptions): RunResult {
  const res = run(file, args, opts);
  if (res.code !== 0) {
    throw new Error(`${file} ${args.join(' ')} exited ${res.code} in ${opts.cwd}:\n${res.output.slice(-4000)}`);
  }
  return res;
}

export interface Background {
  stop(): Promise<void>;
  output(): string;
  exited(): number | null;
}

/** Starts a long-running process (dev server) in its own process group. */
export function start(file: string, args: string[], opts: RunOptions): Background {
  const child = spawn(file, args, {
    cwd: opts.cwd,
    env: childEnv(opts.env ?? {}, opts.replaceEnv ?? false),
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  let exitCode: number | null = null;
  child.stdout.on('data', (d) => (out += d.toString()));
  child.stderr.on('data', (d) => (out += d.toString()));
  child.on('exit', (code) => (exitCode = code ?? 1));
  return {
    output: () => out,
    exited: () => exitCode,
    stop: async () => {
      if (exitCode !== null || child.pid === undefined) return;
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        /* already gone */
      }
      const deadline = Date.now() + 10_000;
      while (exitCode === null && Date.now() < deadline) await new Promise((r) => setTimeout(r, 200));
      if (exitCode === null) {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch {
          /* already gone */
        }
      }
    },
  };
}
