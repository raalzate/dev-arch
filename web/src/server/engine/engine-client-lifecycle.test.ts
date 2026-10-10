// Life cycle of the engine client (007 contracts/engine-client.md; FR-029, FR-030): engine start, successful
// responses, tool errors, crashes, timeouts, shutdown and the unavailable period. The engine is a minimal MCP stdio
// server written to a temporary folder for these tests, whose tools misbehave on demand.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  EngineClient, EngineCrashedError, EngineNotBuiltError, EngineTimeoutError, EngineToolError, EngineUnavailableError,
  type EngineClientOptions, type EngineLaunchSpec,
} from './engine-client.ts';

const require = createRequire(import.meta.url);
const sdkEsm = (p: string) =>
  pathToFileURL(require.resolve(`@modelcontextprotocol/sdk/${p}`).replace(`${path.sep}dist${path.sep}cjs${path.sep}`, `${path.sep}dist${path.sep}esm${path.sep}`)).href;

const dir = mkdtempSync(path.join(os.tmpdir(), 'devarch-lifecycle-'));
const stub = path.join(dir, 'stub-engine.mjs');
writeFileSync(stub, `
import { Server } from ${JSON.stringify(sdkEsm('server/index.js'))};
import { StdioServerTransport } from ${JSON.stringify(sdkEsm('server/stdio.js'))};
import { CallToolRequestSchema, ListToolsRequestSchema, ReadResourceRequestSchema } from ${JSON.stringify(sdkEsm('types.js'))};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = new Server({ name: 'lifecycle-stub', version: '1' }, { capabilities: { tools: {}, resources: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [] }));
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  if (name === 'echo') return { content: [{ type: 'text', text: JSON.stringify(args) }], _meta: { 'static-inference/warnings': ['careful', 7] } };
  if (name === 'fail') return { content: [], isError: true };
  if (name === 'notext') return { content: [{ type: 'image', data: '', mimeType: 'image/png' }] };
  if (name === 'slow') { await sleep(args.ms); return { content: [{ type: 'text', text: 'late' }] }; }
  if (name === 'crash') process.exit(5);
  if (name === 'stderr') { process.stderr.write('first\\r\\n\\nsecond\\npartial'); await sleep(50); process.stderr.write(' end\\n'); return { content: [{ type: 'text', text: 'ok' }] }; }
  if (name === 'analyze_project') return { content: [{ type: 'text', text: args.projectPath === 'bad-json' ? 'not json' : '{"componentCount":1}' }] };
  return { content: [{ type: 'text', text: 'Unknown tool ' + name }], isError: true };
});
server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
  const uri = req.params.uri;
  if (uri === 'blob://bin') return { contents: [{ uri, blob: 'AAAA', mimeType: 'application/octet-stream' }] };
  if (uri === 'empty://none') return { contents: [] };
  return { contents: [{ uri, mimeType: 'text/plain', text: 'hello ' + uri }] };
});
const delay = Number(process.env.STUB_START_DELAY_MS ?? 0);
if (delay) await sleep(delay);
await server.connect(new StdioServerTransport());
process.stdin.on('end', () => process.exit(0));
`);

const clients: EngineClient[] = [];
after(async () => {
  for (const c of clients) await c.shutdown();
  rmSync(dir, { recursive: true, force: true });
});

function client(opts: EngineClientOptions = {}, env: Record<string, string> = {}) {
  let launches = 0;
  const logs: string[] = [];
  const launch = (): EngineLaunchSpec => {
    launches++;
    return { command: process.execPath, args: [stub], env: { ...(process.env as Record<string, string>), NODE_OPTIONS: '', ...env } };
  };
  const c = new EngineClient(launch, (l) => logs.push(l), { backoffMs: [20, 20, 20], ...opts });
  clients.push(c);
  return { c, logs, launches: () => launches };
}

// One engine process serves the tests that leave it usable (each process start costs a few hundred milliseconds).
const shared = client();

test('engine start is lazy and shared by concurrent calls', async () => {
  const s = shared;
  assert.equal(s.c.pid(), null);
  assert.equal(s.launches(), 0);
  const [a, b] = await Promise.all([s.c.callTool('echo', { n: 1 }, 10_000), s.c.callTool('echo', { n: 2 }, 10_000)]);
  assert.deepEqual(JSON.parse(a.text), { n: 1 });
  assert.deepEqual(JSON.parse(b.text), { n: 2 });
  assert.equal(s.launches(), 1);
  assert.equal(typeof s.c.pid(), 'number');
});

test('success: a tool answer returns its text and the warnings converted to strings', async () => {
  const r = await shared.c.callTool('echo', { jobId: 'j' }, 10_000);
  assert.equal(r.text, '{"jobId":"j"}');
  assert.deepEqual(r.warnings, ['careful', '7']);
});

test('success: readResource returns the text of a resource', async () => {
  assert.equal(await shared.c.readResource('text://a'), 'hello text://a');
});

test('tool error: isError without a message raises EngineToolError with a default message', async () => {
  await assert.rejects(shared.c.callTool('fail', {}, 10_000), (e: unknown) =>
    e instanceof EngineToolError && e.message === 'The engine reported an error without a message' && !e.ambiguous);
});

