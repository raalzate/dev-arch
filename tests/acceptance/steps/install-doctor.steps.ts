// 012-install-doctor-docker — US1/US2 (the doctor). Simulated systems drive the pure checks of
// scripts/doctor/checks.mjs per operating system; "on this machine" steps run the real CLI entry points.
import { Given, Then, When } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
// @ts-expect-error plain ESM module of the product (no type declarations)
import { runDoctor } from '../../../scripts/doctor/checks.mjs';
// @ts-expect-error plain ESM module of the product (no type declarations)
import { main } from '../../../scripts/doctor/doctor.mjs';
// @ts-expect-error plain ESM module of the product (no type declarations)
import { formatHuman } from '../../../scripts/doctor/format.mjs';
// @ts-expect-error plain ESM module of the product (no type declarations)
import { REQUIREMENTS } from '../../../scripts/doctor/requirements.mjs';
import { layout } from '../support/layout.ts';
import { run } from '../support/process.ts';
import type { DevArchWorld } from '../support/world.ts';

export type Check = { id: string; name: string; status: string; detected: string; required: string; requiredFor: string; detail: string; fix: string[] };
export type Report = { tool: string; version: string; mode: string; platform: string; status: string; checks: Check[]; engine: Record<string, unknown> | null };
type ExecResult = { code: number; stdout: string; stderr: string } | null;
type Requirement = { id: string; name: string; requiredFor: string; minimum: string; detection: string; modes: string[]; platforms?: string[]; hints: Record<string, string> };

