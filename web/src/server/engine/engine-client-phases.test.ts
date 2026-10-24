// BUG-010 (014-standalone-repo): progress notifications that arrive in the same stdout chunk as the answer are
// dispatched by the MCP SDK after the answer removed the progress handler; a completed analysis still reports every
// phase, in order.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EngineClient } from './engine-client.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const FAKE = path.resolve(here, '../../../../tests/acceptance/support/fake-mcp-server.mjs');

test('a completed analysis reports the four phases in order even when they arrive with the answer', async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'devarch-bug010-'));
  const ctl = path.join(dir, 'control.json');
  writeFileSync(ctl, JSON.stringify({ burst: true }));
  const project = path.join(dir, 'project');
  mkdirSync(project);
  const client = new EngineClient(
    () => ({ command: process.execPath, args: [FAKE], env: { ...(process.env as Record<string, string>), NODE_OPTIONS: '', FAKE_ENGINE_CONTROL: ctl } }),
    () => undefined,
    { backoffMs: [50, 100, 200] },
  );
  try {
    for (let i = 0; i < 5; i++) {
      const phases: string[] = [];
      await client.analyze(
        { jobId: `j${i}`, projectPath: project, outputDir: path.join(dir, `out${i}`), language: 'auto' },
        { onPhase: (p) => phases.push(p), onStderr: () => undefined, timeoutMs: 20_000 },
      );
      assert.deepEqual(phases, ['detection', 'extraction', 'inference', 'writing'], `run ${i}`);
    }
  } finally {
    await client.shutdown();
    rmSync(dir, { recursive: true, force: true });
  }
});
