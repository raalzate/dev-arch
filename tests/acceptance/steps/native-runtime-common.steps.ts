// Steps and helpers shared by the 007-native-engine-runtime features (web side).
import { Given, Then, When } from '@cucumber/cucumber';
import AdmZip from 'adm-zip';
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { layout } from '../support/layout.ts';
import { run } from '../support/process.ts';
import { jdk17Home } from '../support/tools.ts';
import { demoZip, startDevServer } from '../support/web.ts';
import { RemoteApi, WebHarness, type ApiClient, type ApiResponse, type HarnessOptions } from '../support/web-harness.ts';
import type { DevArchWorld } from '../support/world.ts';

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const TERMINAL = new Set(['completed', 'failed']);

export function api(world: DevArchWorld): ApiClient {
  const a = world.data.api as ApiClient | undefined;
  assert.ok(a, 'no web server is running in this scenario');
  return a;
}

export function harness(world: DevArchWorld): WebHarness {
  const h = world.data.harness as WebHarness | undefined;
  assert.ok(h, 'this step needs the in-process web harness');
  return h;
}

export function lastResponse(world: DevArchWorld): ApiResponse {
  const r = world.data.response as ApiResponse | undefined;
  assert.ok(r, 'no request was made');
  return r;
}

export async function startHarness(world: DevArchWorld, opts: HarnessOptions = {}): Promise<WebHarness> {
  return WebHarness.start(world, opts);
}

export function demoProjectZip(project: string): Buffer {
  return demoZip(layout.engineRoot, project);
}

/** A small Java project ZIP rooted at "demo" (fast scenarios with the stub engine). */
export function smallZip(): Buffer {
  const zip = new AdmZip();
  zip.addFile('demo/pom.xml', Buffer.from('<project><modelVersion>4.0.0</modelVersion></project>\n'));
  zip.addFile('demo/src/App.java', Buffer.from('package demo;\npublic class App {}\n'));
  return zip.toBuffer();
}

export async function submitZip(world: DevArchWorld, zip: Buffer, query = '', headers: Record<string, string> = {}): Promise<ApiResponse> {
  const res = await api(world).call('POST', `/api/analyses${query}`, {
    body: zip,
    headers: { 'content-type': 'application/zip', ...headers },
  });
  world.data.response = res;
  if (res.status === 202) {
    world.data.jobId = res.json.jobId;
    const ids = (world.data.jobIds as string[] | undefined) ?? [];
    ids.push(res.json.jobId);
    world.data.jobIds = ids;
  }
  return res;
}

export function jobId(world: DevArchWorld): string {
  const id = world.data.jobId as string | undefined;
  assert.ok(id, `no analysis was registered: ${JSON.stringify((world.data.response as ApiResponse | undefined)?.json)}`);
  return id;
}

export async function status(world: DevArchWorld, id: string, headers: Record<string, string> = {}): Promise<Record<string, any>> {
  const res = await api(world).call('GET', `/api/analyses/${id}`, { headers });
  assert.equal(res.status, 200, res.text);
  return res.json;
}

/** Polls the status until `pred` holds; records every observed status in world.data.observed[id]. */
export async function waitForJob(
  world: DevArchWorld,
  id: string,
  pred: (s: Record<string, any>) => boolean = (s) => TERMINAL.has(s.status),
  timeoutMs = 60_000,
  headers: Record<string, string> = {},
): Promise<Record<string, any>> {
  const observed = ((world.data.observed as Record<string, Record<string, any>[]>) ??= {});
  const list = (observed[id] ??= []);
  const deadline = Date.now() + timeoutMs;
  const interval = api(world) instanceof RemoteApi ? 500 : 50;
  for (;;) {
    const s = await status(world, id, headers);
    list.push(s);
    if (pred(s)) return s;
    if (Date.now() > deadline) throw new Error(`analysis ${id} did not reach the expected state: ${JSON.stringify(s)}`);
    await new Promise((r) => setTimeout(r, interval));
  }
}

