// History of analyses (010-modernization-ux FR-036). Run: npm test -w web
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from '../config.ts';
import { historyEntries } from './history.ts';
import { JobStore } from './job-store.ts';

const FIXTURES = path.resolve(__dirname, '..', '..', '..', '..', 'schema', 'fixtures', 'valid');

test('entries are newest first, carry the detected technology of completed analyses and no server paths', async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'devarch-history-'));
  let t = Date.parse('2026-10-09T10:00:00Z');
  const store = new JobStore(dir, () => new Date((t += 1000)));
  const config = loadConfig({ ARCHVIEW_DATA_DIR: dir }, dir);
  const a = await store.create({ origin: 'import', language: 'auto', status: 'completed' });
  const b = await store.create({ origin: 'zip', language: 'dotnet', status: 'completed' });
  const c = await store.create({ origin: 'zip', language: 'java' });
  for (const [job, fx] of [[a, 'java-standar'], [b, 'dotnet-ecommerce']] as const) {
    mkdirSync(store.paths(job.id).out, { recursive: true });
    copyFileSync(path.join(FIXTURES, fx, 'output.json'), path.join(store.paths(job.id).out, 'output.json'));
  }
  const cache = new Map();
  const list = await historyEntries(store, config, cache);
  assert.deepEqual(list.map((e) => e.jobId), [c.id, b.id, a.id]);
  assert.deepEqual(list.map((e) => e.technology), [null, 'csharp', 'java']);
  assert.deepEqual(list.map((e) => e.technologyLabel), [null, '.NET · C#', 'Java']);
  assert.ok(!JSON.stringify(list).includes(dir));
  assert.equal(cache.size, 2);
});
