// US3 — The web analyzes a ZIP with the locally built engine (TS-014..TS-019).
import { Given, Then, When } from '@cucumber/cucumber';
import AdmZip from 'adm-zip';
import assert from 'node:assert/strict';
import { accessSync, constants, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync, chmodSync } from 'node:fs';
import path from 'node:path';
import { layout } from '../support/layout.ts';
import { run } from '../support/process.ts';
import { jdk17Home, tempDir } from '../support/tools.ts';
import { analyzeForm, callAnalyzeRoute, demoZip, startDevServer } from '../support/web.ts';
import { buildOutputs, isBuilt, productDir } from './build-and-test.steps.ts';
import type { DevArchWorld } from '../support/world.ts';

type EngineModule = typeof import('../../../web/src/server/engine/engine-path.ts');

async function engineModule(): Promise<EngineModule> {
  return import(path.join(layout.webDir, 'src', 'server', 'engine', 'engine-path.ts')) as Promise<EngineModule>;
}

function dotnetRoot(): string | undefined {
  if (process.env.DOTNET_ROOT) return process.env.DOTNET_ROOT;
  const sdks = run('dotnet', ['--list-sdks'], { cwd: layout.productRoot }).stdout.trim().split('\n').pop() ?? '';
  const dir = /\[(.*)\]$/.exec(sdks)?.[1];
  return dir ? path.dirname(dir) : undefined;
}

// --- TS-014 / TS-019 (running web) -------------------------------------------------------------------

Given('the web is running in development mode', async function (this: DevArchWorld) {
  const webDir = path.join(productDir(this), 'web');
  const env: NodeJS.ProcessEnv = { ENGINE_JAR_PATH: '' };
  const jdk = jdk17Home();
  if (jdk) env.JAVA_HOME = jdk;
  const root = dotnetRoot();
  if (root) env.DOTNET_ROOT = root;
  const { server, url } = await startDevServer(webDir, env);
  this.servers.push(server);
  this.data.url = url;
});

When('the ZIP of the demo project {string} is uploaded for analysis', async function (this: DevArchWorld, project: string) {
  const zip = demoZip(path.join(productDir(this), 'engine'), project);
  const started = Date.now();
  const res = await fetch(`${this.data.url}/api/analyze`, {
    method: 'POST',
    body: analyzeForm(zip, `${project}.zip`),
    signal: AbortSignal.timeout(10 * 60 * 1000),
  });
  this.data.elapsedMs = Date.now() - started;
  this.data.status = res.status;
  this.data.body = await res.json();
});

Then('the analysis succeeds within {int} minutes', function (this: DevArchWorld, minutes: number) {
  assert.equal(this.data.status, 200, JSON.stringify(this.data.body).slice(0, 2000));
  assert.ok((this.data.elapsedMs as number) < minutes * 60_000, `analysis took ${this.data.elapsedMs} ms`);
});

Then('the analysis succeeds', function (this: DevArchWorld) {
  assert.equal(this.data.status, 200, JSON.stringify(this.data.body).slice(0, 2000));
});

Then(
  'the response contains at least one component and at least one architecture proposal',
  function (this: DevArchWorld) {
    const body = this.data.body as { componentsData?: { components?: unknown[] }; archData?: { proposals?: unknown[] } };
    assert.ok((body.componentsData?.components ?? []).length >= 1, 'no component in the response');
    assert.ok((body.archData?.proposals ?? []).length >= 1, 'no architecture proposal in the response');
  },
);

Then('the components data declares the contract version {string}', function (this: DevArchWorld, version: string) {
  const body = this.data.body as { componentsData?: { meta?: { schema_version?: string } } };
  assert.equal(body.componentsData?.meta?.schema_version, version);
});

Given('the product is built with the .NET analyzer staged next to the engine', function (this: DevArchWorld) {
  const product = productDir(this);
  assert.ok(isBuilt(product), `the product is not built (run make build): ${Object.values(buildOutputs(product))}`);
  const analyzer = path.join(product, 'web', 'engine-dist', 'dotnet-analyzer');
  accessSync(analyzer, constants.X_OK);
});

Then('the components data declares a .NET source', function (this: DevArchWorld) {
  const body = this.data.body as { componentsData?: { meta?: { source?: string } } };
  assert.ok(['roslyn', 'roslyn-fallback'].includes(body.componentsData?.meta?.source ?? ''),
    `meta.source is ${body.componentsData?.meta?.source}`);
});

// --- TS-015 (route without a built engine) -------------------------------------------------------------

Given('the staged engine archive does not exist', function (this: DevArchWorld) {
  // A web working directory without engine-dist/ (the real web folder may hold a built engine).
  const cwd = realpathSync(tempDir('web-cwd'));
  this.cleanup.push(cwd);
  this.data.webCwd = cwd;
  assert.ok(!existsSync(path.join(cwd, 'engine-dist', 'engine.jar')));
});

Given('no engine path override is configured', function (this: DevArchWorld) {
  this.data.routeEnv = { ENGINE_JAR_PATH: undefined };
});

When('a ZIP is uploaded for analysis', async function (this: DevArchWorld) {
  const zip = new AdmZip();
  zip.addFile('demo/pom.xml', Buffer.from('<project/>'));
  const res = await callAnalyzeRoute(layout.webDir, this.data.webCwd as string,
    this.data.routeEnv as Record<string, string | undefined>, analyzeForm(zip.toBuffer(), 'demo.zip'));
  this.data.status = res.status;
  this.data.body = res.body;
});