const ROOT = '/sim/dev-arch';
const JAR = path.join(ROOT, 'web', 'engine-dist', 'engine.jar');
const ANALYZER_DIR = '/opt/analyzer';
const VSWHERE = path.win32.join('C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
const GIB = 1024 ** 3;

/** Simulated system state; every requirement is satisfied by default. */
export interface Sim {
  platform: string;
  env: Record<string, string | undefined>;
  java: string | null;
  mvn: string | null;
  sdks: string[];
  runtimes: string[];
  node: string;
  npm: string | null;
  jar: 'ok' | 'other-version' | 'silent' | 'absent';
  engineAnalyzer: string | null;
  analyzerVersion: string;
  vswhere: boolean;
  docker: 'ok' | 'absent' | 'daemon-down';
  portFree: boolean;
  health: Record<string, unknown> | null;
  ram: number;
  disk: number;
  extraFiles: Set<string>;
  calls: string[][];
}

export function simulated(platform: string): Sim {
  return {
    platform,
    env: { PATH: '/usr/bin', GEMINI_API_KEY: 'k', DOTNET_ANALYZER_PATH: ANALYZER_DIR },
    java: '17.0.9',
    mvn: '3.9.6',
    sdks: ['8.0.100'],
    runtimes: ['8.0.10'],
    node: 'v20.11.0',
    npm: '10.8.2',
    jar: 'ok',
    engineAnalyzer: path.join(ANALYZER_DIR, 'dotnet-analyzer'),
    analyzerVersion: '1.2.0',
    vswhere: true,
    docker: 'ok',
    portFree: true,
    health: null,
    ram: 16 * GIB,
    disk: 50 * GIB,
    extraFiles: new Set(),
    calls: [],
  };
}

const bare = (file: string) => path.basename(file.replace(/\\/g, '/')).replace(/\.(exe|cmd)$/i, '');

/** The `sys` object of scripts/doctor/checks.mjs for a simulated state. */
export function systemOf(sim: Sim) {
  const files = new Set<string>([...sim.extraFiles]);
  if (sim.jar !== 'absent') files.add(JAR);
  if (sim.engineAnalyzer) files.add(sim.engineAnalyzer);
  if (sim.env.DOTNET_ANALYZER_PATH) files.add(path.join(sim.env.DOTNET_ANALYZER_PATH, 'dotnet-analyzer'));
  if (sim.vswhere) files.add(VSWHERE);
  const ok = (stdout: string, stderr = ''): ExecResult => ({ code: 0, stdout, stderr });
  const exec = async (file: string, args: string[]): Promise<ExecResult> => {
    sim.calls.push([file, ...args]);
    const name = bare(file);
    if (name === 'java' && args[0] === '-jar') {
      if (sim.jar === 'silent') return { code: 1, stdout: '', stderr: 'Usage: java MicroserviceInferenceMain' };
      const version = sim.jar === 'other-version' ? '1.1.0' : '1.2.0';
      const analyzer = sim.engineAnalyzer ? { found: true, path: sim.engineAnalyzer } : { found: false, path: null };
      return ok(`${JSON.stringify({ engine: 'static-inference', version, schema_version: '1.0.0', java_version: '17.0.9', dotnet_analyzer: analyzer })}\n`);
    }
    if (name === 'java') return sim.java ? ok('', `openjdk version "${sim.java}" 2023-10-17\nOpenJDK Runtime Environment`) : null;
    if (name === 'mvn') return sim.mvn ? ok(`Apache Maven ${sim.mvn} (abc)\nMaven home: /usr/share/maven`) : null;
    if (name === 'dotnet' && args[0] === '--list-sdks') return ok(sim.sdks.map((v) => `${v} [/usr/share/dotnet/sdk]`).join('\n'));
    if (name === 'dotnet' && args[0] === '--list-runtimes') {
      return ok(['Microsoft.AspNetCore.App 8.0.10 [/usr/share/dotnet/shared/Microsoft.AspNetCore.App]',
        ...sim.runtimes.map((v) => `Microsoft.NETCore.App ${v} [/usr/share/dotnet/shared/Microsoft.NETCore.App]`)].join('\n'));
    }
    if (name === 'npm') return sim.npm ? ok(`${sim.npm}\n`) : null;
    if (name === 'docker') {
      if (sim.docker === 'absent') return null;
      if (args[0] === 'version') return sim.docker === 'daemon-down' ? { code: 1, stdout: '', stderr: 'Cannot connect to the Docker daemon' } : ok('27.1.1\n');
      if (args[0] === '--version') return ok('Docker version 27.1.1, build 6312585\n');
      if (args[0] === 'compose') return ok('2.29.1\n');
    }
    if (name === 'vswhere') return sim.vswhere ? ok('17.9.34607.119\n') : null;
    return null;
  };
  const readFile = (p: string): string | null => {
    if (p === path.join(ROOT, 'VERSION')) return '1.2.0\n';
    if (sim.engineAnalyzer && p === path.join(path.dirname(sim.engineAnalyzer), 'dotnet-analyzer.deps.json')) {
      return `{"targets":{".NETCoreApp,Version=v8.0":{"dotnet-analyzer/${sim.analyzerVersion}":{}}}}`;
    }
    return null;
  };
  return {
    platform: sim.platform,
    env: sim.env,
    productRoot: ROOT,
    nodeVersion: sim.node,
    exec,
    exists: (p: string) => files.has(p),
    readFile,
    totalmem: () => sim.ram,
    freeDisk: () => sim.disk,
    tmpdir: '/tmp',
    portFree: async () => sim.portFree,
    fetchHealth: async () => sim.health,
  };
}

const sim = (w: DevArchWorld): Sim => w.data.sim as Sim;
const report = (w: DevArchWorld): Report => w.data.report as Report;
const check = (w: DevArchWorld, id: string): Check => {
  const c = report(w).checks.find((x) => x.id === id);
  assert.ok(c, `no check ${id} in ${report(w).checks.map((x) => x.id).join(', ')}`);
  return c;
};

// --- simulated systems --------------------------------------------------------------------------------------

Given('a simulated {string} system where every requirement is satisfied', function (this: DevArchWorld, platform: string) {
  this.data.sim = simulated(platform);
});

Given('the requirement {string} is missing', function (this: DevArchWorld, id: string) {
  const s = sim(this);
  switch (id) {
    case 'jdk': s.java = null; break;
    case 'maven': s.mvn = null; break;
    case 'dotnet-sdk': s.sdks = []; break;
    case 'dotnet-runtime': s.runtimes = []; break;
    case 'node': s.node = 'v18.19.0'; break;
    case 'engine-jar': s.jar = 'absent'; break;
    case 'dotnet-analyzer': s.engineAnalyzer = null; delete s.env.DOTNET_ANALYZER_PATH; break;
    case 'vs-build-tools': s.vswhere = false; break;
    case 'docker': s.docker = 'absent'; break;
    case 'env': delete s.env.GEMINI_API_KEY; delete s.env.GOOGLE_GENAI_API_KEY; break;
    case 'port': s.portFree = false; s.health = null; break;
    case 'resources': s.ram = 2 * GIB; break;
    default: throw new Error(`unknown requirement ${id}`);
  }
});

Given('the simulated {string} reports {string}', function (this: DevArchWorld, command: string, version: string) {
  assert.equal(command, 'java -version');
  sim(this).java = version;
});

Given('the simulated .NET SDKs are {string} and the runtimes are {string}', function (this: DevArchWorld, sdks: string, runtimes: string) {
  sim(this).sdks = sdks.split(',').map((s) => s.trim());
  sim(this).runtimes = runtimes.split(',').map((s) => s.trim());
});

Given('the simulated Docker daemon is not reachable', function (this: DevArchWorld) {
  sim(this).docker = 'daemon-down';
});

Given('the simulated JAVA_HOME points to a folder without {string}', function (this: DevArchWorld, _bin: string) {
  sim(this).env.JAVA_HOME = '/opt/broken-jdk';
});

Given('the simulated engine archive is {string}', function (this: DevArchWorld, state: string) {
  const s = sim(this);
  if (state === 'built at the product version') s.jar = 'ok';
  else if (state === 'built at another version') s.jar = 'other-version';
  else if (state === 'not answering the self-check') s.jar = 'silent';
  else if (state === 'not built') s.jar = 'absent';
  else if (state === 'missing at ENGINE_JAR_PATH') s.env.ENGINE_JAR_PATH = '/nowhere/engine.jar';
  else throw new Error(`unknown archive state ${state}`);
});

Given('the simulated engine self-diagnosis locates the analyzer at {string} with version {string} in its manifest',
  function (this: DevArchWorld, analyzer: string, version: string) {
    const s = sim(this);
    s.engineAnalyzer = analyzer;
    s.analyzerVersion = version;
    delete s.env.DOTNET_ANALYZER_PATH;
  });

Given('the simulated port 9002 is {string}', function (this: DevArchWorld, state: string) {
  const s = sim(this);
  s.portFree = state === 'free';
  s.health = state === 'served by dev-arch' ? { service: 'dev-arch', status: 'OK', version: '1.2.0' } : null;
});

When('the doctor runs in mode {string}', async function (this: DevArchWorld, mode: string) {
  const r = (await runDoctor(systemOf(sim(this)), { mode })) as Report;
  this.data.report = r;
  this.data.exitCode = r.status === 'FAIL' ? 1 : 0;
});

When('the doctor command runs with {string}', async function (this: DevArchWorld, args: string) {
  const r = (await main(args.split(/\s+/).filter(Boolean), systemOf(sim(this)), false)) as { code: number; stdout: string; stderr: string };
  this.data.output = r.stdout;
  this.data.exitCode = r.code;
  // Same shape as a process result, so the generic "the output contains" step (006) applies.
  this.result = { code: r.code, stdout: r.stdout, stderr: r.stderr, output: `${r.stdout}\n${r.stderr}`, elapsedMs: 0 };
});

Then('the check {string} has the status {string}', function (this: DevArchWorld, id: string, status: string) {
  const c = check(this, id);
  assert.equal(c.status, status, `${id}: ${c.detected} — ${c.detail}`);
});

Then('the check {string} has the status {string} with a detail mentioning {string}', function (this: DevArchWorld, id: string, status: string, text: string) {
  const c = check(this, id);
  assert.equal(c.status, status, `${id}: ${c.detail}`);
  assert.ok(c.detail.includes(text), `detail of ${id} does not mention ${text}: ${c.detail}`);
});

Then('the check {string} suggests {string}', function (this: DevArchWorld, id: string, hint: string) {
  assert.ok(check(this, id).fix.includes(hint), `${id} suggests ${JSON.stringify(check(this, id).fix)}`);
});

Then('every other check of the mode has the status {string}', function (this: DevArchWorld, status: string) {
  const r = report(this);
  const missing = r.checks.filter((c) => c.status !== status);
  assert.equal(missing.length, 1, `checks not ${status}: ${missing.map((c) => `${c.id} (${c.status}: ${c.detail})`).join('; ')}`);
});

Then('the overall status is {string} and the exit code is {int}', function (this: DevArchWorld, status: string, code: number) {
  assert.equal(report(this).status, status);
  assert.equal(this.data.exitCode, code);
});

Then('the checks are exactly {string}', function (this: DevArchWorld, ids: string) {
  assert.deepEqual(report(this).checks.map((c) => c.id), ids.split(',').map((s) => s.trim()));
});

Then('no simulated command other than the detection commands was executed', function (this: DevArchWorld) {
  const detection = new Set(['java', 'mvn', 'dotnet', 'npm', 'docker', 'vswhere']);
  const other = sim(this).calls.filter((c) => !detection.has(bare(c[0])) || c.some((a) => /\binstall\b/.test(a)));
  assert.deepEqual(other, []);
});

Then('the output is a JSON report with {string}, {string}, {string}, {string}, {string}, {string} and {string}', function (this: DevArchWorld, keys0: string, keys1: string, keys2: string, keys3: string, keys4: string, keys5: string, keys6: string) {
  const keys = [keys0, keys1, keys2, keys3, keys4, keys5, keys6];
  const r = JSON.parse(String(this.data.output)) as Report;
  for (const k of keys) assert.ok(k in r, `report has no ${k}`);
  this.data.report = r;
});

Then('every check has {string}, {string}, {string}, {string}, {string}, {string}, {string} and {string}', function (this: DevArchWorld, keys0: string, keys1: string, keys2: string, keys3: string, keys4: string, keys5: string, keys6: string, keys7: string) {
  const keys = [keys0, keys1, keys2, keys3, keys4, keys5, keys6, keys7];
  for (const c of report(this).checks) for (const k of keys) assert.ok(k in c, `${c.id} has no ${k}`);
});

Then('the report includes the engine self-diagnosis', function (this: DevArchWorld) {
  assert.equal((report(this).engine as { engine?: string } | null)?.engine, 'static-inference');
});

// --- this machine -------------------------------------------------------------------------------------------

const CLI = path.join(layout.productRoot, 'scripts', 'doctor', 'cli.mjs');

When('the doctor is run on this machine with {string}', function (this: DevArchWorld, args: string) {
  this.result = run(process.execPath, [CLI, ...args.split(/\s+/).filter(Boolean)], { cwd: layout.productRoot, timeoutMs: 120_000 });
  if (args.includes('--json') && this.result.code !== 64) this.data.report = JSON.parse(this.result.stdout) as Report;
});

Then('the report has one check per local requirement of the definition', function (this: DevArchWorld) {
  const want = (REQUIREMENTS as Requirement[]).filter((r) => r.modes.includes('local')).map((r) => r.id);
  assert.deepEqual(report(this).checks.map((c) => c.id), want);
});

Then('every check shows a detected version and a required version', function (this: DevArchWorld) {
  for (const c of report(this).checks) {
    assert.ok(c.detected.trim(), `${c.id} has no detected value`);
    assert.ok(c.required.trim(), `${c.id} has no required value`);
  }
});

Then('no check has the status {string}', function (this: DevArchWorld, status: string) {
  const bad = report(this).checks.filter((c) => c.status === status).map((c) => `${c.id}: ${c.detail}`);
  assert.deepEqual(bad, []);
});

Then('the exit code is {int}', function (this: DevArchWorld, code: number) {
  const actual = this.result ? this.result.code : this.data.exitCode;
  assert.equal(actual, code, this.result?.output.slice(-2000));
});

Then('the error output lists the options {string}, {string}, {string} and {string}', function (this: DevArchWorld, opts0: string, opts1: string, opts2: string, opts3: string) {
  const opts = [opts0, opts1, opts2, opts3];
  for (const o of opts) assert.ok(this.result!.stderr.includes(o), `stderr does not list ${o}:\n${this.result!.stderr}`);
});

function jsonOf(text: string): Report {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  assert.ok(start >= 0 && end > start, `no JSON report in:\n${text.slice(-2000)}`);
  return JSON.parse(text.slice(start, end + 1)) as Report;
}

When('the doctor is run on this machine as {string} with {string}', function (this: DevArchWorld, command: string, args: string) {
  const line = command.endsWith('=') ? `${command}"${args}"` : `${command} ${args}`;
  const res = run('bash', ['-c', line], { cwd: layout.productRoot, timeoutMs: 300_000 });
  assert.equal(res.code, 0, `${line}\n${res.output.slice(-3000)}`);
  const reports = (this.data.entryReports ??= []) as Report[];
  reports.push(jsonOf(res.stdout));
});

Then('the three reports have the same checks with the same statuses', function (this: DevArchWorld) {
  const reports = this.data.entryReports as Report[];
  assert.equal(reports.length, 3);
  const shape = (r: Report) => r.checks.map((c) => `${c.id}=${c.status}`);
  assert.deepEqual(shape(reports[1]), shape(reports[0]));
  assert.deepEqual(shape(reports[2]), shape(reports[0]));
  assert.ok(reports[0].checks.length > 0);
});

// --- Makefile and sources -----------------------------------------------------------------------------------

function makeTarget(mk: string, target: string): string[] {
  const lines = mk.split('\n');
  const i = lines.findIndex((l) => l.startsWith(`${target}:`));
  assert.ok(i >= 0, `no target ${target}`);
  const recipe: string[] = [];
  for (const l of lines.slice(i + 1)) {
    if (!l.startsWith('\t')) break;
    recipe.push(l.trim());
  }
  return recipe;
}

Then('the target {string} still only prints {string}', function (this: DevArchWorld, target: string, text: string) {
  assert.deepEqual(makeTarget(this.data.makefile as string, target), [`@echo "${text}"`]);
});

Then('the phony target {string} runs the doctor in mode {string}', function (this: DevArchWorld, target: string, mode: string) {
  const mk = this.data.makefile as string;
  assert.match(mk, new RegExp(`\\.PHONY:[^\\n]*(?:\\\\\\n[^\\n]*)*\\b${target}\\b`), `${target} is not phony`);
  const recipe = makeTarget(mk, target).join('\n');
  assert.match(recipe, /node scripts\/doctor\/cli\.mjs/);
  assert.ok(recipe.includes(`--mode ${mode}`), recipe);
});

Given('the doctor sources', function (this: DevArchWorld) {
  const dir = path.join(layout.productRoot, 'scripts', 'doctor');
  this.data.doctorSources = readdirSync(dir).filter((f) => f.endsWith('.mjs') && !f.endsWith('.test.mjs')).map((f) => path.join(dir, f));
  assert.ok((this.data.doctorSources as string[]).length >= 5);
});

Then('they import only Node built-in modules and other doctor modules', function (this: DevArchWorld) {
  const bad: string[] = [];
  for (const f of this.data.doctorSources as string[]) {
    for (const m of readFileSync(f, 'utf8').matchAll(/(?:^|\n)\s*import\s[^'"]*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      const spec = m[1] ?? m[2];
      if (!spec.startsWith('node:') && !/^\.\/[\w-]+\.mjs$/.test(spec)) bad.push(`${path.basename(f)}: ${spec}`);
    }
  }
  assert.deepEqual(bad, []);
});

Then('the product manifest declares the script {string} and the binary {string} pointing to the doctor', function (this: DevArchWorld, script: string, bin: string) {
  const pkg = JSON.parse(readFileSync(path.join(layout.productRoot, 'package.json'), 'utf8')) as { scripts?: Record<string, string>; bin?: Record<string, string> };
  assert.match(pkg.scripts?.[script] ?? '', /node scripts\/doctor\/cli\.mjs/);
  assert.equal(pkg.bin?.[bin], 'scripts/doctor/cli.mjs');
});

Then('the human table colors the status only when color is enabled', async function () {
  const r = (await runDoctor(systemOf(simulated('linux')), { mode: 'local' })) as Report;
  assert.ok((formatHuman(r, true) as string).includes('\u001b[32mOK'), 'no color with color enabled');
  assert.ok(!(formatHuman(r, false) as string).includes('\u001b['), 'color without a terminal');
});
