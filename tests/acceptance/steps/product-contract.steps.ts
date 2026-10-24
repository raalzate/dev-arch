// US4 — Data contract at product level (TS-020..TS-024).
import { Before, Given, Then, When } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { layout, engineOriginRepo, PRODUCT_REL } from '../support/layout.ts';
import { git, gitOk, trackedFiles } from '../support/git.ts';
import { run } from '../support/process.ts';
import { assertionHash } from '../support/iikit-hash.ts';
import { tempDir } from '../support/tools.ts';
import { commandEnv } from './build-and-test.steps.ts';
import type { DevArchWorld } from '../support/world.ts';

const FRONT_LINE = /^\[schema-check\] (version|java|dotnet|ts): (OK|FAIL|NOT VERIFIED)( — .*)?$/;

/** Copy of the product (tracked and untracked, non-ignored files), as the 005 schema-check scenarios do. */
function copyProduct(): string {
  const files = git(['ls-files', '-z', '-co', '--exclude-standard'], layout.productRoot).split('\0').filter(Boolean);
  const copy = tempDir('product-copy');
  for (const f of files) {
    const from = path.join(layout.productRoot, f);
    if (!existsSync(from)) continue;
    const to = path.join(copy, f);
    mkdirSync(path.dirname(to), { recursive: true });
    copyFileSync(from, to);
  }
  return copy;
}

// make schema-check reinstalls the npm workspace: run it on a copy, never under the running suite.
Before({ tags: '@TS-020 or @TS-021' }, function (this: DevArchWorld) {
  const copy = copyProduct();
  this.data.workCopy = copy;
  this.cleanup.push(copy);
  this.env.MVN_ARGS = '-o';
});

function frontLines(world: DevArchWorld): string[] {
  return world.result!.output.split('\n').filter((l) => l.startsWith('[schema-check] ') && !l.startsWith('[schema-check]   '));
}

function frontStatus(world: DevArchWorld, front: string): string {
  const line = frontLines(world).find((l) => l.startsWith(`[schema-check] ${front}:`));
  assert.ok(line, `no line for front ${front}:\n${world.result!.output.slice(-4000)}`);
  const m = FRONT_LINE.exec(line);
  assert.ok(m, `malformed front line: ${line}`);
  return m[2];
}

// --- TS-020 / TS-021 ---------------------------------------------------------------------------------

Then(
  'it reports {string} for the fronts {string}, {string}, {string} and {string}',
  function (this: DevArchWorld, status: string, a: string, b: string, c: string, d: string) {
    for (const front of [a, b, c, d]) assert.equal(frontStatus(this, front), status, `front ${front}`);
  },
);

Then('it reports {string} for the front {string}', function (this: DevArchWorld, status: string, front: string) {
  assert.equal(frontStatus(this, front), status, this.result!.output.slice(-4000));
});

Then('the last line is {string}', function (this: DevArchWorld, line: string) {
  const lines = frontLines(this);
  assert.equal(lines[lines.length - 1], line);
  assert.equal(this.result!.code, 0, this.result!.output.slice(-4000));
});

function replaceInCopy(world: DevArchWorld, relative: string, target: string, replacement: string): void {
  const file = path.join(world.data.workCopy as string, relative);
  const content = readFileSync(file, 'utf8');
  assert.ok(content.includes(target), `${relative} does not contain ${target}`);
  writeFileSync(file, content.replace(target, replacement));
}

Given('a contract version different from the Java declared version is introduced', function (this: DevArchWorld) {
  const version = readFileSync(path.join(layout.schemaDir, 'VERSION'), 'utf8').trim();
  replaceInCopy(this, 'engine/src/main/java/com/extractor/model/SchemaVersion.java', `CURRENT = "${version}"`, 'CURRENT = "9.9.9"');
});

