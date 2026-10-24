// 013-agent-mcp-bridge US1 (TS-001..TS-009): the agent bridge sends a local folder and receives the analysis.
import { Given, Then, When } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ConsolidatedArchitecture, DependencyGraph } from '@static-inference/schema';
import { summarize } from '../../../web/src/lib/modernization/summary.ts';
import { technologyProfile } from '../../../web/src/lib/modernization/technology.ts';
import { BRIDGE } from '../../../web/src/server/testing/agent-http.test.ts';
import { api, bridge, BridgeClient, demoFolder, jsonOf, startAgentWeb, type ToolCallResult } from '../support/agent-mcp.ts';
import type { RemoteApi, WebHarness } from '../support/web-harness.ts';
import type { DevArchWorld } from '../support/world.ts';
import { startRealWeb } from './native-runtime-common.steps.ts';

type BridgeModule = { packFolder(root: string): Promise<Buffer> };
const bridgeModule = async () => (await import(pathToFileURL(BRIDGE).href)) as BridgeModule;

const agent = (w: DevArchWorld) => w.data.bridge as BridgeClient;
const result = (w: DevArchWorld) => w.data.result as ToolCallResult;

function zipNames(zip: Buffer): string[] {
  const names: string[] = [];
  const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let p = zip.readUInt32LE(eocd + 16);
  for (let i = 0; i < zip.readUInt16LE(eocd + 10); i++) {
    const len = zip.readUInt16LE(p + 28);
    names.push(zip.subarray(p + 46, p + 46 + len).toString('utf8'));
    p += 46 + len + zip.readUInt16LE(p + 30) + zip.readUInt16LE(p + 32);
  }
  return names;
}

async function historyIds(w: DevArchWorld): Promise<string[]> {
  const res = await api(w).call('GET', '/api/analyses');
  return (res.json.analyses as { jobId: string }[]).map((a) => a.jobId);
}

async function connectBridge(w: DevArchWorld): Promise<void> {
  const b = bridge(w, ['--url', w.data.url as string]);
  await b.initialize();
  w.data.historyBefore = await historyIds(w);
}

// --- servers --------------------------------------------------------------------------------------------------

Given('a dev-arch web server whose local folder analysis is disabled', async function (this: DevArchWorld) {
  await startAgentWeb(this);
});

Given('a dev-arch web server whose engine takes longer than the wait', async function (this: DevArchWorld) {
  await startAgentWeb(this, { control: { delayMs: 3000 } });
});

Given('a dev-arch web server whose engine fails every analysis', async function (this: DevArchWorld) {
  await startAgentWeb(this, { control: { fail: 'Analysis failed: demo failure for the agent' } });
});

Given('the agent bridge connected to that server', async function (this: DevArchWorld) {
  await connectBridge(this);
});

// --- calls ----------------------------------------------------------------------------------------------------

When('the agent calls {string} with the folder of the demo project {string}', async function (this: DevArchWorld, tool: string, project: string) {
  this.data.result = await agent(this).callTool(tool, { path: demoFolder(project), wait_seconds: 60 }, 120_000);
});

When('the agent calls {string} with the folder of the demo project {string} and a wait of {int} seconds', async function (this: DevArchWorld, tool: string, project: string, wait: number) {
  this.data.result = await agent(this).callTool(tool, { path: demoFolder(project), wait_seconds: wait }, 120_000);
});

When('the agent calls {string} with the folder of the demo project {string} and the language {string}', async function (this: DevArchWorld, tool: string, project: string, language: string) {
  this.data.result = await agent(this).callTool(tool, { path: demoFolder(project), language, wait_seconds: 60 }, 120_000);
});

When('the agent calls {string} with that analysis id and a wait of {int} seconds', async function (this: DevArchWorld, tool: string, wait: number) {
  this.data.result = await agent(this).callTool(tool, { analysis_id: this.data.analysisId, wait_seconds: wait }, (wait + 30) * 1000);
});

When('the agent calls {string} with a folder that does not exist', async function (this: DevArchWorld, tool: string) {
  this.data.result = await agent(this).callTool(tool, { path: path.join(os.tmpdir(), 'devarch-013-does-not-exist') });
});

