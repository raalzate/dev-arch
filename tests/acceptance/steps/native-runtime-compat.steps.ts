// US8 — Existing synchronous analysis clients keep working (007 TS-073, TS-074, TS-076).
// TS-075 is a browser scenario; TS-077 reuses the 006 continuous-integration steps entirely.
import { Given, Then, When } from '@cucumber/cucumber';
import AdmZip from 'adm-zip';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { git, gitOk } from '../support/git.ts';
import { layout } from '../support/layout.ts';
import type { DevArchWorld } from '../support/world.ts';
import { api, harness, lastResponse, startHarness } from './native-runtime-common.steps.ts';

function fakeJava(world: DevArchWorld, body: string): void {
  const h = harness(world);
  const jdk = path.join(h.root, 'sync-jdk');
  mkdirSync(path.join(jdk, 'bin'), { recursive: true });
  const java = path.join(jdk, 'bin', 'java');
  writeFileSync(java, `#!/usr/bin/env node\nconst fs = require('fs');\nconst path = require('path');\n${body}\n`);
  chmodSync(java, 0o755);
  h.setEnv('JAVA_HOME', jdk);
  h.setEnv('NODE_OPTIONS', undefined);
  world.data.argsFile = path.join(jdk, 'args.json');
}

function syncForm(root: string): FormData {
  const zip = new AdmZip();
  zip.addFile(`${root}/pom.xml`, Buffer.from('<project/>'));
  zip.addFile(`${root}/src/App.java`, Buffer.from('class App {}'));
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(zip.toBuffer())]), `${root}.zip`);
  return form;
}

Given('a fake Java runtime that records its arguments and writes the result documents in its working directory', async function (this: DevArchWorld) {
  await startHarness(this);
  fakeJava(this, `fs.writeFileSync(${JSON.stringify(path.join(harness(this).root, 'sync-jdk', 'args.json'))}, JSON.stringify(process.argv.slice(2)));
fs.writeFileSync('output.json', JSON.stringify({ components: [{ id: 'demo.App' }], edges: [], meta: { schema_version: '1.0.0' } }));
fs.writeFileSync('output_architecture.json', JSON.stringify({ proposals: [{ id: 1 }] }));`);
});

When('a ZIP is posted to the synchronous analysis interface', async function (this: DevArchWorld) {
  this.data.response = await api(this).call('POST', '/api/analyze', { body: syncForm('demo') });
});

Then('the response status is {int} with the components data and the architecture data', function (this: DevArchWorld, code: number) {
  const r = lastResponse(this);
  assert.equal(r.status, code, r.text);
  assert.equal(r.json.componentsData?.meta?.schema_version, '1.0.0');
  assert.ok(Array.isArray(r.json.archData?.proposals));
});

Then('the engine received exactly the arguments {string}, the engine archive, the project root and {string}', function (this: DevArchWorld, first: string, last: string) {
  const args = JSON.parse(readFileSync(this.data.argsFile as string, 'utf8')) as string[];
  assert.equal(args.length, 4, JSON.stringify(args));
  assert.equal(args[0], first);
  assert.equal(args[1], process.env.ENGINE_JAR_PATH);
  assert.equal(path.basename(args[2]), 'demo');
  assert.ok(args[2].startsWith(path.join(harness(this).dataDir, 'jobs')), args[2]);
  assert.equal(args[3], last);
});

Then('the response declares the interface as deprecated with a link to its successor', function (this: DevArchWorld) {
  const r = lastResponse(this);
  assert.equal(r.headers.get('deprecation'), 'true');
  assert.match(r.headers.get('link') ?? '', /<\/api\/analyses>;\s*rel="successor-version"/);
});

Given('a fake Java runtime that writes result documents naming the project it received', async function (this: DevArchWorld) {
  await startHarness(this);
  // Slow enough that both requests overlap; each writes its documents in its own working directory.
  fakeJava(this, `const name = path.basename(process.argv[4]);
setTimeout(() => {
  fs.writeFileSync('output.json', JSON.stringify({ components: [{ id: name + '.App' }], edges: [], meta: { schema_version: '1.0.0', project: name } }));
  fs.writeFileSync('output_architecture.json', JSON.stringify({ proposals: [{ id: 1, name }] }));
}, 500);`);
});

When('two ZIPs of different projects are posted to the synchronous analysis interface at the same time', async function (this: DevArchWorld) {
  const [a, b] = await Promise.all(['alpha', 'beta'].map((p) => api(this).call('POST', '/api/analyze', { body: syncForm(p) })));
  this.data.syncResponses = { alpha: a, beta: b };
});

Then('each response contains only the data of its own project', function (this: DevArchWorld) {
  for (const [name, r] of Object.entries(this.data.syncResponses as Record<string, { status: number; json: any; text: string }>)) {
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.componentsData.meta.project, name);
    assert.deepEqual(r.json.componentsData.components.map((c: { id: string }) => c.id), [`${name}.App`]);
    assert.equal(r.json.archData.proposals[0].name, name);
  }
});

Then('the server working directory contains no {string} or {string}', function (this: DevArchWorld, a: string, b: string) {
  for (const f of [a, b]) assert.equal(existsSync(path.join(harness(this).webCwd, f)), false, f);
});

// --- TS-076 ---------------------------------------------------------------------------------------------

When('the product is compared with the 006 baseline tag {string}', function (this: DevArchWorld, tag: string) {
  const repo = layout.monorepoRoot;
  assert.ok(gitOk(['rev-parse', '--verify', '--quiet', `refs/tags/${tag}^{commit}`], repo),
    `the baseline tag ${tag} is missing (see docs/BASELINES.md; fetch it with: git fetch origin tag ${tag})`);
  const rel = (p: string) => `apps/dev-arch/${p}`;
  const changed = (paths: string[]) => git(['diff', '--name-only', '--diff-filter=MDR', `${tag}`, '--', ...paths], repo)
    .split('\n').filter(Boolean);
  this.data.lockedChanges = {
    specs: changed(['001', '002', '003', '004', '005', '006'].map((n) => rel(`specs/${n}-*`)))
      .filter((f) => f.endsWith('.feature') || f.endsWith('context.json')),
    tests: changed([rel('engine/src/test'), rel('tests/acceptance'), rel('schema/test'), rel('web/src')])
      .filter((f) => !f.includes('/web/src/') || f.endsWith('.test.ts')),
  };
});

Then('no {string} file, {string} assertion hash or test assertion of features 001 to 006 has changed', function (this: DevArchWorld, _feature: string, _context: string) {
  const c = this.data.lockedChanges as { specs: string[]; tests: string[] };
  assert.deepEqual(c.specs, [], 'locked .feature/context.json files of 001-006 changed');
  assert.deepEqual(c.tests, [], 'test files of 001-006 were modified or deleted');
});
