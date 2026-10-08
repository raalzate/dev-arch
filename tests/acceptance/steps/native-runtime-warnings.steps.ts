// US6 (web side) — warnings shown by the web and web/CLI parity (007 TS-062, TS-065; TS-063 is a browser scenario).
import { Given, Then, When } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, realpathSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { layout } from '../support/layout.ts';
import { runOk } from '../support/process.ts';
import { jdk17Home } from '../support/tools.ts';
import type { DevArchWorld } from '../support/world.ts';
import { redactDocument } from '../../../web/src/server/security/path-redaction.ts';
import { api, jobId, smallZip, startHarness, startRealWeb, status, submitZip, waitForJob } from './native-runtime-common.steps.ts';

// --- TS-062 ---------------------------------------------------------------------------------------------

Given('the web server is running with a stub engine that reports the warning {string}', async function (this: DevArchWorld, warning: string) {
  await startHarness(this, { control: { warnings: [warning] } });
});

When('an analysis is submitted and completes', async function (this: DevArchWorld) {
  const r = await submitZip(this, smallZip());
  assert.equal(r.status, 202, r.text);
  assert.equal((await waitForJob(this, jobId(this))).status, 'completed');
});

Then('the analysis status lists the warning {string}', async function (this: DevArchWorld, warning: string) {
  assert.deepEqual((await status(this, jobId(this))).warnings, [warning]);
});

// --- TS-065 ---------------------------------------------------------------------------------------------

Given('the web server runs with local folder analysis {string} and the built engine', async function (this: DevArchWorld, mode: string) {
  await startRealWeb(this, { DEVARCH_ALLOW_LOCAL_PATH: mode === 'enabled' ? 'true' : 'false' });
});

When('the local folder of the demo project {string} is analyzed through the web', async function (this: DevArchWorld, project: string) {
  const folder = path.join(layout.engineRoot, 'test-for-demo', project);
  this.data.localFolder = folder;
  const r = await api(this).call('POST', '/api/analyses', {
    body: JSON.stringify({ localPath: folder }), headers: { 'content-type': 'application/json' },
  });
  assert.equal(r.status, 202, r.text);
  this.data.jobId = r.json.jobId;
  assert.equal((await waitForJob(this, jobId(this), undefined, 10 * 60_000)).status, 'completed');
});

When('the same folder is analyzed with the command line', function (this: DevArchWorld) {
  const out = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'devarch-007-cli-')));
  this.cleanup.push(out);
  const jdk = jdk17Home();
  const java = jdk ? path.join(jdk, 'bin', 'java') : 'java';
  runOk(java, ['-jar', path.join(layout.engineDist, 'engine.jar'), this.data.localFolder as string, path.join(out, 'output.json')],
    { cwd: out, timeoutMs: 10 * 60_000 });
  this.data.cliOut = out;
});

Then('the three documents of the web analysis are byte-identical to the command-line documents with the same path relativization applied', async function (this: DevArchWorld) {
  const folder = this.data.localFolder as string;
  const roots = [folder, realpathSync(folder)];
  const files: Record<string, string> = { graph: 'output.json', architecture: 'output_architecture.json', contracts: 'output_entrypoints.json' };
  for (const [doc, file] of Object.entries(files)) {
    const web = await api(this).call('GET', `/api/analyses/${jobId(this)}/${doc}`);
    assert.equal(web.status, 200, web.text.slice(0, 300));
    const cli = redactDocument(readFileSync(path.join(this.data.cliOut as string, file), 'utf8'), roots);
    assert.equal(web.text, cli, `${doc} differs from the command line`);
  }
});
