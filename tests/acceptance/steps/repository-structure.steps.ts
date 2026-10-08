// US1 — Single product with the engine history preserved (TS-001..TS-005, TS-042).
import { Given, Then, When } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ALLOWED_ROOT_ENTRIES, AREAS, PRODUCT_REL, engineOriginRepo, layout } from '../support/layout.ts';
import { git, gitOk, revList, rootEntries, trackedFiles } from '../support/git.ts';
import { assertionHash } from '../support/iikit-hash.ts';
import type { DevArchWorld } from '../support/world.ts';

const ENGINE_PREFIX = `${PRODUCT_REL}/engine`;
const ANALYSIS_SERVICE = 'src/main/java/com/extractor/service/AnalysisService.java';
const PREVIOUS_SPECS = ['001', '002', '003', '004', '005'];

interface SubtreeImport {
  /** Monorepo commit before the engine import (web imported as-is). */
  mainline: string;
  /** Engine origin commit imported. */
  split: string;
}

/** Engine subtree import recorded by `git subtree add` in the history of the checkout under test. */
function subtreeImport(repo: string): SubtreeImport {
  const body = git(['log', '--format=%B', `--grep=git-subtree-dir: ${ENGINE_PREFIX}`, 'HEAD'], repo);
  const mainline = /git-subtree-mainline: ([0-9a-f]{40})/.exec(body)?.[1];
  const split = /git-subtree-split: ([0-9a-f]{40})/.exec(body)?.[1];
  assert.ok(mainline && split, `no git subtree import of ${ENGINE_PREFIX} found in the history`);
  return { mainline, split };
}

/** Engine version declared by the pom.xml of an engine commit (empty when absent). */
function pomVersion(repo: string, commit: string): string {
  if (!gitOk(['cat-file', '-e', `${commit}:pom.xml`], repo)) return '';
  const pom = git(['show', `${commit}:pom.xml`], repo);
  return /<artifactId>java-dependency-extractor<\/artifactId>\s*<version>([^<]+)<\/version>/.exec(pom)?.[1] ?? '';
}

// --- TS-001 -----------------------------------------------------------------------------------------

When('the product folder is listed', function (this: DevArchWorld) {
  this.data.entries = rootEntries(this.monorepo, this.commit, PRODUCT_REL);
});

Then(
  'it contains the directories {string}, {string}, {string}, {string}, {string} and {string}',
  function (this: DevArchWorld, a: string, b: string, c: string, d: string, e: string, f: string) {
    const entries = this.data.entries as { name: string; type: string }[];
    for (const dir of [a, b, c, d, e, f]) {
      assert.ok(entries.some((x) => x.name === dir && x.type === 'tree'), `missing area directory ${dir}`);
    }
  },
);

Then(
  'it contains {string}, {string} and the directory {string} at its root',
  function (this: DevArchWorld, f1: string, f2: string, dir: string) {
    const entries = this.data.entries as { name: string; type: string }[];
    for (const file of [f1, f2]) {
      assert.ok(entries.some((x) => x.name === file && x.type === 'blob'), `missing ${file} at the product root`);
    }
    assert.ok(entries.some((x) => x.name === dir && x.type === 'tree'), `missing directory ${dir}`);
  },
);

Then(
  'every other root entry belongs to the allowed governance, version, configuration, orchestration or acceptance-test entries',
  function (this: DevArchWorld) {
    const entries = this.data.entries as { name: string; type: string }[];
    const unexpected = entries
      .map((x) => x.name)
      .filter((name) => !(AREAS as readonly string[]).includes(name) && !(name in ALLOWED_ROOT_ENTRIES));
    assert.deepEqual(unexpected, [], `unexpected product root entries: ${unexpected.join(', ')}`);
  },
);

// --- TS-002 -----------------------------------------------------------------------------------------

Given('the main branch of the original Static Inference repository', function (this: DevArchWorld) {
  const repo = layout.monorepoRoot;
  const origin = engineOriginRepo();
  if (origin) {
    this.data.originCommits = revList(origin, 'main');
    this.data.releaseCommit = git(['rev-parse', 'v1.2.0^{commit}'], origin);
  } else {
    // Origin not on this machine (CI): the imported origin main as recorded by git subtree.
    const { split } = subtreeImport(repo);
    this.data.originCommits = revList(repo, split);
    const firstParent = revList(repo, split, ['--first-parent', '--reverse']);
    this.data.releaseCommit = firstParent.find((c) => pomVersion(repo, c) === '1.2.0');
  }
  assert.ok((this.data.originCommits as string[]).length >= 48, 'the origin main has at least 48 commits');
  assert.ok(this.data.releaseCommit, 'no commit releasing version 1.2.0 in the origin main');
});

