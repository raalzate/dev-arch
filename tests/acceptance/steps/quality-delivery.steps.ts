// 011-quality-delivery — coverage publication and summary (US3), release (US5), analyzer freshness (US7) and the
// guards (TS-033, TS-034). Scripts run for real with temporary fixtures.
import { Given, Then, When } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { git, gitOk } from '../support/git.ts';
import { assertionHash } from '../support/iikit-hash.ts';
import { layout } from '../support/layout.ts';
import { run } from '../support/process.ts';
import { bashFunction, job, needsOf, productFile, productVersion, stepsOf, workflow, type CiJob } from '../support/quality.ts';
import type { DevArchWorld } from '../support/world.ts';

const tmp = (world: DevArchWorld, prefix: string): string => {
  const dir = mkdtempSync(path.join(os.tmpdir(), `devarch-011-${prefix}-`));
  world.cleanup.push(dir);
  return dir;
};

// --- TS-015 / TS-016 / TS-017 -------------------------------------------------------------------------------

Given('coverage reports of the Java engine, the .NET analyzer and the web', function (this: DevArchWorld) {
  const dir = tmp(this, 'coverage');
  const java = path.join(dir, 'jacoco.xml');
  writeFileSync(java, '<?xml version="1.0"?><report name="engine"><package name="p"><counter type="LINE" missed="1" covered="99"/></package>'
    + '<counter type="INSTRUCTION" missed="10" covered="30"/><counter type="LINE" missed="3" covered="13"/></report>');
  const dotnetDir = path.join(dir, 'dotnet', 'a1b2');
  mkdirSync(dotnetDir, { recursive: true });
  writeFileSync(path.join(dotnetDir, 'coverage.cobertura.xml'), '<?xml version="1.0"?><coverage line-rate="0.625" branch-rate="0.5" version="1.9"></coverage>');
  const web = path.join(dir, 'summary.json');
  writeFileSync(web, JSON.stringify({ lines: { covered: 87, total: 100, pct: 87 }, files: {} }));
  this.env = { ...this.env, COVERAGE_JAVA: java, COVERAGE_DOTNET: path.join(dir, 'dotnet'), COVERAGE_WEB: web };
  this.data.coverage = { java, dotnet: path.join(dotnetDir, 'coverage.cobertura.xml'), web };
});

Given('the .NET analyzer coverage report is missing', function (this: DevArchWorld) {
  this.env = { ...this.env, COVERAGE_DOTNET: tmp(this, 'empty') };
});

When('the product coverage summary is executed', function (this: DevArchWorld) {
  this.result = run('bash', ['scripts/coverage.sh', 'summary'], { cwd: layout.productRoot, env: this.env });
});

Then('it prints a line with the line coverage percentage and the report path for {string}, {string} and {string}', function (this: DevArchWorld, a: string, b: string, c: string) {
  const reports = this.data.coverage as Record<string, string>;
  // Root LINE counter of jacoco.xml (13/16), cobertura line-rate (0.625) and summary.json lines.pct (87).
  const expected: Record<string, string> = { java: '81.25', dotnet: '62.50', web: '87.00' };
  for (const stack of [a, b, c]) {
    const line = this.result!.stdout.split('\n').find((l) => l.startsWith(`[coverage] ${stack}: `));
    assert.ok(line, `no summary line for ${stack}:\n${this.result!.output}`);
    assert.ok(line.includes(`${expected[stack]}% lines`), line);
    assert.ok(line.includes(reports[stack]), `${line} does not name ${reports[stack]}`);
  }
});

Then('it prints {string}', function (this: DevArchWorld, text: string) {
  assert.ok(this.result!.output.includes(text), this.result!.output);
});

Given('the product Makefile', function (this: DevArchWorld) {
  this.data.makefile = productFile('Makefile');
});

