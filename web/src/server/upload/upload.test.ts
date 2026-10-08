// Safe upload: streaming with limits, ZIP validation and counted extraction (007, research D8, FR-013..FR-016, FR-037).
// Run: npm test -w web
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import { buildZip, lyingZip, zipOfBytes, zipWithEntries, zipWithSize } from '../../../../tests/acceptance/support/zip-catalog.ts';
import { streamToFile } from './stream-to-file.ts';
import { extractZip, inspectZip } from './safe-extract.ts';
import { findProjectRoot } from './project-root.ts';
import { ApiError } from '../api-error.ts';

const tmp = () => mkdtempSync(path.join(os.tmpdir(), 'devarch-upload-'));
const limits = { maxUncompressedBytes: 10 * 1024 * 1024, maxZipEntries: 100 };
const enospc = () => Object.assign(new Error('ENOSPC: no space left on device, write'), { code: 'ENOSPC' });

function webStream(buf: Buffer, chunk = 64 * 1024): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream({
    pull(c) {
      if (i >= buf.length) return c.close();
      c.enqueue(new Uint8Array(buf.subarray(i, i + chunk)));
      i += chunk;
    },
  });
}

function zipFile(buf: Buffer): string {
  const f = path.join(tmp(), 'upload.zip');
  writeFileSync(f, buf);
  return f;
}

async function rejects(fn: () => unknown, status: number, code: string, extra: Record<string, unknown> = {}) {
  await assert.rejects(async () => fn(), (e: unknown) => {
    assert.ok(e instanceof ApiError, String(e));
    assert.equal(e.status, status);
    assert.equal(e.code, code);
    for (const [k, v] of Object.entries(extra)) assert.deepEqual(e.extra[k], v, k);
    return true;
  });
}

test('the body is streamed to disk counting bytes and cut at the limit without leftovers', async () => {
  const dest = path.join(tmp(), 'upload.zip');
  const data = zipOfBytes(0.5);
  assert.equal(await streamToFile(webStream(data), dest, 1024 * 1024), data.length);
  assert.deepEqual(readFileSync(dest), data);
  const big = path.join(tmp(), 'upload.zip');
  await rejects(() => streamToFile(webStream(zipOfBytes(2)), big, 1024 * 1024), 413, 'UPLOAD_TOO_LARGE', { limitBytes: 1024 * 1024 });
  assert.equal(existsSync(big), false);
});

test('a declared Content-Length above the limit is rejected before reading', async () => {
  let pulled = false;
  const body = new ReadableStream({ pull() { pulled = true; } }, { highWaterMark: 0 });
  await rejects(() => streamToFile(body, path.join(tmp(), 'u.zip'), 10, 11), 413, 'UPLOAD_TOO_LARGE');
  assert.equal(pulled, false);
});

test('a full disk while storing the upload is STORAGE_FULL and leaves nothing', async () => {
  const dir = tmp();
  const dest = path.join(dir, 'upload.zip');
  await rejects(() => streamToFile(webStream(zipOfBytes(0.2)), dest, 1024 * 1024, undefined, { createWriteStream: (p: string) => { writeFileSync(p, ''); return new Writable({ write(_c, _e, cb) { cb(enospc()); } }); } }), 507, 'STORAGE_FULL');
  assert.deepEqual(readdirSync(dir), []);
});

test('entries escaping the extraction area are rejected naming the entry', () => {
  for (const entry of ['../../evil.txt', 'a/../../evil.txt', '/tmp/evil.txt', 'C:/evil.txt', 'dir\\..\\..\\evil.txt', 'src/\0x.java']) {
    assert.throws(() => inspectZip(zipFile(zipWithEntries(['src/App.java', entry])), limits),
      (e: ApiError) => e.code === 'ZIP_ENTRY_OUTSIDE_ROOT' && e.status === 400 && e.extra.entry === entry, entry);
  }
  assert.throws(() => inspectZip(zipFile(zipWithEntries(['src/App.java', 'link-to-etc (symlink)'])), limits),
    (e: ApiError) => e.code === 'ZIP_SYMLINK' && e.extra.entry === 'link-to-etc');
});

test('duplicates and case collisions are rejected deterministically', () => {
  for (const [a, b] of [['src/App.java', 'src/App.java'], ['src/App.java', 'src/app.java']]) {
    assert.throws(() => inspectZip(zipFile(zipWithEntries([a, b])), limits),
      (e: ApiError) => e.code === 'ZIP_DUPLICATE_ENTRY' && e.status === 400 && e.extra.entry === b);
  }
});

test('declared uncompressed size and number of entries are bounded', () => {
  assert.throws(() => inspectZip(zipFile(zipWithSize(5, 20)), limits),
    (e: ApiError) => e.status === 413 && e.code === 'UNCOMPRESSED_TOO_LARGE' && e.extra.limitBytes === limits.maxUncompressedBytes);
  assert.throws(() => inspectZip(zipFile(zipWithSize(150, 1)), limits),
    (e: ApiError) => e.status === 400 && e.code === 'ZIP_TOO_MANY_ENTRIES' && e.extra.limit === 100);
});

test('a file that is not a ZIP is INVALID_ZIP', () => {
  const f = path.join(tmp(), 'upload.zip');
  writeFileSync(f, 'just some text, not a zip');
  assert.throws(() => inspectZip(f, limits), (e: ApiError) => e.status === 400 && e.code === 'INVALID_ZIP');
});

test('extraction writes every entry, counting real bytes against the limit', async () => {
  const dest = path.join(tmp(), 'source');
  const zip = zipFile(zipWithEntries(['demo/pom.xml', 'demo/src/App.java', 'demo/src/Ñandú café.java']));
  inspectZip(zip, limits);
  await extractZip(zip, dest, limits);
  assert.ok(readFileSync(path.join(dest, 'demo/src/App.java'), 'utf8').includes('class App'));
  assert.ok(existsSync(path.join(dest, 'demo/src/Ñandú café.java')));
  assert.equal(findProjectRoot(dest), path.join(dest, 'demo'));
  const lying = zipFile(lyingZip(1, 20));
  inspectZip(lying, limits); // the declared sizes look fine
  await rejects(() => extractZip(lying, path.join(tmp(), 'source'), limits), 413, 'UNCOMPRESSED_TOO_LARGE');
});

test('a full disk during extraction is STORAGE_FULL', async () => {
  const zip = zipFile(zipWithEntries(['demo/pom.xml', 'demo/src/App.java']));
  await rejects(() => extractZip(zip, path.join(tmp(), 'source'), limits, { writeFile: async () => { throw enospc(); } }), 507, 'STORAGE_FULL');
});

test('the project root is the single top-level folder, else the extraction folder', () => {
  const a = tmp();
  mkdirSync(path.join(a, 'only'));
  assert.equal(findProjectRoot(a), path.join(a, 'only'));
  const b = tmp();
  writeFileSync(path.join(b, 'pom.xml'), '');
  mkdirSync(path.join(b, 'src'));
  assert.equal(findProjectRoot(b), b);
  const c = tmp();
  writeFileSync(path.join(c, 'single-file.java'), '');
  assert.equal(findProjectRoot(c), c);
  assert.equal(buildZip([]).length > 0, true);
});
