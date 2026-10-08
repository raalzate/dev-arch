// Job store on disk (007-native-engine-runtime, data-model.md). Run: npm test -w web
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isJobId, JobStore } from './job-store.ts';

function store(now = () => new Date('2026-10-08T10:00:00Z')) {
  return new JobStore(mkdtempSync(path.join(os.tmpdir(), 'devarch-store-')), now);
}

test('ids are random v4 UUIDs and invalid ids are rejected', async () => {
  const s = store();
  const a = await s.create({ origin: 'zip', language: 'auto' });
  const b = await s.create({ origin: 'zip', language: 'auto' });
  assert.ok(isJobId(a.id) && isJobId(b.id));
  assert.notEqual(a.id, b.id);
  for (const bad of ['../etc', '..%2F..%2Fetc', 'not-a-uuid', '00000000-0000-1000-8000-000000000000', '']) {
    assert.equal(isJobId(bad), false, bad);
    assert.equal(await s.get(bad), null);
    assert.throws(() => s.paths(bad));
  }
});

test('create persists a queued job with its area and timestamps', async () => {
  const s = store();
  const job = await s.create({ origin: 'zip', language: 'java', uploadBytes: 10 });
  const p = s.paths(job.id);
  assert.ok(existsSync(p.dir));
  const onDisk = JSON.parse(readFileSync(p.jobJson, 'utf8'));
  assert.equal(onDisk.status, 'queued');
  assert.equal(onDisk.phase, null);
  assert.equal(onDisk.language, 'java');
  assert.equal(onDisk.createdAt, '2026-10-08T10:00:00.000Z');
  assert.equal(onDisk.startedAt, null);
  assert.deepEqual(onDisk.warnings, []);
  assert.deepEqual(await s.get(job.id), onDisk);
});

test('updates are atomic (no temporary file left) and follow the allowed transitions', async () => {
  const s = store();
  const job = await s.create({ origin: 'zip', language: 'auto' });
  await s.update(job.id, { status: 'running', phase: 'detection' });
  await s.update(job.id, { phase: 'extraction' });
  await assert.rejects(() => s.update(job.id, { phase: 'detection' }), /phase/);
  await s.update(job.id, { status: 'completed', phase: 'writing' });
  await assert.rejects(() => s.update(job.id, { status: 'running' }), /transition/);
  assert.deepEqual(readdirSync(s.paths(job.id).dir).filter((f) => f.endsWith('.tmp')), []);
  const done = await s.get(job.id);
  assert.equal(done?.status, 'completed');
  assert.ok(done?.startedAt && done?.finishedAt);
});

test('imports are born completed; list and delete work on the data directory', async () => {
  const s = store();
  const imp = await s.create({ origin: 'import', language: 'auto', status: 'completed' });
  assert.equal(imp.status, 'completed');
  assert.ok(imp.finishedAt);
  const other = await s.create({ origin: 'zip', language: 'auto' });
  assert.deepEqual((await s.list()).map((j) => j.id).sort(), [imp.id, other.id].sort());
  await s.delete(imp.id);
  assert.equal(await s.get(imp.id), null);
  assert.equal(existsSync(s.paths(imp.id).dir), false);
});