test('tool error: an answer without text content is an empty text and an unknown tool is a tool error', async () => {
  assert.deepEqual(await shared.c.callTool('notext', {}, 10_000), { text: '', warnings: [] });
  await assert.rejects(shared.c.callTool('nope', {}, 10_000), (e: unknown) => e instanceof EngineToolError && e.message === 'Unknown tool nope');
});

test('tool error: a resource without text content (binary or empty) raises EngineToolError', async () => {
  await assert.rejects(shared.c.readResource('blob://bin'), (e: unknown) =>
    e instanceof EngineToolError && e.message === 'The engine resource blob://bin has no text content');
  await assert.rejects(shared.c.readResource('empty://none'), EngineToolError);
});

test('tool error: an analyze_project answer that is not JSON is rejected', async () => {
  const hooks = { onPhase: () => undefined, onStderr: () => undefined, timeoutMs: 10_000 };
  await assert.rejects(shared.c.analyze({ jobId: 'j', projectPath: 'bad-json', outputDir: dir, language: 'auto' }, hooks), (e: unknown) =>
    e instanceof EngineToolError && e.message === 'The engine response is not valid JSON');
});

test('timeout: a tool call above its time limit raises EngineTimeoutError and the engine stays usable', async () => {
  await assert.rejects(shared.c.callTool('slow', { ms: 3000 }, 200), (e: unknown) =>
    e instanceof EngineTimeoutError && /exceeded the time limit/.test(e.message));
  assert.equal((await shared.c.callTool('echo', {}, 10_000)).text, '{}');
  assert.equal(shared.launches(), 1, 'no relaunch after a tool call timeout');
});

test('crash: a process exit during a tool call raises EngineCrashedError and the next call relaunches', async () => {
  const s = client();
  await assert.rejects(s.c.callTool('crash', {}, 10_000), EngineCrashedError);
  assert.ok(s.logs.some((l) => l.startsWith('[engine] process exited unexpectedly (1 crash(es)')), s.logs.join('\n'));
  assert.equal((await s.c.callTool('echo', { again: true }, 10_000)).text, '{"again":true}');
  assert.equal(s.launches(), 2);
});

test('crash: repeated crashes make the engine unavailable for a while, then it starts again', async () => {
  const s = client({ maxCrashes: 2, unavailableMs: 300 });
  await assert.rejects(s.c.callTool('crash', {}, 10_000), EngineCrashedError);
  await assert.rejects(s.c.callTool('crash', {}, 10_000), EngineCrashedError);
  await assert.rejects(s.c.callTool('echo', {}, 10_000), EngineUnavailableError);
  await assert.rejects(s.c.readResource('text://a'), EngineUnavailableError);
  assert.equal(s.launches(), 2);
  await new Promise((r) => setTimeout(r, 350));
  assert.equal(await s.c.readResource('text://b'), 'hello text://b');
  assert.equal(s.launches(), 3);
});

test('engine start failure: a launcher that is not built or a missing command rejects the call', async () => {
  const notBuilt = new EngineClient(() => {
    throw new EngineNotBuiltError('Engine not built: run make build');
  }, () => undefined);
  clients.push(notBuilt);
  await assert.rejects(notBuilt.callTool('echo', {}, 1000), EngineNotBuiltError);
  const missing = new EngineClient(() => ({ command: path.join(dir, 'no-such-java'), args: [], env: {} }), () => undefined);
  clients.push(missing);
  await assert.rejects(missing.readResource('text://a'), (e: unknown) => !(e instanceof EngineToolError));
  assert.equal(missing.pid(), null);
});

test('engine start: shutdown during the start discards the new process and later calls are refused', async () => {
  const s = client({}, { STUB_START_DELAY_MS: '400' });
  const call = s.c.callTool('echo', {}, 10_000);
  await new Promise((r) => setTimeout(r, 50));
  await s.c.shutdown();
  await assert.rejects(call, /shut down while starting/);
  assert.equal(s.c.pid(), null);
  await assert.rejects(s.c.callTool('echo', {}, 10_000), /The engine client is shut down/);
});

test('shutdown with a call in flight rejects it without counting a crash', async () => {
  const s = client();
  await s.c.callTool('echo', {}, 10_000);
  const call = s.c.callTool('slow', { ms: 5000 }, 10_000);
  await new Promise((r) => setTimeout(r, 100));
  await s.c.shutdown();
  await assert.rejects(call, (e: unknown) => !(e instanceof EngineCrashedError));
  assert.ok(!s.logs.some((l) => l.includes('exited unexpectedly')), s.logs.join('\n'));
});

test('stderr lines are split, CR-trimmed, blank lines skipped and partial lines completed', async () => {
  const s = shared;
  s.logs.length = 0;
  await s.c.callTool('stderr', {}, 10_000);
  const deadline = Date.now() + 2000;
  while (!s.logs.includes('[engine] partial end') && Date.now() < deadline) await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(s.logs.filter((l) => l.startsWith('[engine] ')), ['[engine] first', '[engine] second', '[engine] partial end']);
});