When('the agent calls {string} with a regular file', async function (this: DevArchWorld, tool: string) {
  this.data.result = await agent(this).callTool(tool, { path: path.join(demoFolder('java-standar'), 'pom.xml') });
});

When('the agent calls {string} with a folder larger than the upload limit', async function (this: DevArchWorld, tool: string) {
  const h = this.data.harness as WebHarness;
  h.setEnv('MAX_UPLOAD_BYTES', '1000');
  await h.restart();
  this.data.result = await agent(this).callTool(tool, { path: demoFolder('java-standar') });
});

// --- results --------------------------------------------------------------------------------------------------

Then('the result is not an error', function (this: DevArchWorld) {
  const r = result(this);
  assert.notEqual(r.isError, true, r.content[0]?.text);
});

Then('the result is an error with the code {string}', function (this: DevArchWorld, code: string) {
  const r = result(this);
  assert.equal(r.isError, true, r.content[0]?.text);
  assert.equal(jsonOf(r).error.code, code, r.content[0].text);
});

Then('the result contains an analysis id, the status {string}, a summary with at least {int} component and a link ending in {string}', function (this: DevArchWorld, status: string, min: number, suffix: string) {
  const ref = jsonOf(result(this));
  assert.match(ref.analysis_id, /^[0-9a-f-]{36}$/);
  assert.equal(ref.status, status);
  assert.ok(ref.summary.components >= min);
  assert.ok((ref.url as string).endsWith(suffix.replace('<id>', ref.analysis_id)), ref.url);
  this.data.analysisId = ref.analysis_id;
});

Then('the analysis history of the web lists that analysis id', async function (this: DevArchWorld) {
  assert.ok((await historyIds(this)).includes(this.data.analysisId as string));
});

Then('the result contains an analysis id and the status {string} or {string}', function (this: DevArchWorld, a: string, b: string) {
  const ref = jsonOf(result(this));
  assert.match(ref.analysis_id, /^[0-9a-f-]{36}$/);
  assert.ok([a, b].includes(ref.status), ref.status);
  this.data.analysisId = ref.analysis_id;
});

Then('the result contains the status {string} and a summary', function (this: DevArchWorld, status: string) {
  const ref = jsonOf(result(this));
  assert.equal(ref.status, status);
  assert.ok(ref.summary && ref.summary.components >= 0);
});

Then('the analysis history of the web is unchanged', async function (this: DevArchWorld) {
  assert.deepEqual(await historyIds(this), this.data.historyBefore);
});

Then('the error names the analysis id and the reason', async function (this: DevArchWorld) {
  const err = jsonOf(result(this)).error;
  const [id] = await historyIds(this);
  assert.equal(err.analysis_id, id);
  assert.match(err.message, /demo failure for the agent/);
});

Then('the analysis was registered with the language {string}', async function (this: DevArchWorld, language: string) {
  const ref = jsonOf(result(this));
  const status = await api(this).call('GET', `/api/analyses/${ref.analysis_id}`);
  assert.equal(status.json.language, language);
});

// --- packaging (TS-002..TS-004) -------------------------------------------------------------------------------

function folderWith(world: DevArchWorld, dirs: string[]): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'devarch-013-pack-'));
  world.cleanup.push(dir);
  const root = path.join(dir, 'shop');
  mkdirSync(path.join(root, 'src/main/java/shop'), { recursive: true });
  writeFileSync(path.join(root, 'pom.xml'), '<project/>');
  writeFileSync(path.join(root, 'src/main/java/shop/Order.java'), 'package shop; class Order {}');
  for (const d of dirs) {
    mkdirSync(path.join(root, d), { recursive: true });
    writeFileSync(path.join(root, d, 'ignored.txt'), 'x');
  }
  world.data.outside = path.join(dir, 'outside.txt');
  writeFileSync(world.data.outside as string, 'secret');
  return root;
}