Given('a contract change without regenerating the generated types is introduced', function (this: DevArchWorld) {
  const version = readFileSync(path.join(layout.schemaDir, 'VERSION'), 'utf8').trim();
  replaceInCopy(this, `schema/${version}/common.schema.json`, 'Unit of analysis (class/interface/enum or .NET type).',
    'Unit of analysis (class, interface, enum or .NET type) — divergent description.');
});

// --- TS-022 ------------------------------------------------------------------------------------------

const CONTRACT_PACKAGE = '@static-inference/schema';

Given('the web package manifest', function (this: DevArchWorld) {
  this.data.webManifest = JSON.parse(readFileSync(path.join(layout.webDir, 'package.json'), 'utf8'));
});

When('the dependency on the contract package is resolved', function (this: DevArchWorld) {
  const manifest = this.data.webManifest as { dependencies?: Record<string, string> };
  assert.ok(manifest.dependencies?.[CONTRACT_PACKAGE], `the web does not depend on ${CONTRACT_PACKAGE}`);
  const lock = JSON.parse(readFileSync(path.join(layout.productRoot, 'package-lock.json'), 'utf8'));
  this.data.lockEntry = lock.packages?.[`node_modules/${CONTRACT_PACKAGE}`];
  const installed = path.join(layout.productRoot, 'node_modules', ...CONTRACT_PACKAGE.split('/'));
  this.data.installed = existsSync(installed) ? realpathSync(installed) : null;
});

Then('it resolves to the product {string} folder', function (this: DevArchWorld, folder: string) {
  const entry = this.data.lockEntry as { link?: boolean; resolved?: string } | undefined;
  assert.ok(entry, `${CONTRACT_PACKAGE} is not in the lock file`);
  assert.equal(entry.link, true, 'the contract package is not a workspace link');
  assert.equal(entry.resolved, folder);
  if (this.data.installed) assert.equal(this.data.installed, realpathSync(path.join(layout.productRoot, folder)));
});

Then('no external registry is queried for it', function (this: DevArchWorld) {
  const entry = this.data.lockEntry as { resolved?: string; integrity?: string };
  assert.ok(!/^https?:/.test(entry.resolved ?? ''), `resolved from a registry: ${entry.resolved}`);
  assert.equal(entry.integrity, undefined, 'a registry tarball integrity is recorded for the contract package');
});

// --- TS-023 ------------------------------------------------------------------------------------------

Given('the engine area', function (this: DevArchWorld) {
  assert.ok(existsSync(path.join(layout.engineRoot, 'pom.xml')), 'no engine/pom.xml');
});

When(
  'the engine contract tests are executed from the engine folder without extra properties',
  function (this: DevArchWorld) {
    this.result = run('mvn', ['-B', '-q', '-o', 'test', '-Dgroups=schema-contract'], {
      cwd: layout.engineRoot,
      env: commandEnv(this),
      timeoutMs: 30 * 60 * 1000,
    });
  },
);

Then('they load the contract version from the product {string} folder', function (this: DevArchWorld, folder: string) {
  const reports = path.join(layout.engineRoot, 'target', 'surefire-reports');
  const report = readdirSync(reports).find((f) => f === 'TEST-com.extractor.schema.SchemaVersionContractTest.xml');
  assert.ok(report, 'SchemaVersionContractTest did not run');
  const xml = readFileSync(path.join(reports, report), 'utf8');
  const schemaDir = /<property name="schema\.dir" value="([^"]+)"/.exec(xml)?.[1];
  assert.ok(schemaDir, 'schema.dir is not set for the engine tests');
  assert.equal(path.resolve(schemaDir), path.join(layout.productRoot, folder));
});

Then('they pass', function (this: DevArchWorld) {
  assert.equal(this.result!.code, 0, this.result!.output.slice(-4000));
});

// --- TS-024 ------------------------------------------------------------------------------------------