Then('it declares a {string} target that runs the three coverage reports and the summary', function (this: DevArchWorld, target: string) {
  const mk = this.data.makefile as string;
  const m = new RegExp(`^${target}:[^\\n]*\\n((?:\\t[^\\n]*\\n)+)`, 'm').exec(mk);
  assert.ok(m, `no ${target} target`);
  assert.match(m[1], /scripts\/coverage\.sh/);
  assert.match(mk, new RegExp(`\\.PHONY:[^\\n]*(?:\\\\\\n[^\\n]*)*\\b${target}\\b`), `${target} is not phony`);
  const script = productFile('scripts/coverage.sh');
  const runAll = bashFunction(script, 'run_all');
  for (const re of [/\bmvn\b.*\bverify\b|test\.sh engine/, /XPlat Code Coverage|test\.sh engine/, /npm run coverage -w web/, /\bsummary\b/]) {
    assert.match(runAll, re, `coverage.sh run_all lacks ${re}`);
  }
});

Then('the job {string} uploads an artifact named {string} containing {string}', function (this: DevArchWorld, name: string, artifact: string, report: string) {
  const step = stepsOf(job(workflow(this), name)).find((s) => String(s.uses ?? '').startsWith('actions/upload-artifact@') && s.with?.name === artifact);
  assert.ok(step, `${name} uploads no artifact ${artifact}`);
  assert.ok(String(step.with?.path ?? '').includes(report), `${artifact} path: ${step.with?.path}`);
});

// --- TS-020 / TS-021 / TS-022 -------------------------------------------------------------------------------

When('the release version check is executed for the tag {string}', function (this: DevArchWorld, tag: string) {
  this.result = run('bash', ['scripts/release-check.sh', tag.replace('{VERSION}', productVersion())], { cwd: layout.productRoot });
});

Then('its exit code is {int}', function (this: DevArchWorld, code: number) {
  assert.equal(this.result!.code, code, this.result!.output);
});

Then('its output contains {string}', function (this: DevArchWorld, text: string) {
  assert.ok(this.result!.output.includes(text), this.result!.output);
});

const TAG_IF = /startsWith\(\s*github\.ref\s*,\s*'refs\/tags\/dev-arch-v'\s*\)/;

function tagOnly(j: CiJob): boolean {
  const cond = String(j.if ?? '');
  return TAG_IF.test(cond) && !/refs\/heads\/main/.test(cond);
}

Then('a release version check job runs only for {string} tags and runs the release version check script', function (this: DevArchWorld, _tags: string) {
  const wf = workflow(this);
  const entry = Object.entries(wf.jobs).find(([, j]) => stepsOf(j).some((s) => /scripts\/release-check\.sh/.test(String(s.run ?? ''))));
  assert.ok(entry, 'no job runs scripts/release-check.sh');
  assert.ok(tagOnly(entry[1]), `${entry[0]} is not limited to dev-arch tags: ${entry[1].if}`);
  this.data.checkJob = entry[0];
});

Then('the release job depends on the release version check job', function (this: DevArchWorld) {
  assert.ok(needsOf(job(workflow(this), 'release')).includes(this.data.checkJob as string), 'release does not need the version check');
});

Then('a skills release job runs only for {string} tags after the release version check', function (this: DevArchWorld, _tags: string) {
  const wf = workflow(this);
  const entry = Object.entries(wf.jobs).find(([name, j]) => name !== 'release' && stepsOf(j).some((s) => /dev-arch-skills-/.test(String(s.run ?? ''))));
  assert.ok(entry, 'no job packages dev-arch-skills');
  assert.ok(tagOnly(entry[1]), `${entry[0]} is not limited to dev-arch tags`);
  const check = Object.entries(wf.jobs).find(([, j]) => stepsOf(j).some((s) => /scripts\/release-check\.sh/.test(String(s.run ?? ''))))?.[0];
  assert.ok(check && needsOf(entry[1]).includes(check), `${entry[0]} does not need the version check`);
  this.data.skillsJob = entry[1];
});

