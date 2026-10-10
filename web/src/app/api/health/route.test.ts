// GET /api/health route (012-install-doctor-docker): a fake doctor CLI through DEVARCH_DOCTOR_CLI.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resetHealthCache } from '../../../server/health/health.ts';
import { GET, dynamic, runtime } from './route.ts';

test('GET /api/health answers the doctor report with the engine state, never cached', async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'devarch-012-route-'));
  const saved = process.env.DEVARCH_DOCTOR_CLI;
  try {
    const cli = path.join(dir, 'cli.mjs');
    writeFileSync(cli, "process.stdout.write(JSON.stringify({ tool: 'dev-arch doctor', version: '1.2.0', mode: 'local', platform: 'linux', status: 'FAIL', checks: [], engine: null }));");
    process.env.DEVARCH_DOCTOR_CLI = cli;
    resetHealthCache();
    const res = await GET();
    assert.equal(res.status, 503);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const body = await res.json();
    assert.equal(body.service, 'dev-arch');
    assert.equal(body.engine.mcpProcess, 'idle');
    assert.equal(runtime, 'nodejs');
    assert.equal(dynamic, 'force-dynamic');
  } finally {
    if (saved === undefined) delete process.env.DEVARCH_DOCTOR_CLI;
    else process.env.DEVARCH_DOCTOR_CLI = saved;
    resetHealthCache();
    rmSync(dir, { recursive: true, force: true });
  }
});
