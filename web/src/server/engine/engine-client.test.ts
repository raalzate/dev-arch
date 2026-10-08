// Engine client over MCP stdio, tested against the stub engine (007, contracts/engine-client.md). Run: npm test -w web
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EngineClient, EngineToolError, type EngineLaunchSpec } from './engine-client.ts';

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
  const client = new EngineClient(launch);
  clients.push(client);
  const project = path.join(dir, 'project');
  mkdirSync(project);
  return { dir, ctl, counter, client, project, out: path.join(dir, 'out'),
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