When('its commits are looked up in the monorepo', function (this: DevArchWorld) {
  const reachable = new Set(revList(layout.monorepoRoot, 'HEAD'));
  const commits = this.data.originCommits as string[];
  this.data.missing = commits.filter((c) => !reachable.has(c));
});

Then('100% of them are reachable from the history of the engine area', function (this: DevArchWorld) {
  const missing = this.data.missing as string[];
  const total = (this.data.originCommits as string[]).length;
  assert.equal(missing.length, 0, `${missing.length}/${total} origin commits unreachable: ${missing.slice(0, 5)}`);
});

Then(
  'the history of the engine shared analysis service includes the commit that released version 1.2.0',
  function (this: DevArchWorld) {
    const history = git(
      ['log', '--full-history', '--format=%H', 'HEAD', '--', `${ENGINE_PREFIX}/${ANALYSIS_SERVICE}`, ANALYSIS_SERVICE],
      layout.monorepoRoot,
    ).split('\n');
    assert.ok(
      history.includes(this.data.releaseCommit as string),
      `release commit ${this.data.releaseCommit} not in the history of ${ANALYSIS_SERVICE}`,
    );
  },
);

// --- TS-003 -----------------------------------------------------------------------------------------

Given('the files tracked under the product folder', function (this: DevArchWorld) {
  this.data.tracked = trackedFiles(layout.monorepoRoot, 'HEAD', PRODUCT_REL);
  assert.ok((this.data.tracked as string[]).length > 0, 'nothing tracked under the product folder');
});

When('they are searched for Java executable archives and .NET analyzer executables', function (this: DevArchWorld) {
  this.data.binaries = (this.data.tracked as string[]).filter((f) => {
    const base = path.posix.basename(f);
    return /\.(jar|war|ear)$/i.test(base) || base === 'dotnet-analyzer' || base === 'dotnet-analyzer.exe';
  });
});

Then('none is found', function (this: DevArchWorld) {
  assert.deepEqual(this.data.binaries, [], 'analyzer binaries are versioned');
});

Then(
  'the vendored analyzer archive and the stale web entrypoints output are no longer tracked',
  function (this: DevArchWorld) {
    const tracked = new Set(this.data.tracked as string[]);
    for (const stale of ['java-dependency-extractor.jar', 'output_entrypoints.json']) {
      for (const where of [PRODUCT_REL, `${PRODUCT_REL}/web`]) {
        assert.ok(!tracked.has(`${where}/${stale}`), `${where}/${stale} is still tracked`);
      }
    }
  },
);

// --- TS-004 -----------------------------------------------------------------------------------------

Given(
  'the previous working copies of the engine and the web outside the product folder',
  function (this: DevArchWorld) {
    this.data.previous = ['project/static-inference', 'project/dev-arch'];
  },
);

When('the feature changes are compared against the monorepo main branch', function (this: DevArchWorld) {
  const repo = layout.monorepoRoot;
  const main = ['main', 'origin/main'].find((ref) => gitOk(['rev-parse', '--verify', '--quiet', ref], repo));
  assert.ok(main, 'no main branch of the monorepo (main or origin/main)');
  const base = git(['merge-base', main, 'HEAD'], repo);
  this.data.changes = git(['diff', '--name-status', base, 'HEAD', '--', ...(this.data.previous as string[])], repo);
});

Then('no file under those working copies is added, modified or deleted', function (this: DevArchWorld) {
  assert.equal(this.data.changes, '', `feature changes under the previous working copies:\n${this.data.changes}`);
  const origin = engineOriginRepo();
  if (origin) assert.ok(existsSync(path.join(origin, 'pom.xml')), `previous engine working copy ${origin} is gone`);
});

// --- TS-005 -----------------------------------------------------------------------------------------

Given('the specifications 001 to 005 of the original engine repository', function (this: DevArchWorld) {
  const origin = engineOriginRepo();
  const repo = origin ?? layout.monorepoRoot;
  const ref = origin ? 'main' : subtreeImport(layout.monorepoRoot).split;
  const specs = rootEntries(repo, ref, 'specs').filter((e) => PREVIOUS_SPECS.some((n) => e.name.startsWith(`${n}-`)));
  assert.equal(specs.length, PREVIOUS_SPECS.length, `specs 001-005 not found in the origin (${ref})`);
  this.data.originSpecs = Object.fromEntries(specs.map((e) => [e.name, git(['rev-parse', `${ref}:specs/${e.name}`], repo)]));
});

When('they are compared with the specifications at the product root', function (this: DevArchWorld) {
  const specs = this.data.originSpecs as Record<string, string>;
  this.data.productSpecs = Object.fromEntries(
    Object.keys(specs).map((name) => {
      const ok = gitOk(['cat-file', '-e', `HEAD:${PRODUCT_REL}/specs/${name}`], layout.monorepoRoot);
      return [name, ok ? git(['rev-parse', `HEAD:${PRODUCT_REL}/specs/${name}`], layout.monorepoRoot) : 'missing'];
    }),
  );
});