export function dotnetRoot(): string | undefined {
  if (process.env.DOTNET_ROOT) return process.env.DOTNET_ROOT;
  const sdks = run('dotnet', ['--list-sdks'], { cwd: layout.productRoot }).stdout.trim().split('\n').pop() ?? '';
  const dir = /\[(.*)\]$/.exec(sdks)?.[1];
  return dir ? path.dirname(dir) : undefined;
}

/** Starts `next dev` of the product web with the built engine and a temporary data directory. */
export async function startRealWeb(world: DevArchWorld, extraEnv: Record<string, string> = {}): Promise<RemoteApi> {
  const dataDir = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'devarch-007-data-')));
  world.cleanup.push(dataDir);
  const env: NodeJS.ProcessEnv = { ENGINE_JAR_PATH: '', ARCHVIEW_DATA_DIR: dataDir, ...extraEnv };
  const jdk = jdk17Home();
  if (jdk) env.JAVA_HOME = jdk;
  const root = dotnetRoot();
  if (root) env.DOTNET_ROOT = root;
  const { server, url } = await startDevServer(layout.webDir, env);
  world.servers.push(server);
  world.data.url = url;
  world.data.server = server;
  const client = new RemoteApi(url, [dataDir, layout.webDir], extraEnv.DEVARCH_API_TOKEN);
  world.data.api = client;
  world.data.dataDir = dataDir;
  return client;
}

// --- web server setups ----------------------------------------------------------------------------------

Given('the web server is running with a stub engine', async function (this: DevArchWorld) {
  await startHarness(this);
});

Given('the web server is running with a stub engine that takes {int} seconds per analysis', async function (this: DevArchWorld, s: number) {
  await startHarness(this, { control: { delayMs: s * 1000 } });
});

Given('the web is running', async function (this: DevArchWorld) {
  await startRealWeb(this);
});

// --- generic responses ----------------------------------------------------------------------------------

Then('the response status is {int} with error code {string}', function (this: DevArchWorld, code: number, error: string) {
  const r = lastResponse(this);
  assert.equal(r.status, code, r.text.slice(0, 2000));
  assert.equal(r.json.error?.code, error, r.text.slice(0, 2000));
});

Then('the response status is {int}', function (this: DevArchWorld, code: number) {
  const r = lastResponse(this);
  assert.equal(r.status, code, r.text.slice(0, 2000));
});

// --- submissions ----------------------------------------------------------------------------------------

When('the ZIP of the demo project {string} is submitted for analysis', async function (this: DevArchWorld, project: string) {
  await submitZip(this, demoProjectZip(project));
});

When('the ZIP of the demo project {string} is submitted and the analysis completes', async function (this: DevArchWorld, project: string) {
  const res = await submitZip(this, demoProjectZip(project));
  assert.equal(res.status, 202, res.text);
  const s = await waitForJob(this, jobId(this), undefined, 10 * 60_000);
  assert.equal(s.status, 'completed', JSON.stringify(s));
});

When('an analysis is submitted', async function (this: DevArchWorld) {
  const res = await submitZip(this, smallZip());
  assert.equal(res.status, 202, res.text);
});

Then('the analysis ends with status {string} and error code {string}', async function (this: DevArchWorld, st: string, code: string) {
  const s = await waitForJob(this, jobId(this), undefined, 10 * 60_000);
  assert.equal(s.status, st, JSON.stringify(s));
  assert.equal(s.error?.code, code, JSON.stringify(s));
  this.data.final = s;
});

Then('the analysis ends with status {string}', async function (this: DevArchWorld, st: string) {
  const s = await waitForJob(this, jobId(this), undefined, 10 * 60_000);
  assert.equal(s.status, st, JSON.stringify(s));
  this.data.final = s;
});

Then('that analysis completes', async function (this: DevArchWorld) {
  const s = await waitForJob(this, jobId(this), undefined, 60_000);
  assert.equal(s.status, 'completed', JSON.stringify(s));
});