Then('it packages the product skills folder as an archive named after the tag with a checksum file', function (this: DevArchWorld) {
  const runText = stepsOf(this.data.skillsJob as CiJob).map((s) => String(s.run ?? '')).join('\n');
  assert.match(runText, /dev-arch-skills-\$\{?\{?\s*(?:github\.ref_name|GITHUB_REF_NAME|TAG)/, 'archive not named after the tag');
  assert.match(runText, /\bzip\b[^\n]*\bskills\b|\btar\b[^\n]*\bskills\b/, 'the skills folder is not archived');
  assert.match(runText, /sha256sum/, 'no checksum');
});

Then('it publishes both files to the release of the same tag', function (this: DevArchWorld) {
  const step = stepsOf(this.data.skillsJob as CiJob).find((s) => String(s.uses ?? '').startsWith('softprops/action-gh-release@'));
  assert.ok(step, 'skills are not published to the GitHub release');
  const files = String(step.with?.files ?? '');
  assert.match(files, /dev-arch-skills-[^\n]*\.zip/);
  assert.match(files, /dev-arch-skills-[^\n]*\.sha256/);
  assert.match(String(step.with?.tag_name ?? ''), /github\.ref_name/);
});

// --- TS-030 / TS-031 ----------------------------------------------------------------------------------------

const BASE = Date.parse('2026-10-10T08:00:00Z') / 1000;

function analyzerSources(world: DevArchWorld): { src: string; stamp: string } {
  const dir = tmp(world, 'analyzer');
  const src = path.join(dir, 'DotNetAnalyzer');
  for (const f of ['Program.cs', 'DotNetAnalyzer.csproj', 'Analysis/Walker.cs', 'obj/project.assets.json', 'bin/Release/x.dll']) {
    mkdirSync(path.dirname(path.join(src, f)), { recursive: true });
    writeFileSync(path.join(src, f), '// fixture\n');
    utimesSync(path.join(src, f), BASE, BASE);
  }
  const stamp = path.join(dir, 'publish', '.published');
  return { src, stamp };
}

function writeStamp(stamp: string, at: number): void {
  mkdirSync(path.dirname(stamp), { recursive: true });
  writeFileSync(stamp, 'published\n');
  utimesSync(stamp, at, at);
}

Given('analyzer sources and a publication stamp newer than every source', function (this: DevArchWorld) {
  const a = analyzerSources(this);
  writeStamp(a.stamp, BASE + 100);
  this.data.freshness = a;
});

Given('analyzer sources and a publication stamp older than the file {string}', function (this: DevArchWorld, file: string) {
  const a = analyzerSources(this);
  writeStamp(a.stamp, BASE + 100);
  utimesSync(path.join(a.src, file), BASE + 200, BASE + 200);
  this.data.freshness = a;
});

Given('analyzer sources and a publication stamp older than a file under {string}', function (this: DevArchWorld, dir: string) {
  const a = analyzerSources(this);
  writeStamp(a.stamp, BASE + 100);
  const f = readdirSync(path.join(a.src, dir))[0];
  utimesSync(path.join(a.src, dir, f), BASE + 200, BASE + 200);
  this.data.freshness = a;
});

Given('analyzer sources and no publication stamp', function (this: DevArchWorld) {
  this.data.freshness = analyzerSources(this);
});

When('the analyzer freshness check is executed {}', function (this: DevArchWorld, mode: string) {
  const a = this.data.freshness as { src: string; stamp: string };
  const args = ['scripts/dotnet-analyzer-freshness.sh', a.stamp, a.src];
  if (mode === 'with the force flag') args.push('--force');
  else assert.equal(mode, 'normally');
  this.result = run('bash', args, { cwd: layout.productRoot });
});

Then('the decision is {string}', function (this: DevArchWorld, decision: string) {
  assert.equal(this.result!.code, 0, this.result!.output);
  assert.equal(this.result!.stdout.trim().split('\n')[0], decision);
});

Then('the engine subset republishes the .NET analyzer when the freshness check does not answer {string}', function (this: DevArchWorld, answer: string) {
  const body = bashFunction(this.data.testScript as string, 'run_engine');
  assert.match(body, /dotnet-analyzer-freshness\.sh/, 'run_engine does not check the analyzer freshness');
  assert.ok(body.includes(`"${answer}"`), `run_engine does not compare the decision with "${answer}"`);
  assert.match(body, /engine-build\.sh" --dotnet-only|engine-build\.sh --dotnet-only/, 'run_engine does not republish the analyzer');
});

Then('it announces whether the analyzer was reused or rebuilt', function (this: DevArchWorld) {
  const body = bashFunction(this.data.testScript as string, 'run_engine');
  assert.match(body, /dotnet-analyzer: reused/);
  assert.match(body, /dotnet-analyzer: rebuilt/);
});

Given('the contract check script', function (this: DevArchWorld) {
  this.data.schemaCheck = productFile('scripts/schema-check.sh');
});

Then('it republishes its .NET analyzer when the freshness check does not answer {string} or when a rebuild is forced', function (this: DevArchWorld, answer: string) {
  const body = bashFunction(this.data.schemaCheck as string, 'prepare_dotnet_analyzer');
  assert.match(body, /dotnet-analyzer-freshness\.sh/);
  assert.ok(body.includes(`"${answer}"`), `prepare_dotnet_analyzer does not compare with "${answer}"`);
  assert.match(body, /--force/);
  assert.match(body, /SCHEMA_CHECK_SKIP_BUILD/);
});

// --- TS-033 / TS-034 ----------------------------------------------------------------------------------------

// 014-standalone-repo: bounded to the range of feature 011 (delivery of 010 -> closing commit of 011).
When('the product at the closing commit {string} of feature 011 is compared with the delivery commit {string} of feature 010', function (this: DevArchWorld, closing: string, sha: string) {
  const repo = layout.monorepoRoot;
  for (const c of [sha, closing]) assert.ok(gitOk(['cat-file', '-e', `${c}^{commit}`], repo), `commit ${c} not available`);
  const changed = (paths: string[]) => git(['diff', '--name-only', '--no-renames', '--diff-filter=MD', sha, closing, '--', ...paths], repo)
    .split('\n').filter(Boolean);
  const rel = (p: string) => p;
  this.data.changedSpecs = changed(['001', '002', '003', '004', '005', '006', '007', '008', '009', '010'].map((n) => rel(`specs/${n}-*`)));
  this.data.changedTests = changed([rel('engine/src/test'), rel('tests/acceptance'), rel('schema/test'), rel('web/src')])
    .filter((f) => !f.startsWith('web/src/') || f.endsWith('.test.ts'))
    .filter((f) => !/\.(csproj|props|targets)$/.test(f));
});

Then('no {string} file, {string} or specification file of features 001 to 010 was modified or deleted', function (this: DevArchWorld, _f: string, _c: string) {
  assert.deepEqual(this.data.changedSpecs, []);
});

Then('no existing test source file was modified or deleted', function (this: DevArchWorld) {
  assert.deepEqual(this.data.changedTests, []);
});

Then('every assertion integrity hash of features 001 to 010 verifies', function () {
  let verified = 0;
  for (const name of readdirSync(path.join(layout.productRoot, 'specs')).filter((n) => /^(00[1-9]|010)-/.test(n))) {
    const ctx = path.join(layout.productRoot, 'specs', name, 'context.json');
    if (!existsSync(ctx)) continue;
    const expected = JSON.parse(readFileSync(ctx, 'utf8'))?.testify?.assertion_hash as string | undefined;
    if (!expected) continue;
    assert.equal(assertionHash(path.join(layout.productRoot, 'specs', name, 'tests', 'features')), expected, `assertion hash of ${name}`);
    verified++;
  }
  assert.ok(verified >= 8, `only ${verified} hashes verified`);
});

Given('the research of this feature', function (this: DevArchWorld) {
  this.data.research = productFile('specs/011-quality-delivery/research.md');
});

Then('it has a section about {string} with the findings and the next step', function (this: DevArchWorld, topic: string) {
  const text = this.data.research as string;
  const start = text.search(new RegExp(`^##+ .*${topic}`, 'm'));
  assert.ok(start >= 0, `no section about ${topic}`);
  const rest = text.slice(start + 3);
  const section = text.slice(start, start + 3 + (rest.search(/^## /m) < 0 ? rest.length : rest.search(/^## /m)));
  assert.match(section, /hallazgo|finding/i, 'no findings');
  assert.match(section, /siguiente paso|next step/i, 'no next step');
});
