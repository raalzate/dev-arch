// GET /api/health core (012-install-doctor-docker, contracts/health-api.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  HEALTH_CHECKS, HEALTH_TTL_MS, doctorCliPath, health, nodeDoctorRunner, resetHealthCache, runHealthDoctor, toHealth,
  type DoctorReport,
} from './health.ts';

function report(status: 'OK' | 'WARN' | 'FAIL', jarFound = true): DoctorReport {
  return {
    tool: 'dev-arch doctor', version: '1.2.0', mode: 'local', platform: 'linux', status,
    checks: [
      { id: 'engine-jar', name: 'engine.jar', status, detected: jarFound ? '1.2.0' : 'not found', required: 'r', requiredFor: 'w', detail: 'jar', fix: [] },
      { id: 'dotnet-analyzer', name: 'dotnet-analyzer', status: 'OK', detected: '1.2.0', required: 'r', requiredFor: 'w', detail: 'an', fix: [] },
    ],
    engine: jarFound ? { version: '1.2.0', schema_version: '1.0.0' } : null,
  };
}

test('the doctor CLI is the product one unless DEVARCH_DOCTOR_CLI overrides it', () => {
  assert.equal(doctorCliPath({}, '/p/web'), path.resolve('/p/scripts/doctor/cli.mjs'));
  assert.equal(doctorCliPath({ DEVARCH_DOCTOR_CLI: ' x/cli.mjs ' }, '/p/web'), path.resolve('/p/web/x/cli.mjs'));
});

test('toHealth maps the report, the engine process and the HTTP status', () => {
  const ok = toHealth(report('WARN'), 12);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.service, 'dev-arch');
  assert.deepEqual(ok.body.engine, {
    jar: { found: true, version: '1.2.0', detail: 'jar' }, dotnetAnalyzer: { found: true, detail: 'an' }, mcpProcess: 'running',
  });
  const fail = toHealth(report('FAIL', false), null);
  assert.equal(fail.status, 503);
  assert.equal(fail.body.engine.jar.found, false);
  assert.equal(fail.body.engine.jar.version, null);
  assert.equal(fail.body.engine.mcpProcess, 'idle');
  const empty = toHealth({ ...report('OK'), checks: [] }, null);
  assert.equal(empty.body.engine.dotnetAnalyzer.found, false);
  assert.equal(empty.body.engine.dotnetAnalyzer.detail, '');
});

test('runHealthDoctor asks only for the runtime checks and turns a broken doctor into FAIL', async () => {
  const seen: string[][] = [];
  const good = await runHealthDoctor({
    env: {}, cwd: '/p/web',
    runDoctor: async (cli, args) => { seen.push([cli, ...args]); return { code: 0, stdout: JSON.stringify(report('OK')), stderr: '' }; },
  });
  assert.equal(good.status, 'OK');
  assert.deepEqual(seen[0].slice(1), ['--json', '--mode', 'local', '--only', HEALTH_CHECKS.join(',')]);
  const broken = await runHealthDoctor({ env: {}, cwd: '/p/web', runDoctor: async () => ({ code: 2, stdout: 'boom', stderr: ' crashed ' }) });
  assert.equal(broken.status, 'FAIL');
  assert.equal(broken.checks[0].id, 'doctor');
  assert.match(broken.checks[0].detail, /did not produce a report \(exit 2\): crashed/);
  const noChecks = await runHealthDoctor({ env: {}, cwd: '/p/web', runDoctor: async () => ({ code: 0, stdout: '{"status":"OK"}', stderr: '' }) });
  assert.equal(noChecks.status, 'FAIL');
});

test('health reuses the doctor report for HEALTH_TTL_MS but reads the engine process every time', async () => {
  resetHealthCache();
  let runs = 0;
  let clock = 0;
  let pid: number | null = null;
  const deps = {
    env: {}, cwd: '/p/web', now: () => clock, enginePid: () => pid,
    runDoctor: async () => { runs++; return { code: 0, stdout: JSON.stringify(report('OK')), stderr: '' }; },
  };
  assert.equal((await health(deps)).body.engine.mcpProcess, 'idle');
  pid = 7;
  clock = HEALTH_TTL_MS - 1;
  assert.equal((await health(deps)).body.engine.mcpProcess, 'running');
  assert.equal(runs, 1);
  clock = HEALTH_TTL_MS;
  await health(deps);
  assert.equal(runs, 2);
  resetHealthCache();
});

test('nodeDoctorRunner runs a CLI with the current Node and reports its exit code', async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'devarch-012-health-'));
  try {
    const cli = path.join(dir, 'cli.mjs');
    writeFileSync(cli, "process.stdout.write(JSON.stringify(process.argv.slice(2))); process.stderr.write('e'); process.exit(process.argv.includes('--fail') ? 1 : 0);");
    const ok = await nodeDoctorRunner(cli, ['--json']);
    assert.deepEqual([ok.code, JSON.parse(ok.stdout), ok.stderr], [0, ['--json'], 'e']);
    const failed = await nodeDoctorRunner(cli, ['--fail']);
    assert.equal(failed.code, 1);
    const missing = await nodeDoctorRunner(path.join(dir, 'missing.mjs'), []);
    assert.notEqual(missing.code, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
