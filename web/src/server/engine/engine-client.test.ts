// Engine client over MCP stdio, tested against the stub engine (007, contracts/engine-client.md). Run: npm test -w web
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EngineClient, EngineCrashedError, EngineTimeoutError, EngineToolError, EngineUnavailableError, type EngineLaunchSpec,
} from './engine-client.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const fake = path.resolve(here, '../../../../tests/acceptance/support/fake-mcp-server.mjs');
const clients: EngineClient[] = [];
after(async () => {
  for (const c of clients) await c.shutdown();
});

function setup(control: Record<string, unknown>) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'devarch-engine-'));
  const ctl = path.join(dir, 'control.json');
  const counter = path.join(dir, 'launches.txt');
  writeFileSync(counter, '');
  writeFileSync(ctl, JSON.stringify({ launchCounter: counter, ...control }));
  const launch = (): EngineLaunchSpec => ({
    command: process.execPath,
    args: [fake],
    env: { ...(process.env as Record<string, string>), FAKE_ENGINE_CONTROL: ctl, NODE_OPTIONS: '' },
  });
  const logs: string[] = [];
  const client = new EngineClient(launch, (l) => logs.push(l), { backoffMs: [50, 100, 200] });
  clients.push(client);
  const project = path.join(dir, 'project');
  mkdirSync(project);
  return { dir, ctl, counter, client, logs, project, out: path.join(dir, 'out'),
    setControl: (c: Record<string, unknown>) => writeFileSync(ctl, JSON.stringify({ launchCounter: counter, ...c })) };
}

const launches = (counter: string) => readFileSync(counter, 'utf8').split('\n').filter(Boolean).length;
const hooks = (phases: string[] = [], stderr: string[] = []) => ({
  onPhase: (p: string) => phases.push(p),
  onStderr: (l: string) => stderr.push(l),
  timeoutMs: 20_000,
});

test('starts lazily, reports phases in order and returns the validated summary and warnings', async () => {
  const s = setup({ warnings: ['Skipped {projectPath}/src/Broken.java: parse error'] });
  assert.equal(launches(s.counter), 0);
  const phases: string[] = [];
  const r = await s.client.analyze({ jobId: 'a', projectPath: s.project, outputDir: s.out, language: 'auto' }, hooks(phases));
  assert.deepEqual(phases, ['detection', 'extraction', 'inference', 'writing']);
  assert.equal(r.summary.componentCount, 27);
  assert.deepEqual(r.warnings, [`Skipped ${s.project}/src/Broken.java: parse error`]);
  assert.equal(launches(s.counter), 1);
  await s.client.analyze({ jobId: 'b', projectPath: s.project, outputDir: s.out, language: 'java' }, hooks());
  assert.equal(launches(s.counter), 1, 'the engine process is reused');
});

test('tool errors reject with EngineToolError and ambiguity is recognized', async () => {
  const s = setup({ fail: "Ambiguous project type: found both Java and .NET markers in '{projectPath}'. Use language=java|dotnet." });
  await assert.rejects(
    () => s.client.analyze({ jobId: 'a', projectPath: s.project, outputDir: s.out, language: 'auto' }, hooks()),
    (e: unknown) => e instanceof EngineToolError && e.ambiguous && e.message.includes('Ambiguous project type'),
  );
});

test('a response that violates the analyze_project contract is a tool error', async () => {
  const s = setup({});
  const c = s.client as unknown as { parseResult: (r: unknown) => unknown };
  assert.throws(() => c.parseResult({ content: [{ type: 'text', text: '{"componentCount":"x"}' }] }), EngineToolError);
});

const req = (s: ReturnType<typeof setup>, jobId = 'j') => ({ jobId, projectPath: s.project, outputDir: s.out, language: 'auto' as const });

test('a crash rejects every in-flight call with EngineCrashedError quickly and the next call relaunches', async () => {
  const s = setup({ delayMs: 10_000 });
  const a = s.client.analyze(req(s, 'a'), hooks());
  const b = s.client.analyze(req(s, 'b'), hooks());
  await new Promise((r) => setTimeout(r, 1500));
  const pid = s.client.pid();
  assert.ok(pid);
  const t0 = Date.now();
  process.kill(pid, 'SIGKILL');
  for (const p of [a, b]) await assert.rejects(p, (e: unknown) => e instanceof EngineCrashedError);
  assert.ok(Date.now() - t0 < 1000, `crash detected after ${Date.now() - t0} ms`);
  s.setControl({});
  await s.client.analyze(req(s), hooks());
  assert.equal(launches(s.counter), 2);
});

test('three crashes within a minute make the engine unavailable', async () => {
  const s = setup({ crash: true });
  for (let i = 0; i < 3; i++) await assert.rejects(s.client.analyze(req(s), hooks()), EngineCrashedError);
  await assert.rejects(s.client.analyze(req(s), hooks()), EngineUnavailableError);
});

test('a call during a restart waits for the new process', async () => {
  const s = setup({});
  await s.client.analyze(req(s), hooks());
  process.kill(s.client.pid()!, 'SIGKILL');
  await new Promise((r) => setTimeout(r, 300));
  const r = await s.client.analyze(req(s), hooks());
  assert.equal(r.summary.componentCount, 27);
});

test('a timeout rejects with EngineTimeoutError and recycles the process once idle', async () => {
  const s = setup({ delayMs: 5000 });
  await assert.rejects(s.client.analyze(req(s), { ...hooks(), timeoutMs: 800 }), EngineTimeoutError);
  s.setControl({});
  await s.client.analyze(req(s), hooks());
  assert.equal(launches(s.counter), 2, 'the busy process was recycled');
});

test('stderr lines are logged with [engine] and delivered to every in-flight analysis', async () => {
  const s = setup({ stderr: ['java.lang.IllegalStateException: boom'] });
  const lines: string[] = [];
  await s.client.analyze(req(s), hooks([], lines));
  await new Promise((r) => setTimeout(r, 100));
  assert.ok(s.logs.includes('[engine] java.lang.IllegalStateException: boom'), s.logs.join('\n'));
  assert.deepEqual(lines, ['java.lang.IllegalStateException: boom']);
});

// --- 010-modernization-ux: generic tool calls and resources --------------------------------------------

test('callTool returns the text and warnings of a tool and records the arguments', async () => {
  const s = setup({});
  const log = path.join(s.dir, 'calls.jsonl');
  s.setControl({ callsLog: log });
  const r = await s.client.callTool('score_proposal', { jobId: 'j1', components: ['a.A'] }, 20_000);
  assert.equal(JSON.parse(r.text).name, 'Propuesta editada');
  assert.deepEqual(r.warnings, []);
  const calls = readFileSync(log, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  assert.deepEqual(calls.pop(), { name: 'score_proposal', args: { jobId: 'j1', components: ['a.A'] } });
});

test('callTool raises EngineToolError with the engine message', async () => {
  const s = setup({ reinferFail: 'Invalid inference configuration: x: unknown parameter' });
  await assert.rejects(s.client.callTool('reinfer_architecture', { jobId: 'j' }, 20_000), (e: unknown) =>
    e instanceof EngineToolError && e.message === 'Invalid inference configuration: x: unknown parameter');
});

test('readResource returns the text of a resource', async () => {
  const s = setup({});
  const text = await s.client.readResource('static-inference://configuration/defaults');
  assert.equal(JSON.parse(text).viability.thresholds.high, 0.7);
});
