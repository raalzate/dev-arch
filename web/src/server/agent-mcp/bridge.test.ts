// dev-arch MCP bridge (013-agent-mcp-bridge, contracts/bridge-cli.md): packaging of the local folder and stdio proxy
// to the agent endpoint, against the real web route handlers served over HTTP with the stub engine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import webPackage from '../../../package.json';
import { BRIDGE, BridgeClient, startWebServer } from '../testing/agent-http.test.ts';
import { DEV_ARCH, setupRouteEnv, waitTerminal } from '../testing/route-harness.test.ts';

type BridgeModule = {
  VERSION: string;
  collectFiles(root: string): Promise<string[]>;
  packFolder(root: string): Promise<Buffer>;
};
let loaded: BridgeModule | undefined;
const load = async () => (loaded ??= (await import(pathToFileURL(BRIDGE).href)) as BridgeModule);
const DEMO = path.join(DEV_ARCH, 'engine/test-for-demo/java-standar');

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

function project(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'devarch-bridge-'));
  const root = path.join(dir, 'shop');
  for (const d of ['src/main/java/shop', '.git/objects', 'node_modules/x', 'target/classes', 'bin/Debug', 'obj/Debug']) {
    mkdirSync(path.join(root, d), { recursive: true });
  }
  writeFileSync(path.join(root, 'pom.xml'), '<project/>');
  writeFileSync(path.join(root, 'src/main/java/shop/Order.java'), 'package shop; class Order {}');
  for (const f of ['.git/objects/a', 'node_modules/x/i.js', 'target/classes/Order.class', 'bin/Debug/a.dll', 'obj/Debug/b.cache']) {
    writeFileSync(path.join(root, f), 'x');
  }
  writeFileSync(path.join(dir, 'outside.txt'), 'secret');
  symlinkSync(path.join(dir, 'outside.txt'), path.join(root, 'link.txt'));
  return root;
}

test('the bridge version is the product version and --version prints it', async () => {
  const bridge = await load();
  assert.equal(bridge.VERSION, webPackage.version);
  assert.equal(execFileSync(process.execPath, [BRIDGE, '--version'], { encoding: 'utf8' }).trim(), webPackage.version);
});