Then('the analysis fails with status {int}', function (this: DevArchWorld, status: number) {
  assert.equal(this.data.status, status, JSON.stringify(this.data.body));
});

Then(
  'the error message contains {string}, the path that was tried and {string}',
  function (this: DevArchWorld, first: string, second: string) {
    const error = String((this.data.body as { error?: string }).error ?? '');
    assert.ok(error.includes(first), error);
    assert.ok(error.includes(path.join(this.data.webCwd as string, 'engine-dist', 'engine.jar')), error);
    assert.ok(error.includes(second), error);
  },
);

// --- TS-016 / TS-017 (resolution rules) --------------------------------------------------------------

Given(
  'the environment variable {string} points to an existing engine archive outside the web folder',
  function (this: DevArchWorld, variable: string) {
    const dir = tempDir('engine-override');
    this.cleanup.push(dir);
    const jar = path.join(dir, 'engine.jar');
    writeFileSync(jar, 'jar');
    this.data.resolveEnv = { [variable]: jar };
    this.data.resolveCwd = layout.webDir;
    this.data.override = jar;
    this.data.useRealFs = true;
  },
);

Given('the environment has no ENGINE_JAR_PATH and no JAVA_HOME', function (this: DevArchWorld) {
  this.data.resolveEnv = {};
});

Given('the environment has JAVA_HOME {string}', function (this: DevArchWorld, home: string) {
  this.data.resolveEnv = { JAVA_HOME: home };
});

Given('the environment has ENGINE_JAR_PATH {string}', function (this: DevArchWorld, jar: string) {
  this.data.resolveEnv = { ENGINE_JAR_PATH: jar };
});

Given('the web working directory is {string}', function (this: DevArchWorld, cwd: string) {
  this.data.resolveCwd = cwd;
});

When('the engine is resolved by the web', async function (this: DevArchWorld) {
  const { resolveEngine } = await engineModule();
  const exists = this.data.useRealFs ? existsSync : () => true; // rule table: archives assumed present
  this.data.resolution = resolveEngine(this.data.resolveEnv as NodeJS.ProcessEnv, this.data.resolveCwd as string, exists);
});

Then('the resolved engine archive is the one from {string}', function (this: DevArchWorld, _variable: string) {
  const r = this.data.resolution as { kind: string; jarPath: string };
  assert.equal(r.kind, 'resolved');
  assert.equal(r.jarPath, this.data.override);
});

Then('the resolved Java executable is {string}', function (this: DevArchWorld, java: string) {
  const r = this.data.resolution as { kind: string; javaBin?: string };
  assert.equal(r.kind, 'resolved');
  assert.equal(r.javaBin, java);
});

Then('the resolved engine archive is {string}', function (this: DevArchWorld, jar: string) {
  assert.equal((this.data.resolution as { jarPath: string }).jarPath, jar);
});

// --- TS-018 (paths with spaces, no shell) ------------------------------------------------------------

Given('the extracted project path contains spaces', function (this: DevArchWorld) {
  const cwd = tempDir('web-cwd');
  const jdk = tempDir('fake-jdk');
  this.cleanup.push(cwd, jdk);
  mkdirSync(path.join(cwd, 'engine-dist'));
  writeFileSync(path.join(cwd, 'engine-dist', 'engine.jar'), 'jar');
  const argsFile = path.join(jdk, 'args.json');
  const java = path.join(jdk, 'bin', 'java');
  mkdirSync(path.dirname(java));
  // Fake java: records its argv and writes the two artifacts the route reads.
  writeFileSync(java, `#!/usr/bin/env node
const fs = require('fs');
fs.writeFileSync(${JSON.stringify(argsFile)}, JSON.stringify(process.argv.slice(2)));
fs.writeFileSync('output.json', JSON.stringify({ components: [], edges: [], meta: { schema_version: '1.0.0' } }));
fs.writeFileSync('output_architecture.json', JSON.stringify({ proposals: [] }));
`);
  chmodSync(java, 0o755);
  this.data.webCwd = cwd;
  this.data.argsFile = argsFile;
  // NODE_OPTIONS of the runner (tsx loader) must not leak into the fake java node script.
  this.data.routeEnv = { JAVA_HOME: jdk, ENGINE_JAR_PATH: undefined, NODE_OPTIONS: undefined };
  this.data.projectName = 'my demo project';
});

When('the web invokes the engine', async function (this: DevArchWorld) {
  const zip = new AdmZip();
  zip.addFile(`${this.data.projectName}/pom.xml`, Buffer.from('<project/>'));
  const res = await callAnalyzeRoute(layout.webDir, this.data.webCwd as string,
    this.data.routeEnv as Record<string, string | undefined>, analyzeForm(zip.toBuffer(), 'project.zip'));
  assert.equal(res.status, 200, JSON.stringify(res.body));
});

Then('the engine receives the project path as a single argument without a shell', function (this: DevArchWorld) {
  const args = JSON.parse(readFileSync(this.data.argsFile as string, 'utf8')) as string[];
  assert.equal(args.length, 4, `argv: ${JSON.stringify(args)}`);
  assert.equal(args[0], '-jar');
  assert.equal(path.basename(args[2]), this.data.projectName);
  assert.ok(existsSync(args[2]), `the engine received a path that does not exist: ${args[2]}`);
});
