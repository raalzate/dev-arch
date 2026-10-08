// Periodic cleanup of expired analyses (007, research D7; FR-012, SC-011). Run: npm test -w web
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, utimesSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cleanupExpired } from './cleaner.ts';
import { JobStore } from './job-store.ts';

const HOUR = 3600_000;

test('terminal analyses older than the retention are removed; active and recent ones stay', async () => {
  const now = new Date('2026-10-08T12:00:00Z');
  const store = new JobStore(mkdtempSync(path.join(os.tmpdir(), 'devarch-clean-')), () => now);
  const ago = (h: number) => new Date(now.getTime() - h * HOUR).toISOString();
  const oldDone = await store.create({ origin: 'zip', language: 'auto', status: 'completed', finishedAt: ago(2) });
  const oldFailed = await store.create({ origin: 'zip', language: 'auto', status: 'failed', finishedAt: ago(2) });
  const oldImport = await store.create({ origin: 'import', language: 'auto', status: 'completed', finishedAt: ago(3) });
  const recent = await store.create({ origin: 'zip', language: 'auto', status: 'completed', finishedAt: ago(0.5) });
  const running = await store.create({ origin: 'zip', language: 'auto', status: 'running', startedAt: ago(5) });
  const queued = await store.create({ origin: 'zip', language: 'auto' });
  const removed = await cleanupExpired(store, 1, now);
  assert.deepEqual(removed.sort(), [oldDone.id, oldFailed.id, oldImport.id].sort());
  for (const j of [oldDone, oldFailed, oldImport]) assert.equal(existsSync(store.paths(j.id).dir), false);
  for (const j of [recent, running, queued]) assert.ok(existsSync(store.paths(j.id).dir));
});

test('a clock set backwards never removes anything active and only delays expiry', async () => {
  const now = new Date('2026-10-08T12:00:00Z');
  const store = new JobStore(mkdtempSync(path.join(os.tmpdir(), 'devarch-clean-')), () => now);
  const done = await store.create({ origin: 'zip', language: 'auto', status: 'completed', finishedAt: now.toISOString() });
  assert.deepEqual(await cleanupExpired(store, 1, new Date(now.getTime() - 10 * HOUR)), []);
  assert.ok(existsSync(store.paths(done.id).dir));
});

test('orphan directories without job.json are removed after one hour', async () => {
  const now = new Date();
  const store = new JobStore(mkdtempSync(path.join(os.tmpdir(), 'devarch-clean-')), () => now);
  const oldOrphan = path.join(store.jobsDir, '11111111-1111-4111-8111-111111111111');
  const newOrphan = path.join(store.jobsDir, '22222222-2222-4222-8222-222222222222');
  mkdirSync(oldOrphan, { recursive: true });
  mkdirSync(newOrphan, { recursive: true });
  const twoHoursAgo = new Date(now.getTime() - 2 * HOUR);
  utimesSync(oldOrphan, twoHoursAgo, twoHoursAgo);
  await cleanupExpired(store, 24, now);
  assert.equal(existsSync(oldOrphan), false);
  assert.ok(existsSync(newOrphan));
});
