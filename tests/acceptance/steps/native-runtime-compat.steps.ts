// US8 — Existing synchronous analysis clients keep working (007 TS-073, TS-074, TS-076).
// TS-075 is a browser scenario; TS-077 reuses the 006 continuous-integration steps entirely.
import { Given, Then, When } from '@cucumber/cucumber';
import AdmZip from 'adm-zip';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { git, gitOk } from '../support/git.ts';
import { assertionHash } from '../support/iikit-hash.ts';
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
// The only admitted change to locked 001-006 artifacts is the re-testify of 006 TS-042 (evaluated at the 006
// baseline tag), recorded in the 006 specification: its scenario block, the 006 context.json hash and the TS-042
// section of its step definitions. Everything else must be identical to the baseline tag.

const RESTRUCT_FEATURE = 'apps/dev-arch/specs/006-devarch-monorepo/tests/features/repository-structure.feature';
const RESTRUCT_STEPS = 'apps/dev-arch/tests/acceptance/steps/repository-structure.steps.ts';
const CONTEXT_006 = 'apps/dev-arch/specs/006-devarch-monorepo/context.json';

/** Removes the TS-042 scenario block (from its tag line to the next blank line) of a feature text. */
function withoutTs042Scenario(text: string): string {
  return text.replace(/\n  @TS-042 [^\n]*\n(?:[^\n]+\n)*/, '\n');
}

/** Keeps the step definitions before the TS-042 section (the last section of the file). */
function beforeTs042Section(text: string): string {
  const i = text.indexOf('// --- TS-042');
  return i < 0 ? text : text.slice(0, i);
}

When('the product is compared with the 006 baseline tag {string}', function (this: DevArchWorld, tag: string) {
  const repo = layout.monorepoRoot;
  assert.ok(gitOk(['rev-parse', '--verify', '--quiet', `refs/tags/${tag}^{commit}`], repo),
    `the baseline tag ${tag} is missing (see docs/BASELINES.md; fetch it with: git fetch origin tag ${tag})`);
  const rel = (p: string) => `apps/dev-arch/${p}`;
  const changed = (paths: string[]) => git(['diff', '--name-only', '--diff-filter=MDR', `${tag}`, '--', ...paths], repo)
    .split('\n').filter(Boolean);
  this.data.baselineTag = tag;
  this.data.lockedChanges = {
    specs: changed(['001', '002', '003', '004', '005', '006'].map((n) => rel(`specs/${n}-*`)))
      .filter((f) => f.endsWith('.feature') || f.endsWith('context.json')),
    tests: changed([rel('engine/src/test'), rel('tests/acceptance'), rel('schema/test'), rel('web/src')])
      .filter((f) => !f.includes('/web/src/') || f.endsWith('.test.ts')),
  };
});

Then('no {string} file, {string} assertion hash or test assertion of features 001 to 006 has changed, except the scenario {string} of 006 re-testified and recorded in its specification', function (this: DevArchWorld, _feature: string, _context: string, scenario: string) {
  assert.equal(scenario, 'TS-042');
  const repo = layout.monorepoRoot;
  const tag = this.data.baselineTag as string;
  const c = this.data.lockedChanges as { specs: string[]; tests: string[] };
  const atTag = (f: string) => git(['show', `${tag}:${f}`], repo);
  const now = (f: string) => readFileSync(path.join(repo, f), 'utf8').replace(/\n$/, '');
  const unexpectedSpecs = c.specs.filter((f) => f !== RESTRUCT_FEATURE && f !== CONTEXT_006);
  assert.deepEqual(unexpectedSpecs, [], 'locked .feature/context.json files of 001-006 changed');
  if (c.specs.includes(RESTRUCT_FEATURE)) {
    assert.equal(withoutTs042Scenario(now(RESTRUCT_FEATURE)), withoutTs042Scenario(atTag(RESTRUCT_FEATURE)),
      'repository-structure.feature changed outside TS-042');
    const spec = now('apps/dev-arch/specs/006-devarch-monorepo/spec.md');
    assert.match(spec, /re-testify[^\n]*\n\n- Q:[^\n]*TS-042/, 'the re-testify of TS-042 is not recorded in the 006 specification');
  }
  const unexpectedTests = c.tests.filter((f) => f !== RESTRUCT_STEPS);
  assert.deepEqual(unexpectedTests, [], 'test files of 001-006 were modified or deleted');
  if (c.tests.includes(RESTRUCT_STEPS)) {
    assert.equal(beforeTs042Section(now(RESTRUCT_STEPS)), beforeTs042Section(atTag(RESTRUCT_STEPS)),
      'repository-structure.steps.ts changed outside the TS-042 section');
  }
});

Then('every assertion integrity hash of features 001 to 006 verifies', function (this: DevArchWorld) {
  let verified = 0;
  for (const name of readdirSync(path.join(layout.productRoot, 'specs')).filter((n) => /^00[1-6]-/.test(n))) {
    const dir = path.join(layout.productRoot, 'specs', name);
    const ctx = path.join(dir, 'context.json');
    if (!existsSync(ctx)) continue;
    const expected = JSON.parse(readFileSync(ctx, 'utf8'))?.testify?.assertion_hash as string | undefined;
    if (!expected) continue;
    assert.equal(assertionHash(path.join(dir, 'tests', 'features')), expected, `assertion hash of ${name}`);
    verified++;
  }
  assert.ok(verified >= 4, `only ${verified} hashes verified`);
});
