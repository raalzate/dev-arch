// 013-agent-mcp-bridge guards (TS-033, TS-034): strictly additive, engine MCP tools unchanged.
import { Then, When } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { git, gitOk } from '../support/git.ts';
import { layout, PRODUCT_REL } from '../support/layout.ts';
import type { DevArchWorld } from '../support/world.ts';

/** Closing commit of feature 012 (T017-T019 verified on a clean clone), the base of this feature. */
export const DELIVERY_012_COMMIT = '22e8471';

type Change = { status: string; file: string };

When('the product is compared with the closing commit of feature 012', function (this: DevArchWorld) {
  const repo = layout.monorepoRoot;
  assert.ok(gitOk(['cat-file', '-e', `${DELIVERY_012_COMMIT}^{commit}`], repo), `commit ${DELIVERY_012_COMMIT} of feature 012 is not available`);
  const diff = git(['diff', '--name-status', '--no-renames', DELIVERY_012_COMMIT, 'HEAD', '--', PRODUCT_REL], repo);
  const changes = diff.split('\n').filter(Boolean).map((l) => {
    const [status, file] = l.split('\t');
    return { status, file: file.slice(PRODUCT_REL.length + 1) };
  });
  // The shared 012 step "no existing step definition or test source file was modified or deleted" reads diff011.
  this.data.diff011 = changes;
  this.data.diff012 = changes;
});

const changed = (w: DevArchWorld) => (w.data.diff012 as Change[]).filter((c) => c.status !== 'A');

Then('no {string} file, {string} or specification file of features 001 to 012 was modified or deleted', function (this: DevArchWorld, ext: string, ctx: string) {
  const locked = /^specs\/(00[1-9]|01[012])-[^/]+\/(.*)$/;
  const bad = changed(this).filter((c) => {
    const m = locked.exec(c.file);
    if (!m) return false;
    return m[2].endsWith(ext) || path.basename(m[2]) === ctx || m[2] === 'spec.md';
  });
  assert.deepEqual(bad, []);
});

Then('Compose and the engine sources are unchanged', function (this: DevArchWorld) {
  const touched = (this.data.diff012 as Change[]).filter((c) => c.file.startsWith('docker/') || c.file.startsWith('engine/src/'));
  assert.deepEqual(touched, []);
});

// --- TS-034 ---------------------------------------------------------------------------------------------------

function engineTools(jar: string, env: NodeJS.ProcessEnv): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const child = spawn('java', ['-jar', jar, '--mcp'], { stdio: ['pipe', 'pipe', 'pipe'], env });
    let buffer = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('the engine MCP server did not answer tools/list'));
    }, 60_000);
    const send = (m: unknown) => child.stdin.write(`${JSON.stringify(m)}\n`);
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
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'devarch-013', version: '0' } } });
  });
}

When('the engine MCP server lists its tools', async function (this: DevArchWorld) {
  const jar = this.data.jar as string;
  this.data.engineTools = {
    default: await engineTools(jar, { ...process.env, STATIC_INFERENCE_INFERENCE_TOOLS: undefined }),
    optIn: await engineTools(jar, { ...process.env, STATIC_INFERENCE_INFERENCE_TOOLS: 'true' }),
  };
});

Then('they are exactly the tools of the engine before feature 013', function (this: DevArchWorld) {
  const repo = layout.monorepoRoot;
  const listed = git(['ls-tree', '--name-only', `${DELIVERY_012_COMMIT}:${PRODUCT_REL}/schema/1.0.0/mcp`], repo)
    .split('\n').filter((f) => f.endsWith('.response.schema.json')).map((f) => f.replace('.response.schema.json', '')).sort();
  const tools = this.data.engineTools as { default: string[]; optIn: string[] };
  assert.deepEqual(tools.optIn, listed);
  assert.deepEqual(tools.default, listed.filter((t) => t !== 'reinfer_architecture' && t !== 'score_proposal'));
});
