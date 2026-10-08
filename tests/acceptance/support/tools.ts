// Tool fixtures for prerequisite and orchestration scenarios: fake executables on a temporary PATH and
// recording shims that log their invocation instead of running the real tool.
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run } from './process.ts';

export function tempDir(prefix: string): string {
  return mkdtempSync(path.join(os.tmpdir(), `devarch-006-${prefix}-`));
}

export function which(tool: string): string | null {
  const res = run('bash', ['-c', `command -v ${tool}`], { cwd: os.tmpdir() });
  return res.code === 0 ? res.stdout.trim() : null;
}

export function writeExecutable(file: string, body: string): string {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `#!/usr/bin/env bash\n${body}\n`);
  chmodSync(file, 0o755);
  return file;
}

/** A fake JDK home whose java reports the given major version. */
export function fakeJdk(major: string): string {
  const home = tempDir(`jdk${major}`);
  writeExecutable(
    path.join(home, 'bin', 'java'),
    `echo 'openjdk version "${major}" 2025-09-16' >&2\necho 'OpenJDK Runtime Environment (build ${major}+36)' >&2`,
  );
  return home;
}

/** Major version of a java executable. */
export function javaMajor(javaBin: string): string {
  const out = run(javaBin, ['-version'], { cwd: os.tmpdir() }).output;
  const m = /version "(\d+)(?:\.(\d+))?/.exec(out);
  if (!m) return '';
  return m[1] === '1' ? (m[2] ?? '') : m[1];
}

/** A JDK 17 home: JAVA_HOME when it is a 17, else the macOS java_home lookup. */
export function jdk17Home(): string | null {
  const env = process.env.JAVA_HOME;
  if (env && existsSync(path.join(env, 'bin', 'java')) && javaMajor(path.join(env, 'bin', 'java')) === '17') return env;
  if (existsSync('/usr/libexec/java_home')) {
    const res = run('/usr/libexec/java_home', ['-v', '17'], { cwd: os.tmpdir() });
    if (res.code === 0 && javaMajor(path.join(res.stdout.trim(), 'bin', 'java')) === '17') return res.stdout.trim();
  }
  return null;
}

/**
 * Directory of recording shims: each shim appends "<tool> <args>" (and the JAVA_HOME it saw) to log and exits 0;
 * version and listing queries are forwarded to the real tool so prerequisite checks still see real versions.
 */
export function recordingShims(tools: string[]): { dir: string; log: string; lines: () => string[] } {
  const dir = tempDir('shims');
  const log = path.join(dir, 'invocations.log');
  writeFileSync(log, '');
  for (const tool of tools) {
    const real = which(tool);
    const passthrough = real
      ? `case "\${1:-}" in --version|-version|-v|--list-sdks|--list-runtimes|--info) exec "${real}" "$@";; esac\n`
      : '';
    writeExecutable(
      path.join(dir, tool),
      `${passthrough}printf '%s %s | JAVA_HOME=%s\\n' "${tool}" "$*" "\${JAVA_HOME:-}" >> "${log}"\nexit 0`,
    );
  }
  return {
    dir,
    log,
    lines: () => readFileSync(log, 'utf8').split('\n').filter(Boolean),
  };
}
