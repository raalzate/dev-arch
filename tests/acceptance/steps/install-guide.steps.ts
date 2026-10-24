// 012-install-doctor-docker — US5 (docs/INSTALL.md generated table) and the additive guards (TS-036, TS-037).
import { Given, Then, When } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
// @ts-expect-error plain ESM module of the product (no type declarations)
import { HINT_KEYS, PLATFORM_HINTS, REQUIREMENTS, TABLE_END, TABLE_START, requirementsTable } from '../../../scripts/doctor/requirements.mjs';
import { git, gitOk } from '../support/git.ts';
import { layout, PRODUCT_REL } from '../support/layout.ts';
import { mvn } from '../support/quality.ts';
import type { DevArchWorld } from '../support/world.ts';

type Requirement = { id: string; name: string; requiredFor: string; minimum: string; detection: string; modes: string[]; platforms?: string[]; hints: Record<string, string> };

// --- TS-033 / TS-034 --------------------------------------------------------------------------------------------

Given('the product install guide', function (this: DevArchWorld) {
  const f = path.join(layout.productRoot, 'docs', 'INSTALL.md');
  assert.ok(existsSync(f), 'docs/INSTALL.md missing');
  this.data.guide = readFileSync(f, 'utf8');
});

function section(guide: string, title: string): string {
  const start = guide.indexOf(`\n## ${title}`);
  assert.ok(start >= 0, `no section "## ${title}"`);
  const next = guide.indexOf('\n## ', start + 4);
  return guide.slice(start, next < 0 ? undefined : next);
}

Then('it has a section {string} mentioning {string}, {string} and {string}', function (this: DevArchWorld, title: string, terms0: string, terms1: string, terms2: string) {
  const terms = [terms0, terms1, terms2];
  const s = section(this.data.guide as string, title);
  for (const t of terms) assert.ok(s.includes(t), `section ${title} does not mention ${t}`);
});

When('the requirements table is generated from the doctor definition', function (this: DevArchWorld) {
  this.data.generatedTable = requirementsTable() as string;
});

Then('the table between the guide markers is identical to it', function (this: DevArchWorld) {
  const guide = this.data.guide as string;
  const a = guide.indexOf(TABLE_START as string);
  const b = guide.indexOf(TABLE_END as string);
  assert.ok(a >= 0 && b > a, 'requirements table markers missing');
  assert.equal(guide.slice(a + (TABLE_START as string).length, b).trim(), (this.data.generatedTable as string).trim());
});

// --- TS-035 -----------------------------------------------------------------------------------------------------

Given('the doctor requirements definition', function (this: DevArchWorld) {
  this.data.requirements = REQUIREMENTS as Requirement[];
});

Then('it has the requirements {string}', function (this: DevArchWorld, ids: string) {
  assert.deepEqual((this.data.requirements as Requirement[]).map((r) => r.id), ids.split(',').map((s) => s.trim()));
});

Then('every requirement has a name, a usage, a minimum, a detection and at least one mode', function (this: DevArchWorld) {
  for (const r of this.data.requirements as Requirement[]) {
    for (const k of ['name', 'requiredFor', 'minimum', 'detection'] as const) assert.ok(r[k].trim(), `${r.id} has no ${k}`);
    assert.ok(r.modes.length > 0 && r.modes.every((m) => ['local', 'docker'].includes(m)), `${r.id} modes ${r.modes}`);
  }
});

Then('every requirement has an install hint for each package manager of the platforms it applies to', function (this: DevArchWorld) {
  const managers = PLATFORM_HINTS as Record<string, string[]>;
  for (const r of this.data.requirements as Requirement[]) {
    const keys = r.platforms ? r.platforms.flatMap((p) => managers[p]) : (HINT_KEYS as string[]);
    for (const k of keys) assert.ok(r.hints[k]?.trim(), `${r.id} has no ${k} hint`);
  }
});

// --- TS-036 -----------------------------------------------------------------------------------------------------

