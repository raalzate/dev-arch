// Source viewer sandbox (007, research D10; FR-017, FR-018, SC-006). Run: npm test -w web
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ApiError } from '../api-error.ts';
import { DEFAULT_SOURCE_EXTENSIONS } from '../config.ts';
import { readSource } from './source-sandbox.ts';

function project() {
  const base = mkdtempSync(path.join(os.tmpdir(), 'devarch-src-'));
  const root = path.join(base, 'job', 'source', 'demo');
  mkdirSync(path.join(root, 'src', 'pkg'), { recursive: true });
  mkdirSync(path.join(root, 'lib'));
  writeFileSync(path.join(root, 'src', 'App.java'), 'class App {}\n');
  writeFileSync(path.join(root, 'pom.xml'), '<project/>');
  writeFileSync(path.join(root, '.env'), 'SECRET=1');
  writeFileSync(path.join(root, 'lib', 'app.jar'), 'PK');
  writeFileSync(path.join(root, 'src', 'Big.java'), 'x'.repeat(2048));
  writeFileSync(path.join(base, 'outside.java'), 'class Outside {}');
  symlinkSync(path.join(base, 'outside.java'), path.join(root, 'src', 'link-out.java'));
  const other = path.join(base, 'other', 'source', 'demo');
  mkdirSync(path.join(other, 'src'), { recursive: true });
  writeFileSync(path.join(other, 'src', 'Other.java'), 'class Other {}');
  return { root, limits: { maxSourceViewBytes: 1024, sourceExtensions: DEFAULT_SOURCE_EXTENSIONS } };
}

async function rejects(p: Promise<unknown>, status: number, code: string) {
  await assert.rejects(p, (e: unknown) => e instanceof ApiError && e.status === status && e.code === code || assert.fail(`${String(e)} ${(e as ApiError).code}`));
}

test('a file inside the project root is served by its relative path', async () => {
  const { root, limits } = project();
  assert.deepEqual(await readSource(root, 'src/App.java', limits), { path: 'src/App.java', content: 'class App {}\n' });
});

test('absolute, traversal, encoded, backslash, NUL and drive paths are INVALID_PATH', async () => {
  const { root, limits } = project();
  for (const p of ['', '/etc/passwd', '../../../../etc/passwd', '%2e%2e/%2e%2e/etc/passwd', 'src\\..\\..\\pom.xml',
    'src/App.java%00.txt', 'src/App.java\0.txt', 'C:/Windows/win.ini', 'src/../../x.java', '%252e%252e/x']) {
    await rejects(readSource(root, p, limits), 400, 'INVALID_PATH');
  }
});

test('symbolic links leaving the root, other projects, directories and missing files are a uniform 404', async () => {
  const { root, limits } = project();
  for (const p of ['src/link-out.java', 'src/Other.java', 'src/pkg', 'src/Missing.java']) {
    await rejects(readSource(root, p, limits), 404, 'NOT_FOUND');
  }
});

test('extensions outside the allowlist and oversized files are rejected', async () => {
  const { root, limits } = project();
  await rejects(readSource(root, '.env', limits), 400, 'EXTENSION_NOT_ALLOWED');
  await rejects(readSource(root, 'lib/app.jar', limits), 400, 'EXTENSION_NOT_ALLOWED');
  await rejects(readSource(root, 'src/Big.java', limits), 413, 'FILE_TOO_LARGE');
});
