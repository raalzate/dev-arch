// BUG-012 (014-standalone-repo): the bridge starts when it is launched through a symbolic link (macOS temporary
// folders, ~/ paths behind links): the entry-point check compares real paths.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import webPackage from '../../../package.json';
import { BRIDGE } from '../testing/agent-http.test.ts';

test('the bridge answers --version when launched through a symbolic link', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'devarch-bug012-'));
  try {
    const link = path.join(dir, 'dev-arch-mcp.mjs');
    symlinkSync(BRIDGE, link);
    const out = execFileSync(process.execPath, [link, '--version'], { encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '' } });
    assert.equal(out.trim(), webPackage.version);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