Then('every specification file is byte-identical', function (this: DevArchWorld) {
  // Git tree ids are content hashes of every file (bytes and modes) below the directory.
  assert.deepEqual(this.data.productSpecs, this.data.originSpecs, 'specifications 001-005 differ from the origin');
});

Then('every assertion integrity hash in their context files still verifies', function (this: DevArchWorld) {
  const repo = layout.monorepoRoot;
  const dir = mkdtempSync(path.join(os.tmpdir(), 'devarch-006-specs-'));
  this.cleanup.push(dir);
  let verified = 0;
  for (const name of Object.keys(this.data.originSpecs as Record<string, string>)) {
    const base = `${PRODUCT_REL}/specs/${name}`;
    const context = JSON.parse(git(['show', `HEAD:${base}/context.json`], repo));
    const expected: string | undefined = context?.testify?.assertion_hash;
    if (!expected) continue; // no testify phase for this feature (e.g. 004)
    const features = trackedFiles(repo, 'HEAD', `${base}/tests/features`).filter((f) => f.endsWith('.feature'));
    const out = path.join(dir, name);
    mkdirSync(out, { recursive: true });
    for (const f of features) {
      if (path.posix.dirname(f) !== `${base}/tests/features`) continue; // top-level files only, as iikit
      writeFileSync(path.join(out, path.posix.basename(f)), git(['show', `HEAD:${f}`], repo) + '\n');
    }
    assert.equal(assertionHash(out), expected, `assertion hash of ${name} no longer verifies`);
    verified++;
  }
  assert.ok(verified >= 4, `only ${verified} assertion hashes verified`);
});

// --- TS-042 -----------------------------------------------------------------------------------------

/**
 * Files of the web import that do not travel to web/: the vendored analyzer archive and the stale output
 * (removed, FR-004) and the web .gitignore (folded into the single product ignore file, FR-026/TS-040).
 */
const NOT_RELOCATED = new Set(['java-dependency-extractor.jar', 'output_entrypoints.json', '.gitignore']);
const ALLOWED_CHANGED = new Set(['src/app/api/analyze/route.ts', 'package.json']);
const ENGINE_RESOLUTION_DIR = 'src/server/engine/';

Given('the web files imported into the monorepo before this feature', function (this: DevArchWorld) {
  const repo = layout.monorepoRoot;
  const { mainline } = subtreeImport(repo);
  const files = trackedFiles(repo, mainline, PRODUCT_REL).map((f) => f.slice(PRODUCT_REL.length + 1));
  this.data.webBefore = files.filter((f) => !NOT_RELOCATED.has(f));
  this.data.mainline = mainline;
  assert.ok((this.data.webBefore as string[]).includes('src/app/api/analyze/route.ts'), 'not the web import');
});

// Evaluated at the 006 baseline tag (re-testify 2026-10-08): later features legitimately change web/.
When('they are compared with the files of the web area at the 006 baseline tag {string}', function (this: DevArchWorld, tag: string) {
  const repo = layout.monorepoRoot;
  assert.ok(gitOk(['rev-parse', '--verify', '--quiet', `refs/tags/${tag}^{commit}`], repo),
    `the baseline tag ${tag} is missing (see docs/BASELINES.md; fetch it with: git fetch origin tag ${tag})`);
  const ref = `${tag}^{commit}`;
  const before = this.data.webBefore as string[];
  const after = trackedFiles(repo, ref, `${PRODUCT_REL}/web`).map((f) => f.slice(`${PRODUCT_REL}/web/`.length));
  const blob = (r: string, p: string) => git(['rev-parse', `${r}:${p}`], repo);
  this.data.missing = before.filter((f) => !after.includes(f));
  this.data.changed = before.filter(
    (f) => after.includes(f) && blob(this.data.mainline as string, `${PRODUCT_REL}/${f}`) !== blob(ref, `${PRODUCT_REL}/web/${f}`),
  );
  this.data.added = after.filter((f) => !before.includes(f));
});

Then(
  'every source, documentation and configuration file is present with its relative path preserved',
  function (this: DevArchWorld) {
    assert.deepEqual(this.data.missing, [], 'web files lost in the relocation');
  },
);

Then(
  'only the analysis route, the web manifest and the newly added engine resolution files differ',
  function (this: DevArchWorld) {
    const changed = (this.data.changed as string[]).filter((f) => !ALLOWED_CHANGED.has(f));
    assert.deepEqual(changed, [], 'unexpected changes to relocated web files');
    const added = (this.data.added as string[]).filter((f) => !f.startsWith(ENGINE_RESOLUTION_DIR));
    assert.deepEqual(added, [], 'unexpected files added to the web');
  },
);
