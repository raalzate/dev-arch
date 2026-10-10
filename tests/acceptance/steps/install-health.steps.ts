// 012-install-doctor-docker — US4: GET /api/health (route + server/health) and the engine self-diagnosis
// (`java -jar engine.jar --doctor`). The route runs a doctor CLI as a child process: a fake CLI written per
// scenario, or the real scripts/doctor/cli.mjs of the product (@slow).
import { After, Given, Then, When } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import * as healthRoute from '../../../web/src/app/api/health/route.ts';
import { health, resetHealthCache, type DoctorReport, type HealthBody } from '../../../web/src/server/health/health.ts';
import { layout } from '../support/layout.ts';
import { run } from '../support/process.ts';
import { jdk17Home, tempDir } from '../support/tools.ts';
import type { ApiResponse } from '../support/web-harness.ts';
import type { DevArchWorld } from '../support/world.ts';

const savedEnv = { cli: process.env.DEVARCH_DOCTOR_CLI };

After(function () {
  if (savedEnv.cli === undefined) delete process.env.DEVARCH_DOCTOR_CLI;
  else process.env.DEVARCH_DOCTOR_CLI = savedEnv.cli;
  resetHealthCache();
});

function reportWith(status: string): DoctorReport {
  const ids = ['jdk', 'dotnet-runtime', 'engine-jar', 'dotnet-analyzer', 'env', 'resources'];
  return {
    tool: 'dev-arch doctor',
    version: '1.2.0',
    mode: 'local',
    platform: 'linux',
    status: status as DoctorReport['status'],
    checks: ids.map((id, i) => ({
      id, name: id, status: (i === 0 ? status : 'OK') as DoctorReport['status'], detected: id === 'engine-jar' ? '1.2.0' : 'x',
      required: 'y', requiredFor: 'z', detail: `${id} detail`, fix: [],
    })),
    engine: { version: '1.2.0', schema_version: '1.0.0', dotnet_analyzer: { found: true, path: '/opt/a/dotnet-analyzer' } },
  };
}

/** Writes a fake doctor CLI that records its arguments and prints the given text. */
function fakeDoctor(world: DevArchWorld, output: string): void {
  const dir = tempDir('012-doctor');
  world.cleanup.push(dir);
  const log = path.join(dir, 'calls.jsonl');
  const cli = path.join(dir, 'cli.mjs');
  writeFileSync(cli, [
    "import { appendFileSync } from 'node:fs';",
    `appendFileSync(${JSON.stringify(log)}, JSON.stringify(process.argv.slice(2)) + '\\n');`,
    `process.stdout.write(${JSON.stringify(output)});`,
  ].join('\n'));
  process.env.DEVARCH_DOCTOR_CLI = cli;
  world.data.doctorLog = log;
  resetHealthCache();
}

const calls = (world: DevArchWorld): string[][] =>
  existsSync(world.data.doctorLog as string)
    ? readFileSync(world.data.doctorLog as string, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l) as string[])
    : [];

async function toApi(res: Response): Promise<ApiResponse> {
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    json = {};
  }
  return { status: res.status, headers: res.headers, text, json, elapsedMs: 0 };
}

Given('the health endpoint with a doctor that reports {string}', function (this: DevArchWorld, status: string) {
  fakeDoctor(this, JSON.stringify(reportWith(status)));
  this.data.fakeStatus = status;
});

Given('the health endpoint with a doctor that prints no report', function (this: DevArchWorld) {
  fakeDoctor(this, 'Segmentation fault\n');
});

When('the health endpoint is requested', async function (this: DevArchWorld) {
  this.data.response = await toApi(await healthRoute.GET());
});

const body = (world: DevArchWorld): HealthBody => (world.data.response as ApiResponse).json as unknown as HealthBody;

Then('the response status is {int} and it is not cached', function (this: DevArchWorld, code: number) {
  const r = this.data.response as ApiResponse;
  assert.equal(r.status, code, r.text.slice(0, 2000));
  assert.equal(r.headers.get('cache-control'), 'no-store');
});

Then('the body has the service {string}, the status, the version, the engine archive, the .NET analyzer and the engine process state', function (this: DevArchWorld, service: string) {
  const b = body(this);
  assert.equal(b.service, service);
  assert.equal(b.status, this.data.fakeStatus);
  assert.equal(b.version, '1.2.0');
  assert.equal(b.engine.jar.found, true);
  assert.equal(b.engine.jar.version, '1.2.0');
  assert.equal(b.engine.dotnetAnalyzer.found, true);
  assert.ok(['running', 'idle'].includes(b.engine.mcpProcess), b.engine.mcpProcess);
  assert.equal(b.checks.length, 6);
});

