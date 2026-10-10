// Unit tests of the doctor command, its output and the requirements definition (012-install-doctor-docker).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { USAGE, main, parseArgs } from './doctor.mjs';
import { formatFix, formatHuman } from './format.mjs';
import { HINT_KEYS, REQUIREMENTS, TABLE_END, TABLE_START, requirement, requirementsTable } from './requirements.mjs';
import { PRODUCT_ROOT, exec, realSystem } from './system.mjs';
import { state, system } from './testing.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

describe('arguments', () => {
  it('accepts the documented options and the optional "doctor" command', () => {
    assert.deepEqual(parseArgs(['doctor', '--json', '--fix', '--mode', 'docker', '--only', 'docker,env']),
      { mode: 'docker', json: true, fix: true, only: ['docker', 'env'], table: false, help: false });
    assert.equal(parseArgs(['--mode=local']).mode, 'local');
    assert.deepEqual(parseArgs(['--only=jdk']).only, ['jdk']);
    assert.equal(parseArgs(['--requirements-table']).table, true);
    assert.equal(parseArgs(['-h']).help, true);
  });

  it('rejects unknown options, modes and checks', () => {
    assert.throws(() => parseArgs(['--verbose']), /unknown argument/);
    assert.throws(() => parseArgs(['--mode', 'cloud']), /invalid --mode/);
    assert.throws(() => parseArgs(['--only', 'jdk,nope']), /unknown check: nope/);
  });
});

describe('command', () => {
  it('prints the human table with the result and a --fix reminder', async () => {
    const s = state('darwin');
    s.java = null;
    const r = await main([], system(s));
    assert.equal(r.code, 1);
    assert.match(r.stdout, /^dev-arch doctor 1\.2\.0 — mode local \(darwin\)/);
    assert.match(r.stdout, /STATUS\s+CHECK\s+DETECTED\s+REQUIRED\s+DETAIL/);
    assert.match(r.stdout, /Result: FAIL \(11 OK, 0 WARN, 1 FAIL\)/);
    assert.match(r.stdout, /Run with --fix/);
  });

  it('shows the install commands with --fix and never runs them', async () => {
    const s = state('win32');
    s.java = null;
    const r = await main(['--fix'], system(s));
    assert.match(r.stdout, /Suggested commands \(not executed\):/);
    assert.match(r.stdout, /winget install EclipseAdoptium\.Temurin\.17\.JDK/);
    assert.ok(s.calls.every((c) => !/\binstall\b/.test(c.join(' '))));
    const ok = await main(['--fix'], system(state()));
    assert.match(ok.stdout, /Nothing to fix\./);
    assert.doesNotMatch(ok.stdout, /Run with --fix/);
  });

  it('prints the JSON report and exits 0 without failures', async () => {
    const r = await main(['--json'], system(state()));
    assert.equal(r.code, 0);
    const report = JSON.parse(r.stdout);
    assert.deepEqual(Object.keys(report), ['tool', 'version', 'mode', 'platform', 'status', 'checks', 'engine']);
    assert.deepEqual(Object.keys(report.checks[0]), ['id', 'name', 'status', 'detected', 'required', 'requiredFor', 'detail', 'fix']);
  });

  it('answers usage errors with 64, --help and --requirements-table', async () => {
    const bad = await main(['--mode', 'x'], system(state()));
    assert.equal(bad.code, 64);
    assert.ok(bad.stderr.includes(USAGE));
    for (const o of ['--mode', '--json', '--fix', '--only']) assert.ok(USAGE.includes(o));
    assert.equal((await main(['--help'], system(state()))).stdout, `${USAGE}\n`);
    assert.equal((await main(['--requirements-table'], system(state()))).stdout, `${requirementsTable()}\n`);
  });
});

describe('format', () => {
  it('colors the status only when asked', async () => {
    const report = JSON.parse((await main(['--json'], system(state()))).stdout);
    assert.match(formatHuman(report, true), /\u001b\[32mOK/);
    assert.doesNotMatch(formatHuman(report, false), /\u001b\[/);
    report.checks[0].fix = [];
    report.checks[0].status = 'WARN';
    assert.match(formatFix(report), /see docs\/INSTALL\.md/);
  });
});

describe('requirements definition', () => {
  it('is complete for every platform it applies to', () => {
    assert.equal(REQUIREMENTS.length, 12);
    for (const r of REQUIREMENTS) {
      const keys = r.platforms ? ['winget', 'choco'] : HINT_KEYS;
      for (const k of keys) assert.ok(r.hints[k], `${r.id} ${k}`);
    }
    assert.throws(() => requirement('nope'), /unknown requirement/);
  });

  it('generates the table of docs/INSTALL.md', () => {
    const table = requirementsTable();
    assert.equal(table.split('\n').length, 14);
    assert.match(table, /\| VS Build Tools \/ MSBuild \|.*\| local \(Windows only\) \|/);
    const guide = readFileSync(path.join(HERE, '..', '..', 'docs', 'INSTALL.md'), 'utf8');
    const inGuide = guide.slice(guide.indexOf(TABLE_START) + TABLE_START.length, guide.indexOf(TABLE_END)).trim();
    assert.equal(inGuide, table);
  });
});

describe('real system', () => {
  it('locates the product root and probes this machine', async () => {
    assert.equal(PRODUCT_ROOT, path.resolve(HERE, '..', '..'));
    const sys = realSystem();
    assert.equal(sys.readFile(path.join(PRODUCT_ROOT, 'VERSION')).trim(), readFileSync(path.join(PRODUCT_ROOT, 'VERSION'), 'utf8').trim());
    assert.equal(sys.readFile('/definitely/missing'), null);
    assert.ok(sys.totalmem() > 0);
    assert.ok(sys.freeDisk(sys.tmpdir) > 0);
    assert.equal(sys.freeDisk('/definitely/missing'), null);
    assert.equal(await exec('definitely-not-a-command-012', []), null);
    const node = await exec(process.execPath, ['-e', 'process.stdout.write("x"); process.exit(3)']);
    assert.deepEqual([node.code, node.stdout], [3, 'x']);
    assert.equal(typeof (await sys.portFree(0)), 'boolean');
    assert.equal(await sys.fetchHealth(1), null);
  });

  it('runs as a command with the documented exit codes', () => {
    const cli = path.join(HERE, 'cli.mjs');
    const usage = spawnSync(process.execPath, [cli, '--bogus'], { encoding: 'utf8' });
    assert.equal(usage.status, 64);
    const table = spawnSync(process.execPath, [cli, 'doctor', '--requirements-table'], { encoding: 'utf8' });
    assert.equal(table.status, 0);
    assert.equal(table.stdout, `${requirementsTable()}\n`);
  });
});
