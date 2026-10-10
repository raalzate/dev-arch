// HTTP helpers of the analyses API routes (contracts/analyses-api.md; FR-016).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from './api-error.ts';
import { apiError, logRejection, NO_STORE, notFound, SECURITY_CODES } from './http.ts';

test('apiError renders {"error": {code, message, ...extra}} with no-store and extra headers', async () => {
  const res = apiError(429, 'TOO_MANY_ANALYSES', 'Retry later.', { limit: 3 }, { 'Retry-After': '30' });
  assert.equal(res.status, 429);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal(res.headers.get('retry-after'), '30');
  assert.deepEqual(await res.json(), { error: { code: 'TOO_MANY_ANALYSES', message: 'Retry later.', limit: 3 } });
});

test('extra headers can override the default cache header', () => {
  const res = apiError(400, 'X', 'm', {}, { 'Cache-Control': 'private' });
  assert.equal(res.headers.get('cache-control'), 'private');
  assert.deepEqual(NO_STORE, { 'Cache-Control': 'no-store' });
});

test('notFound is the same 404 for every missing analysis', async () => {
  const res = notFound();
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: { code: 'NOT_FOUND', message: 'The analysis does not exist or has expired.' } });
});

function captureWarn(fn: () => void): string[] {
  const lines: string[] = [];
  const saved = console.warn;
  console.warn = (...a: unknown[]) => void lines.push(a.map(String).join(' '));
  try {
    fn();
  } finally {
    console.warn = saved;
  }
  return lines;
}

test('security rejections are logged with the code and the entry name, never the contents', () => {
  const lines = captureWarn(() => logRejection(new ApiError(400, 'ZIP_ENTRY_OUTSIDE_ROOT', 'escapes', { entry: '../evil' }), 'upload'));
  assert.deepEqual(lines, ['[security] upload rejected: ZIP_ENTRY_OUTSIDE_ROOT entry="../evil"']);
  const noEntry = captureWarn(() => logRejection(new ApiError(413, 'UPLOAD_TOO_LARGE', 'big', { limitBytes: 5 }), 'synchronous upload'));
  assert.deepEqual(noEntry, ['[security] synchronous upload rejected: UPLOAD_TOO_LARGE']);
});

test('other errors are not logged as security rejections', () => {
  assert.equal(SECURITY_CODES.has('INVALID_LANGUAGE'), false);
  assert.deepEqual(captureWarn(() => logRejection(new ApiError(400, 'INVALID_LANGUAGE', 'x'), 'upload')), []);
});