Then('the doctor was asked only for the checks {string}', function (this: DevArchWorld, ids: string) {
  const c = calls(this);
  assert.equal(c.length, 1, JSON.stringify(c));
  const args = c[0];
  assert.ok(args.includes('--json'), args.join(' '));
  assert.equal(args[args.indexOf('--mode') + 1], 'local');
  assert.deepEqual(args[args.indexOf('--only') + 1].split(','), ids.split(',').map((s) => s.trim()));
});

When('the health endpoint is requested twice within 30 seconds with the engine process starting in between', async function (this: DevArchWorld) {
  let clock = 1_000_000;
  let pid: number | null = null;
  let runs = 0;
  const deps = {
    env: { DEVARCH_DOCTOR_CLI: '/fake/cli.mjs' },
    cwd: '/fake/web',
    runDoctor: async () => {
      runs++;
      return { code: 0, stdout: JSON.stringify(reportWith('OK')), stderr: '' };
    },
    enginePid: () => pid,
    now: () => clock,
  };
  resetHealthCache();
  const first = await health(deps);
  pid = 4242;
  clock += 29_000;
  const second = await health(deps);
  this.data.healthTimeline = { deps, first, second, runs: () => runs, advance: (ms: number) => { clock += ms; } };
});

Then('the doctor ran once', function (this: DevArchWorld) {
  assert.equal((this.data.healthTimeline as { runs: () => number }).runs(), 1);
});

Then('the engine process state is {string} in the first answer and {string} in the second', function (this: DevArchWorld, a: string, b: string) {
  const t = this.data.healthTimeline as { first: { body: HealthBody }; second: { body: HealthBody } };
  assert.equal(t.first.body.engine.mcpProcess, a);
  assert.equal(t.second.body.engine.mcpProcess, b);
});

When('the health endpoint is requested again after 30 seconds', async function (this: DevArchWorld) {
  const t = this.data.healthTimeline as { deps: Parameters<typeof health>[0]; advance: (ms: number) => void };
  t.advance(1_000);
  await health(t.deps);
});

Then('the doctor ran twice', function (this: DevArchWorld) {
  assert.equal((this.data.healthTimeline as { runs: () => number }).runs(), 2);
});

Then('the body has a failed check {string} explaining that no report was produced', function (this: DevArchWorld, id: string) {
  const c = body(this).checks.find((x) => x.id === id);
  assert.ok(c, JSON.stringify(body(this)));
  assert.equal(c.status, 'FAIL');
  assert.match(c.detail, /did not produce a report/);
});

// --- @slow: the real doctor and the real engine ---------------------------------------------------------------

function builtJar(): string {
  const staged = path.join(layout.webDir, 'engine-dist', 'engine.jar');
  assert.ok(existsSync(staged), `${staged} missing: run \`make build\``);
  return staged;
}

Given('the built product', function (this: DevArchWorld) {
  builtJar();
});

When('the health route of the web is requested from the web folder', async function (this: DevArchWorld) {
  delete process.env.DEVARCH_DOCTOR_CLI;
  resetHealthCache();
  const cwd = process.cwd();
  const javaHome = process.env.JAVA_HOME;
  const jdk = jdk17Home();
  if (jdk) process.env.JAVA_HOME = jdk;
  process.chdir(layout.webDir);
  try {
    this.data.response = await toApi(await healthRoute.GET());
  } finally {
    process.chdir(cwd);
    if (javaHome === undefined) delete process.env.JAVA_HOME;
    else process.env.JAVA_HOME = javaHome;
  }
});

Then('the engine archive and the .NET analyzer are reported as found', function (this: DevArchWorld) {
  const b = body(this);
  assert.equal(b.engine.jar.found, true, JSON.stringify(b.engine));
  assert.equal(b.engine.dotnetAnalyzer.found, true, JSON.stringify(b.engine));
});

const javaBin = (): string => {
  const home = jdk17Home() ?? process.env.JAVA_HOME;
  return home ? path.join(home, 'bin', 'java') : 'java';
};

Given('the engine archive of the build', function (this: DevArchWorld) {
  this.data.jar = builtJar();
});

When('the engine is run with {string}', function (this: DevArchWorld, flag: string) {
  this.result = run(javaBin(), ['-jar', this.data.jar as string, flag], { cwd: layout.productRoot, timeoutMs: 120_000 });
});

Then('it prints exactly one JSON line with {string}, {string}, {string}, {string} and {string}', function (this: DevArchWorld, keys0: string, keys1: string, keys2: string, keys3: string, keys4: string) {
  const keys = [keys0, keys1, keys2, keys3, keys4];
  const lines = this.result!.stdout.split('\n').filter((l) => l.trim());
  assert.equal(lines.length, 1, this.result!.output.slice(-2000));
  const doc = JSON.parse(lines[0]) as Record<string, unknown>;
  assert.deepEqual(Object.keys(doc), keys);
  this.data.engineDoctor = doc;
});

