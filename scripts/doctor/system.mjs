// Real system probes of the doctor (012-install-doctor-docker). Kept thin: all decisions live in checks.mjs.
import { execFile } from 'node:child_process';
import { existsSync, readFileSync, statfsSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Product root (the repository root): two levels above scripts/doctor/. */
export const PRODUCT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const EXEC_TIMEOUT_MS = 60_000;

/** Runs a command without a shell (a shell only for Windows .cmd shims); null when it cannot be started. */
export function exec(file, args) {
  return new Promise((resolve) => {
    const shell = process.platform === 'win32' && /\.cmd$/i.test(file);
    execFile(file, args, { timeout: EXEC_TIMEOUT_MS, windowsHide: true, shell, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err && (err.code === 'ENOENT' || err.code === 'EACCES')) return resolve(null);
      const code = err ? (typeof err.code === 'number' ? err.code : 1) : 0;
      resolve({ code, stdout: String(stdout), stderr: String(stderr) });
    });
  });
}

function readFile(p) {
  try {
    return readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

function freeDisk(dir) {
  try {
    const s = statfsSync(dir);
    return Number(s.bavail) * Number(s.bsize);
  } catch {
    return null;
  }
}

function portFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, '0.0.0.0');
  });
}

async function fetchHealth(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(5000) });
    return await res.json();
  } catch {
    return null;
  }
}

/** The real system seen by the checks. */
export function realSystem(overrides = {}) {
  return {
    platform: process.platform,
    env: process.env,
    productRoot: PRODUCT_ROOT,
    nodeVersion: process.version,
    exec,
    exists: existsSync,
    readFile,
    totalmem: os.totalmem,
    freeDisk,
    tmpdir: os.tmpdir(),
    portFree,
    fetchHealth,
    ...overrides,
  };
}