/** Closing commit of feature 011 (T027/T028 recorded), the base of this feature (014: commit of the own repository). */
export const DELIVERY_011_COMMIT = 'b64722a15602';

// 014-standalone-repo: bounded to the range of feature 012 (closing of 011 -> closing of 012).
When('the product at the closing commit {string} of feature 012 is compared with the closing commit {string} of feature 011', function (this: DevArchWorld, closing: string, base: string) {
  const repo = layout.monorepoRoot;
  for (const c of [base, closing]) assert.ok(gitOk(['cat-file', '-e', `${c}^{commit}`], repo), `commit ${c} is not available`);
  const diff = git(['diff', '--name-status', '--no-renames', `${base}`, closing, '--', PRODUCT_REL], repo);
  this.data.diff011 = diff.split('\n').filter(Boolean).map((l) => {
    const [status, file] = l.split('\t');
    return { status, file: file };
  });
  this.data.base011 = base;
  this.data.closing = closing;
});

type Change = { status: string; file: string };
const changed = (w: DevArchWorld) => (w.data.diff011 as Change[]).filter((c) => c.status !== 'A');

Then('no {string} file, {string} or specification file of features 001 to 011 was modified or deleted', function (this: DevArchWorld, ext: string, ctx: string) {
  const locked = /^specs\/(00[1-9]|01[01])-[^/]+\/(.*)$/;
  const bad = changed(this).filter((c) => {
    const m = locked.exec(c.file);
    if (!m) return false;
    return m[2].endsWith(ext) || path.basename(m[2]) === ctx || m[2] === 'spec.md';
  });
  assert.deepEqual(bad, []);
});

Then('no existing step definition or test source file was modified or deleted', function (this: DevArchWorld) {
  const tests = /^(tests\/acceptance\/|engine\/src\/test\/|web\/src\/.*\.test\.ts$|schema\/.*\.test\.|web\/scripts\/run-tests\.mjs$)/;
  assert.deepEqual(changed(this).filter((c) => tests.test(c.file)), []);
});

Then('the product root entries and the workspaces are unchanged', function (this: DevArchWorld) {
  const repo = layout.monorepoRoot;
  const entries = (ref: string) => git(['ls-tree', '--name-only', `${ref}^{tree}`], repo).split('\n').sort();
  const at = (this.data.closing as string | undefined) ?? 'HEAD';
  assert.deepEqual(entries(at), entries(this.data.base011 as string));
  const ws = (ref: string) => (JSON.parse(git(['show', `${ref}:package.json`], repo)) as { workspaces: string[] }).workspaces;
  assert.deepEqual(ws(at), ws(this.data.base011 as string));
});

// --- TS-037 -----------------------------------------------------------------------------------------------------

When('the engine static analysis is run', function (this: DevArchWorld) {
  const compile = mvn(['-q', 'compile']);
  assert.equal(compile.code, 0, compile.output.slice(-3000));
  this.data.checkstyle = mvn(['checkstyle:check', '-Dcheckstyle.config.location=sun_checks.xml', '-Dcheckstyle.violationSeverity=warning',
    '-Dcheckstyle.maxAllowedViolations=4589']);
  this.data.spotbugs = mvn(['com.github.spotbugs:spotbugs-maven-plugin:4.8.3.1:check', '-Dspotbugs.excludeFilterFile=spotbugs-exclude.xml']);
});

Then('Checkstyle reports at most {int} violations', function (this: DevArchWorld, max: number) {
  const r = this.data.checkstyle as { code: number; output: string };
  const count = /You have (\d+) Checkstyle violations?/.exec(r.output)?.[1];
  assert.equal(r.code, 0, `Checkstyle above ${max}: ${count ?? '?'}\n${r.output.slice(-2000)}`);
  if (count) assert.ok(Number(count) <= max, `${count} > ${max}`);
});

Then('SpotBugs reports no bug', function (this: DevArchWorld) {
  const r = this.data.spotbugs as { code: number; output: string };
  assert.equal(r.code, 0, r.output.slice(-3000));
  assert.doesNotMatch(r.output, /Total bugs: [1-9]/);
});