Then('the version is the product version and the schema version is {string}', function (this: DevArchWorld, schema: string) {
  const doc = this.data.engineDoctor as Record<string, unknown>;
  assert.equal(doc.version, readFileSync(path.join(layout.productRoot, 'VERSION'), 'utf8').trim());
  assert.equal(doc.schema_version, schema);
});

When('the engine analyzes {string} before and after a run with {string}', function (this: DevArchWorld, demo: string, flag: string) {
  const dir = tempDir('012-parity');
  this.cleanup.push(dir);
  const project = path.join(dir, 'project');
  cpSync(path.join(layout.productRoot, demo), project, { recursive: true });
  const analyze = (name: string) => {
    const out = path.join(dir, name);
    const res = run(javaBin(), ['-jar', this.data.jar as string, project, path.join(out, 'output.json')], { cwd: dir, timeoutMs: 600_000 });
    assert.equal(res.code, 0, res.output.slice(-3000));
    return out;
  };
  mkdirSync(path.join(dir, 'before'));
  mkdirSync(path.join(dir, 'after'));
  const before = analyze('before');
  const doctor = run(javaBin(), ['-jar', this.data.jar as string, flag], { cwd: dir, timeoutMs: 120_000 });
  assert.equal(doctor.code, 0, doctor.output);
  const after = analyze('after');
  this.data.parity = { before, after };
});

Then('both command line outputs are byte-identical', function (this: DevArchWorld) {
  const { before, after } = this.data.parity as { before: string; after: string };
  const files = readdirSync(before).sort();
  assert.deepEqual(readdirSync(after).sort(), files);
  assert.ok(files.length >= 3, files.join(', '));
  for (const f of files) assert.ok(readFileSync(path.join(before, f)).equals(readFileSync(path.join(after, f))), `${f} differs`);
});

/** tools/list of the MCP server over stdio (initialize → initialized → tools/list). */
function mcpTools(jar: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const child = spawn(javaBin(), ['-jar', jar, '--mcp'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let buffer = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('MCP server did not answer tools/list'));
    }, 60_000);
    const send = (msg: unknown) => child.stdin.write(`${JSON.stringify(msg)}\n`);
    child.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith('{')) continue;
        const msg = JSON.parse(line) as { id?: number; result?: { tools?: { name: string }[] } };
        if (msg.id === 1) {
          send({ jsonrpc: '2.0', method: 'notifications/initialized' });
          send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
        } else if (msg.id === 2) {
          clearTimeout(timer);
          child.kill();
          resolve((msg.result?.tools ?? []).map((t) => t.name).sort());
        }
      }
    });
    child.on('error', reject);
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'devarch-012', version: '0' } } });
  });
}

Then('the MCP server lists exactly the tools that have a response schema in the contract', async function (this: DevArchWorld) {
  const want = readdirSync(path.join(layout.schemaDir, '1.0.0', 'mcp')).filter((f) => f.endsWith('.response.schema.json'))
    .map((f) => f.replace('.response.schema.json', '')).sort();
  assert.deepEqual(await mcpTools(this.data.jar as string), want);
});

// --- TS-021 (static) -----------------------------------------------------------------------------------------

const JAVA = path.join(layout.engineRoot, 'src', 'main', 'java', 'com', 'extractor');

Given('the engine command line sources', function (this: DevArchWorld) {
  this.data.mainSrc = readFileSync(path.join(JAVA, 'MicroserviceInferenceMain.java'), 'utf8');
  const doctor = path.join(JAVA, 'EngineDoctor.java');
  assert.ok(existsSync(doctor), 'EngineDoctor.java missing');
  this.data.doctorSrc = readFileSync(doctor, 'utf8');
});

Then('the {string} option is handled before the usage check and delegates to the engine self-diagnosis', function (this: DevArchWorld, flag: string) {
  const src = this.data.mainSrc as string;
  const handled = src.indexOf(`"${flag}".equals(args[0])`);
  assert.ok(handled >= 0, `${flag} is not handled`);
  assert.ok(handled < src.indexOf('args.length < 2'), `${flag} is handled after the usage check`);
  assert.match(src.slice(handled, handled + 400), /EngineDoctor\.run\(/);
});

Then('the engine self-diagnosis locates the analyzer with the same locator as the analysis', function (this: DevArchWorld) {
  assert.match(this.data.doctorSrc as string, /new DotNetToolLocator\(/);
  assert.match(readFileSync(path.join(JAVA, 'service', 'ExtractionService.java'), 'utf8'), /new DotNetToolLocator\(/);
});

Then('an engine unit test covers the found and not found analyzer cases', function () {
  const test = path.join(layout.engineRoot, 'src', 'test', 'java', 'com', 'extractor', 'EngineDoctorTest.java');
  assert.ok(existsSync(test), 'EngineDoctorTest.java missing');
  const src = readFileSync(test, 'utf8');
  assert.match(src, /found/i);
  assert.match(src, /notFound|NotFound|not_found|missing/);
});