test('the bridge imports only built-in node: modules', () => {
  const src = readFileSync(BRIDGE, 'utf8');
  const specifiers = [...src.matchAll(/^\s*import\s[^'"]*['"]([^'"]+)['"]/gm)].map((m) => m[1]);
  assert.ok(specifiers.length > 0);
  for (const s of specifiers) assert.match(s, /^node:/);
});

test('packaging skips dependency, build and VCS directories and symbolic links, and is byte-identical on repeat', async () => {
  const bridge = await load();
  const root = project();
  try {
    const files = await bridge.collectFiles(root);
    assert.deepEqual(files, ['pom.xml', 'src/main/java/shop/Order.java']);
    const a = await bridge.packFolder(root);
    const b = await bridge.packFolder(root);
    assert.ok(a.equals(b));
    assert.deepEqual(zipNames(a), ['shop/pom.xml', 'shop/src/main/java/shop/Order.java']);
    const zipFile = path.join(path.dirname(root), 'shop.zip');
    writeFileSync(zipFile, a);
    const unzipped = execFileSync('unzip', ['-p', zipFile, 'shop/src/main/java/shop/Order.java'], { encoding: 'utf8' });
    assert.equal(unzipped, 'package shop; class Order {}');
  } finally {
    rmSync(path.dirname(root), { recursive: true, force: true });
  }
});

test('analyze_project sends the folder to a server that cannot read it and returns the summary and link', async () => {
  const env = await setupRouteEnv();
  const web = await startWebServer();
  const agent = new BridgeClient(['--url', web.url]);
  try {
    const init = await agent.initialize();
    assert.equal(init.result.serverInfo.name, 'dev-arch');
    const tools = await agent.request('tools/list');
    assert.equal(tools.result.tools.length, 10);
    const r = await agent.callTool('analyze_project', { path: DEMO, wait_seconds: 30 });
    assert.equal(r.isError, undefined, r.content[0].text);
    const ref = JSON.parse(r.content[0].text);
    assert.equal(ref.status, 'completed');
    assert.ok(ref.summary.components >= 1);
    assert.equal(ref.url, `${web.url}/?analysis=${ref.analysis_id}`);
    const job = await env.rt().store.get(ref.analysis_id);
    assert.equal(job?.origin, 'zip');
    const list = JSON.parse((await agent.callTool('list_analyses')).content[0].text);
    assert.deepEqual(list.analyses.map((a: { analysis_id: string }) => a.analysis_id), [ref.analysis_id]);
  } finally {
    await agent.close();
    await web.close();
    await env.restore();
  }
});

test('a wait of 0 returns the id and status; get_analysis then waits for completion', async () => {
  const env = await setupRouteEnv({ control: { delayMs: 1500 } });
  const web = await startWebServer();
  const agent = new BridgeClient(['--url', web.url]);
  try {
    await agent.initialize();
    const ref = JSON.parse((await agent.callTool('analyze_project', { path: DEMO, wait_seconds: 0, language: 'java' })).content[0].text);
    assert.ok(['queued', 'running'].includes(ref.status));
    assert.equal(ref.summary, null);
    assert.equal((await env.rt().store.get(ref.analysis_id))?.language, 'java');
    const done = JSON.parse((await agent.callTool('get_analysis', { analysis_id: ref.analysis_id, wait_seconds: 30 })).content[0].text);
    assert.equal(done.status, 'completed');
    assert.ok(done.summary);
  } finally {
    await agent.close();
    await web.close();
    await env.restore();
  }
});

test('invalid folders, oversize uploads and failed analyses are specific errors', async () => {
  const env = await setupRouteEnv({ env: { MAX_UPLOAD_BYTES: '200' } });
  const web = await startWebServer();
  const agent = new BridgeClient(['--url', web.url]);
  const code = (r: { content: { text: string }[]; isError?: boolean }) => {
    assert.equal(r.isError, true);
    return JSON.parse(r.content[0].text).error.code;
  };
  try {
    await agent.initialize();
    assert.equal(code(await agent.callTool('analyze_project', { path: path.join(DEMO, 'missing') })), 'INVALID_INPUT');
    assert.equal(code(await agent.callTool('analyze_project', { path: path.join(DEMO, 'pom.xml') })), 'INVALID_INPUT');
    assert.equal(code(await agent.callTool('analyze_project', { path: DEMO })), 'TOO_LARGE');
    assert.equal((await env.rt().store.list()).length, 0);
  } finally {
    await agent.close();
    await web.close();
    await env.restore();
  }
  const env2 = await setupRouteEnv({ control: { fail: 'Analysis failed: boom' } });
  const web2 = await startWebServer();
  const agent2 = new BridgeClient(['--url', web2.url]);
  try {
    await agent2.initialize();
    const r = await agent2.callTool('analyze_project', { path: DEMO, wait_seconds: 30 });
    assert.equal(code(r), 'ANALYSIS_FAILED');
    const err = JSON.parse(r.content[0].text).error;
    assert.match(err.message, /boom/);
    const [job] = await env2.rt().store.list();
    assert.equal(err.analysis_id, job.id);
    await waitTerminal(env2.rt(), job.id);
  } finally {
    await agent2.close();
    await web2.close();
    await env2.restore();
  }
});

test('an unreachable server is reported with the address and how to start dev-arch', async () => {
  const agent = new BridgeClient(['--url', 'http://127.0.0.1:9'], { DEVARCH_API_TOKEN: undefined });
  try {
    await agent.initialize();
    const r = await agent.callTool('list_analyses');
    assert.equal(r.isError, true);
    const err = JSON.parse(r.content[0].text).error;
    assert.equal(err.code, 'UNREACHABLE');
    assert.match(err.message, /http:\/\/127\.0\.0\.1:9/);
    assert.match(err.action, /docker compose|make dev/);
  } finally {
    await agent.close();
  }
});

test('the bridge forwards the API token', async () => {
  const env = await setupRouteEnv({ env: { DEVARCH_API_TOKEN: 'secret' } });
  const web = await startWebServer();
  const withToken = new BridgeClient(['--url', web.url, '--token', 'secret']);
  const without = new BridgeClient(['--url', web.url], { DEVARCH_API_TOKEN: undefined });
  try {
    await withToken.initialize();
    await without.initialize();
    assert.equal((await withToken.callTool('list_analyses')).isError, undefined);
    const denied = await without.callTool('list_analyses');
    assert.equal(denied.isError, true);
    assert.equal(JSON.parse(denied.content[0].text).error.code, 'UNAUTHORIZED');
  } finally {
    await withToken.close();
    await without.close();
    await web.close();
    await env.restore();
  }
});