Given('a project folder with source files and the directories {string}, {string}, {string}, {string} and {string}', function (this: DevArchWorld, d1: string, d2: string, d3: string, d4: string, d5: string) {
  const dirs = [d1, d2, d3, d4, d5];
  this.data.folder = folderWith(this, dirs);
  this.data.excluded = dirs;
});

Given('a project folder with a symbolic link to a file outside the folder', function (this: DevArchWorld) {
  const root = folderWith(this, []);
  symlinkSync(this.data.outside as string, path.join(root, 'link.txt'));
  this.data.folder = root;
});

Given('a project folder with source files', function (this: DevArchWorld) {
  this.data.folder = folderWith(this, []);
});

When('the agent bridge packages the folder', async function (this: DevArchWorld) {
  this.data.zip = await (await bridgeModule()).packFolder(this.data.folder as string);
});

When('the agent bridge packages the folder twice', async function (this: DevArchWorld) {
  const m = await bridgeModule();
  this.data.zips = [await m.packFolder(this.data.folder as string), await m.packFolder(this.data.folder as string)];
});

Then('the package contains the source files', function (this: DevArchWorld) {
  const names = zipNames(this.data.zip as Buffer);
  assert.ok(names.includes('shop/pom.xml') && names.includes('shop/src/main/java/shop/Order.java'), names.join(', '));
});

Then('the package contains no entry under {string}, {string}, {string}, {string} or {string}', function (this: DevArchWorld, d1: string, d2: string, d3: string, d4: string, d5: string) {
  const dirs = [d1, d2, d3, d4, d5];
  const names = zipNames(this.data.zip as Buffer);
  for (const d of dirs) assert.ok(!names.some((n) => n.split('/').includes(d)), `${d} in ${names.join(', ')}`);
});

Then('the package contains no entry for the symbolic link', function (this: DevArchWorld) {
  assert.ok(!zipNames(this.data.zip as Buffer).some((n) => n.endsWith('link.txt')));
});

Then('both packages are byte-identical', function (this: DevArchWorld) {
  const [a, b] = this.data.zips as Buffer[];
  assert.ok(a.equals(b));
});

// --- TS-009 (@slow): built product, real engine ---------------------------------------------------------------

Given('the built web running with the real engine and local folder analysis disabled', async function (this: DevArchWorld) {
  await startRealWeb(this, { DEVARCH_ALLOW_LOCAL_PATH: 'false' });
});

Given('the agent bridge downloaded from that web', async function (this: DevArchWorld) {
  const url = this.data.url as string;
  const res = await fetch(`${url}/dev-arch-mcp.mjs`);
  assert.equal(res.status, 200);
  const dir = mkdtempSync(path.join(os.tmpdir(), 'devarch-013-bridge-'));
  this.cleanup.push(dir);
  const file = path.join(dir, 'dev-arch-mcp.mjs');
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  const b = bridge(this, ['--url', url], {}, file);
  await b.initialize();
});

Then('the result contains the status {string} and a summary with at least {int} component', function (this: DevArchWorld, status: string, min: number) {
  const ref = jsonOf(result(this));
  assert.equal(ref.status, status, textOf(this));
  assert.ok(ref.summary.components >= min);
  this.data.analysisId = ref.analysis_id;
});

function textOf(w: DevArchWorld): string {
  return result(w).content[0]?.text ?? '';
}

Then('the summary equals the summary the web computes for the same analysis', async function (this: DevArchWorld) {
  const id = this.data.analysisId as string;
  const remote = this.data.api as RemoteApi;
  const graph = (await remote.call('GET', `/api/analyses/${id}/graph`)).json as unknown as DependencyGraph;
  const architecture = (await remote.call('GET', `/api/analyses/${id}/architecture`)).json as unknown as ConsolidatedArchitecture;
  const status = await remote.call('GET', `/api/analyses/${id}`);
  const view = { graph, architecture, contracts: null, warnings: status.json.warnings as string[] };
  assert.deepEqual(jsonOf(result(this)).summary, JSON.parse(JSON.stringify(summarize(view, technologyProfile(graph)))));
});

Then('the link of the result opens the web', async function (this: DevArchWorld) {
  const res = await fetch(jsonOf(result(this)).url);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /dev-arch/);
});