const ASSERTION = /\bassert\w*\s*\(|\bAssert\.|\.Should\(\)|\bassume\w*\s*\(|@(Given|When|Then)\(|\[(Fact|Theory)\b|\bexpect\(/;

/** Original engine tree: `base` is the folder of that tree holding the original repository root. */
interface Origin { repo: string; ref: string; base: string }

function originOf(): Origin {
  const origin = engineOriginRepo();
  if (origin) return { repo: origin, ref: 'main', base: '' };
  // 014-standalone-repo: the engine origin history was not extracted; the import commit (git subtree add, message
  // kept by the extraction) holds the imported original repository under engine/.
  const commit = git(['log', '--format=%H', '-1', '--grep=^git-subtree-dir: .*engine$', 'HEAD'], layout.monorepoRoot);
  assert.ok(commit, 'no engine subtree import recorded');
  return { repo: layout.monorepoRoot, ref: commit, base: 'engine/' };
}

/** Test sources of the original repository and their location in the product. */
const TEST_ROOTS: [string, string][] = [
  ['src/test', `engine/src/test`],
  ['schema/test', `schema/test`],
];

Given('the engine test sources and the specifications 001 to 005 as imported', function (this: DevArchWorld) {
  this.data.origin = originOf();
});

When('they are compared with the original engine repository', function (this: DevArchWorld) {
  const { repo, ref, base } = this.data.origin as Origin;
  const assertionDiffs: string[] = [];
  for (const [from, to] of TEST_ROOTS) {
    for (const file of trackedFiles(repo, ref, base + from).filter((f) => /\.(java|cs|ts)$/.test(f))) {
      const target = `${to}/${file.slice(base.length + from.length + 1)}`;
      assert.ok(gitOk(['cat-file', '-e', `HEAD:${target}`], layout.monorepoRoot), `test source lost: ${target}`);
      const lines = (src: string) => src.split('\n').map((l) => l.trim()).filter((l) => ASSERTION.test(l)).sort();
      const before = lines(git(['show', `${ref}:${file}`], repo));
      const after = lines(git(['show', `HEAD:${target}`], layout.monorepoRoot));
      if (JSON.stringify(before) !== JSON.stringify(after)) assertionDiffs.push(target);
    }
  }
  this.data.assertionDiffs = assertionDiffs;
  const featureDiffs: string[] = [];
  const contextDiffs: string[] = [];
  for (const spec of git(['ls-tree', '--name-only', `${ref}:${base}specs`], repo).split('\n').filter((s) => /^00[1-5]-/.test(s))) {
    for (const file of trackedFiles(repo, ref, `${base}specs/${spec}`)) {
      const target = file.slice(base.length);
      const blob = (r: string, rf: string, p: string) => (gitOk(['cat-file', '-e', `${rf}:${p}`], r) ? git(['rev-parse', `${rf}:${p}`], r) : 'missing');
      const same = blob(repo, ref, file) === blob(layout.monorepoRoot, 'HEAD', target);
      if (file.endsWith('.feature') && !same) featureDiffs.push(target);
      if (file.endsWith('context.json') && !same) contextDiffs.push(target);
    }
  }
  this.data.featureDiffs = featureDiffs;
  this.data.contextDiffs = contextDiffs;
});

Then('no assertion statement differs', function (this: DevArchWorld) {
  assert.deepEqual(this.data.assertionDiffs, [], 'assertion statements changed');
});

Then('no {string} file differs', function (this: DevArchWorld, ext: string) {
  assert.equal(ext, '.feature');
  assert.deepEqual(this.data.featureDiffs, [], '.feature files changed');
});

Then('no assertion integrity hash differs', function (this: DevArchWorld) {
  assert.deepEqual(this.data.contextDiffs, [], 'context.json files changed');
  for (const dir of readdirSync(path.join(layout.productRoot, 'specs')).filter((s) => /^00[1-5]-/.test(s))) {
    const context = JSON.parse(readFileSync(path.join(layout.productRoot, 'specs', dir, 'context.json'), 'utf8'));
    const expected = context?.testify?.assertion_hash;
    if (!expected) continue;
    assert.equal(assertionHash(path.join(layout.productRoot, 'specs', dir, 'tests', 'features')), expected, dir);
  }
});
