// 011-quality-delivery — US2 (legacy scenarios of 001–003 in the engine verification) and the engine parts of US3
// (JaCoCo, coverlet). Runner discovery is static; executions run the real Cucumber-JVM runners through Maven.
import { Given, Then, When } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { gitOk } from '../support/git.ts';
import { layout } from '../support/layout.ts';
import { bashFunction, filesUnder, job, mvn, productFile, stepsOf, workflow } from '../support/quality.ts';
import type { DevArchWorld } from '../support/world.ts';

/** Last commit of feature 010 (TS-006 "files added after feature 010", TS-033). */
export const DELIVERY_010 = '3b32def8d5d7223df3afdf20a4dc88ac35c971fc';
const LEGACY = ['001-mcp-server-local', '002-dotnet-roslyn-analyzer', '003-dotnet-code-issues'];
const TEST_JAVA = path.join(layout.engineRoot, 'src', 'test', 'java');

type Runner = { cls: string; file: string; glue: string; dir: string };

function runners(): Runner[] {
  const out: Runner[] = [];
  for (const file of filesUnder(TEST_JAVA).filter((f) => f.endsWith('.java'))) {
    const src = readFileSync(file, 'utf8');
    const dir = /@SelectDirectories\(\s*"([^"]+)"\s*\)/.exec(src)?.[1];
    if (!dir) continue;
    const glue = /GLUE_PROPERTY_NAME,\s*value\s*=\s*"([^"]+)"/.exec(src)?.[1] ?? '';
    const pkg = /^package\s+([\w.]+);/m.exec(src)?.[1] ?? '';
    out.push({ cls: `${pkg}.${path.basename(file, '.java')}`, file, glue, dir });
  }
  return out;
}

function legacyRunner(feature: string): Runner {
  const r = runners().find((x) => x.dir.replace(/\/$/, '') === `../specs/${feature}/tests/features`);
  assert.ok(r, `no Cucumber runner selects ../specs/${feature}/tests/features`);
  return r;
}

// --- TS-006 -------------------------------------------------------------------------------------------------

Given('the engine test sources', function (this: DevArchWorld) {
  assert.ok(existsSync(TEST_JAVA), 'no engine/src/test/java');
  this.data.glues = [];
});

Then('a Cucumber runner selects the features folder of {string} with its own glue package', function (this: DevArchWorld, feature: string) {
  const r = legacyRunner(feature);
  assert.ok(r.glue, `${r.cls} declares no glue package`);
  const others = runners().filter((x) => x.cls !== r.cls && x.glue.split(',').map((g) => g.trim()).includes(r.glue));
  assert.deepEqual(others.map((o) => o.cls), [], `glue ${r.glue} shared with other runners`);
  const dir = path.join(TEST_JAVA, ...r.glue.split('.'));
  assert.ok(existsSync(dir), `glue package directory ${dir} missing`);
  (this.data.glues as string[]).push(dir);
});

Then('those glue packages contain only files added after feature 010', function (this: DevArchWorld) {
  const repo = layout.monorepoRoot;
  assert.ok(gitOk(['cat-file', '-e', `${DELIVERY_010}^{commit}`], repo), `commit ${DELIVERY_010} not available`);
  const preexisting: string[] = [];
  for (const dir of this.data.glues as string[]) {
    for (const f of filesUnder(dir)) {
      const rel = path.relative(repo, f).split(path.sep).join('/');
      if (gitOk(['cat-file', '-e', `${DELIVERY_010}:${rel}`], repo)) preexisting.push(rel);
    }
  }
  assert.deepEqual(preexisting, [], 'glue files that already existed in feature 010');
});

// --- TS-007 / TS-008 / TS-009 -------------------------------------------------------------------------------

type Step = { result: { status: string; error_message?: string } };
type Element = { type: string; name: string; tags?: { name: string }[]; steps?: Step[]; before?: Step[]; after?: Step[] };
type Feature = { uri: string; elements?: Element[] };

function reportFile(feature: string): string {
  const src = readFileSync(legacyRunner(feature).file, 'utf8');
  const json = /json:([^",\s]+)/.exec(src)?.[1];
  assert.ok(json, `runner of ${feature} writes no JSON report`);
  return path.join(layout.engineRoot, json);
}

function runLegacy(world: DevArchWorld, props: string[]): void {
  const classes = LEGACY.map((f) => legacyRunner(f).cls.split('.').pop());
  for (const f of LEGACY) rmSync(reportFile(f), { force: true });
  const res = mvn(['-q', 'test', `-Dtest=${classes.join(',')}`, '-Dsurefire.failIfNoSpecifiedTests=false', '-Djacoco.skip=true', ...props]);
  world.result = res;
  world.data.reports = Object.fromEntries(LEGACY.map((f) => {
    const file = reportFile(f);
    assert.ok(existsSync(file), `no report ${file}; Maven output:\n${res.output.slice(-4000)}`);
    return [f, JSON.parse(readFileSync(file, 'utf8')) as Feature[]];
  }));
}

/** Scenarios of a features folder: plain scenarios plus one per Examples row. */
function expectedScenarios(feature: string): number {
  const dir = path.join(layout.productRoot, 'specs', feature, 'tests', 'features');
  let n = 0;
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.feature'))) {
    const lines = readFileSync(path.join(dir, f), 'utf8').split('\n').map((l) => l.trim()).filter((l) => !l.startsWith('#'));
    let outline = false;
    let inExamples = false;
    let header = false;
    for (const l of lines) {
      if (/^Scenario Outline:|^Scenario Template:/.test(l)) { outline = true; inExamples = false; continue; }
      if (/^Scenario:|^Example:/.test(l)) { n++; outline = false; inExamples = false; continue; }
      if (outline && /^(Examples|Scenarios):/.test(l)) { inExamples = true; header = true; continue; }
      if (inExamples && l.startsWith('|')) {
        if (header) header = false;
        else n++;
        continue;
      }
      if (inExamples && l && !l.startsWith('|') && !l.startsWith('@')) inExamples = false;
    }
  }
  return n;
}

/**
 * Scenarios of a feature report. The JSON formatter writes the Background steps as a separate element just before
 * each scenario; they are merged into that scenario (a skip or failure in the Background belongs to it).
 */
function scenarios(world: DevArchWorld, feature: string): Element[] {
  const report = (world.data.reports as Record<string, Feature[]>)[feature];
  const out: Element[] = [];
  for (const f of report) {
    let background: Element | null = null;
    for (const e of f.elements ?? []) {
      if (e.type === 'background') {
        background = e;
        continue;
      }
      if (e.type !== 'scenario') continue;
      out.push(background ? { ...e, before: [...(e.before ?? []), ...(background.before ?? [])], steps: [...(background.steps ?? []), ...(e.steps ?? [])] } : e);
      background = null;
    }
  }
  return out;
}

const allSteps = (e: Element): Step[] => [...(e.before ?? []), ...(e.steps ?? []), ...(e.after ?? [])];

When('the legacy engine runners are executed in dry-run mode', function (this: DevArchWorld) {
  runLegacy(this, ['-Dcucumber.execution.dry-run=true']);
});

When('the legacy engine runners are executed', function (this: DevArchWorld) {
  runLegacy(this, []);
});

When('the legacy engine runners are executed with the .NET analyzer reported absent', function (this: DevArchWorld) {
  runLegacy(this, ['-Dlegacybdd.analyzer=absent']);
});

Then('every scenario of {string}, {string} and {string} is reported', function (this: DevArchWorld, a: string, b: string, c: string) {
  for (const f of [a, b, c]) {
    assert.equal(scenarios(this, f).length, expectedScenarios(f), `scenarios of ${f} in its report`);
  }
});

Then('no step is undefined, pending or ambiguous', function (this: DevArchWorld) {
  const bad: string[] = [];
  for (const f of LEGACY) {
    for (const e of scenarios(this, f)) {
      for (const s of allSteps(e)) if (['undefined', 'pending', 'ambiguous'].includes(s.result.status)) bad.push(`${f}: ${e.name} (${s.result.status})`);
    }
  }
  assert.deepEqual(bad, []);
  assert.equal(this.result!.code, 0, this.result!.output.slice(-4000));
});

Given('the .NET analyzer of the engine is available', function () {
  const launcher = path.join(layout.engineRoot, 'target', 'dotnet-analyzer');
  assert.ok(existsSync(launcher) && (statSync(launcher).mode & 0o111) !== 0,
    'engine/target/dotnet-analyzer is missing: run `make build-engine` (or scripts/engine-build.sh --dotnet-only)');
});

function status(e: Element): string {
  const statuses = allSteps(e).map((s) => s.result.status);
  if (statuses.every((s) => s === 'passed')) return 'passed';
  if (statuses.some((s) => s === 'failed')) return 'failed';
  if (statuses.some((s) => s === 'skipped')) return 'skipped';
  return statuses.find((s) => s !== 'passed') ?? 'passed';
}

// --- Documented exclusions (FR-033): specs/011-quality-delivery/legacy-exclusions.md is the only source ---------

export type Exclusion = { feature: string; scenario: string; decision: string; date: string };
export const EXCLUSIONS_LIST = 'specs/011-quality-delivery/legacy-exclusions.md';
const EXCLUSION_ROW = /^\|\s*(\d{3}-[a-z0-9-]+)\s*\|\s*(TS-\d{3})\s*\|([^|]*)\|([^|]+)\|\s*(\d{4}-\d{2}-\d{2})\s*\|\s*$/;

/** Same grammar as engine/src/test/java/com/extractor/legacybdd/LegacyExclusions.java. */
export function legacyExclusions(): Exclusion[] {
  const text = readFileSync(path.join(layout.productRoot, EXCLUSIONS_LIST), 'utf8');
  return text.split('\n').map((l) => EXCLUSION_ROW.exec(l.trim())).filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ feature: m[1], scenario: m[2], decision: m[4].trim(), date: m[5] }));
}

const tsOf = (e: Element): string[] => (e.tags ?? []).map((t) => t.name.replace(/^@/, '')).filter((t) => /^TS-\d{3}$/.test(t));
const isExcluded = (feature: string, e: Element): boolean =>
  legacyExclusions().some((x) => x.feature === feature && tsOf(e).includes(x.scenario));

function skipReason(e: Element): string {
  const s = allSteps(e).find((x) => x.result.status === 'skipped' && x.result.error_message);
  const msg = s?.result.error_message ?? '';
  const first = /Assumption failed: (.*)/.exec(msg)?.[1] ?? msg.split('\n')[0];
  return first.replace(/^[\w.$]*TestAbortedException:\s*/, '');
}

Then('every entry of the legacy exclusions list matches a reported scenario', function (this: DevArchWorld) {
  const stale = legacyExclusions().filter((x) => {
    assert.ok(LEGACY.includes(x.feature), `exclusion of a non-legacy feature: ${x.feature}`);
    return !scenarios(this, x.feature).some((e) => tsOf(e).includes(x.scenario));
  }).map((x) => `${x.feature} ${x.scenario}`);
  assert.deepEqual(stale, [], 'exclusions that match no reported scenario');
});

Then('every scenario of {string}, {string} and {string} not listed in the legacy exclusions passed', function (this: DevArchWorld, a: string, b: string, c: string) {
  const bad: string[] = [];
  for (const f of [a, b, c]) {
    const sc = scenarios(this, f);
    assert.equal(sc.length, expectedScenarios(f), `scenarios of ${f} in its report`);
    for (const e of sc) if (!isExcluded(f, e) && status(e) !== 'passed') bad.push(`${f}: ${e.name} (${status(e)}: ${skipReason(e)})`);
  }
  assert.deepEqual(bad, [], this.result!.output.slice(-3000));
});

Then('every scenario listed in the legacy exclusions is skipped with a reason starting with {string}', function (this: DevArchWorld, prefix: string) {
  const bad: string[] = [];
  for (const x of legacyExclusions()) {
    const hits = scenarios(this, x.feature).filter((e) => tsOf(e).includes(x.scenario));
    if (hits.length === 0) bad.push(`${x.feature} ${x.scenario}: not reported`);
    for (const e of hits) {
      const reason = skipReason(e);
      if (status(e) !== 'skipped' || !reason.startsWith(prefix) || !reason.includes(x.decision)) {
        bad.push(`${x.feature} ${x.scenario}: ${status(e)} (${reason})`);
      }
    }
  }
  assert.deepEqual(bad, []);
});

Then('no other scenario is skipped', function (this: DevArchWorld) {
  const skipped = LEGACY.flatMap((f) => scenarios(this, f).filter((e) => !isExcluded(f, e) && status(e) === 'skipped')
    .map((e) => `${f}: ${e.name} (${skipReason(e)})`));
  assert.deepEqual(skipped, [], 'scenarios skipped without a documented exclusion');
  assert.equal(this.result!.code, 0, this.result!.output.slice(-4000));
});

Then('every scenario that needs the .NET analyzer and is not listed in the legacy exclusions is skipped with a reason starting with {string}', function (this: DevArchWorld, prefix: string) {
  const skipped = LEGACY.flatMap((f) => scenarios(this, f).filter((e) => !isExcluded(f, e) && status(e) === 'skipped'));
  assert.ok(skipped.length > 0, 'no scenario was skipped although the analyzer was reported absent');
  const wrong = skipped.filter((e) => !skipReason(e).startsWith(prefix)).map((e) => `${e.name}: ${skipReason(e)}`);
  assert.deepEqual(wrong, []);
});

Then('every other legacy scenario passed', function (this: DevArchWorld) {
  const bad = LEGACY.flatMap((f) => scenarios(this, f).filter((e) => !['passed', 'skipped'].includes(status(e))).map((e) => `${f}: ${e.name} (${status(e)})`));
  assert.deepEqual(bad, []);
  const passed = LEGACY.flatMap((f) => scenarios(this, f).filter((e) => status(e) === 'passed'));
  assert.ok(passed.length > 0, 'no legacy scenario passed');
  assert.equal(this.result!.code, 0, this.result!.output.slice(-4000));
});

// --- TS-035 -------------------------------------------------------------------------------------------------

Given('the legacy exclusions list of feature {string}', function (this: DevArchWorld, feature: string) {
  const file = path.join(layout.productRoot, 'specs', feature, 'legacy-exclusions.md');
  assert.equal(path.relative(layout.productRoot, file).split(path.sep).join('/'), EXCLUSIONS_LIST);
  assert.ok(existsSync(file), `${file} missing`);
  this.data.exclusionsText = readFileSync(file, 'utf8');
  this.data.exclusions = legacyExclusions();
});

Then('the list declares a version and has {int} entries', function (this: DevArchWorld, n: number) {
  assert.match(this.data.exclusionsText as string, /^Version: \d+\.\d+\.\d+ \(\d{4}-\d{2}-\d{2}\)$/m);
  assert.equal((this.data.exclusions as Exclusion[]).length, n);
  const rows = (this.data.exclusionsText as string).split('\n').filter((l) => /^\|\s*\d{3}-/.test(l.trim()));
  assert.equal(rows.length, n, 'table rows that do not follow the format');
});

Then('every entry names a feature of {string}, {string} or {string}, a scenario tag, a superseding decision and a decision date', function (this: DevArchWorld, a: string, b: string, c: string) {
  for (const x of this.data.exclusions as Exclusion[]) {
    assert.ok([a, b, c].includes(x.feature), `feature ${x.feature}`);
    assert.match(x.scenario, /^TS-\d{3}$/);
    assert.ok(x.decision.length >= 10, `${x.feature} ${x.scenario}: superseding decision missing`);
    assert.ok(!Number.isNaN(Date.parse(x.date)), `${x.feature} ${x.scenario}: date ${x.date}`);
  }
});

Then('every entry matches a scenario tag present in the locked feature files of its feature', function (this: DevArchWorld) {
  for (const x of this.data.exclusions as Exclusion[]) {
    const dir = path.join(layout.productRoot, 'specs', x.feature, 'tests', 'features');
    const found = readdirSync(dir).filter((f) => f.endsWith('.feature'))
      .some((f) => new RegExp(`^\\s*@.*@${x.scenario}\\b|^\\s*@${x.scenario}\\b`, 'm').test(readFileSync(path.join(dir, f), 'utf8')));
    assert.ok(found, `${x.feature} has no scenario tagged @${x.scenario}`);
  }
});

Then('no legacy engine runner declares a tag filter', function () {
  for (const f of LEGACY) {
    const src = readFileSync(legacyRunner(f).file, 'utf8');
    assert.doesNotMatch(src, /FILTER_TAGS_PROPERTY_NAME|cucumber\.filter\.tags|@IncludeTags|@ExcludeTags/, `${f} runner filters tags`);
  }
});

Then('every legacy glue package reads its exclusions from the legacy exclusions list', function () {
  const helper = path.join(TEST_JAVA, 'com', 'extractor', 'legacybdd', 'LegacyExclusions.java');
  assert.ok(existsSync(helper), 'LegacyExclusions.java missing');
  assert.ok(readFileSync(helper, 'utf8').includes(`"${EXCLUSIONS_LIST}"`), 'LegacyExclusions does not read the list');
  for (const f of LEGACY) {
    const r = legacyRunner(f);
    const dir = path.join(TEST_JAVA, ...r.glue.split('.'));
    const hooks = filesUnder(dir).filter((file) => {
      const src = readFileSync(file, 'utf8');
      return /@Before\(order = 0\)/.test(src) && src.includes('LegacyExclusions.abortIfExcluded(');
    });
    assert.equal(hooks.length, 1, `glue ${r.glue} needs exactly one first-order hook applying the exclusions`);
  }
});

// --- TS-010 -------------------------------------------------------------------------------------------------

Then('the job {string} sets up .NET {int}', function (this: DevArchWorld, name: string, major: number) {
  const step = stepsOf(job(workflow(this), name)).find((s) => String(s.uses ?? '').startsWith('actions/setup-dotnet@'));
  assert.ok(step, `${name} does not set up .NET`);
  assert.ok(String(step.with?.['dotnet-version'] ?? '').startsWith(`${major}.`), `${name} .NET version ${step.with?.['dotnet-version']}`);
});

Then('the job {string} publishes the .NET analyzer before it runs the engine verification', function (this: DevArchWorld, name: string) {
  const steps = stepsOf(job(workflow(this), name));
  const publish = steps.findIndex((s) => /engine-build\.sh --dotnet-only|dotnet publish/.test(String(s.run ?? '')));
  const verify = steps.findIndex((s) => /\bmvn\b.*\bverify\b/.test(String(s.run ?? '')));
  assert.ok(publish >= 0, `${name} does not publish the .NET analyzer`);
  assert.ok(verify >= 0, `${name} does not run mvn verify`);
  assert.ok(publish < verify, `${name} publishes the analyzer after the engine verification`);
});

// --- TS-011 / TS-012 ----------------------------------------------------------------------------------------

Given('the engine build definition', function (this: DevArchWorld) {
  this.data.pom = productFile('engine/pom.xml');
});

function jacocoPlugin(pom: string): string {
  const i = pom.indexOf('<artifactId>jacoco-maven-plugin</artifactId>');
  assert.ok(i >= 0, 'engine/pom.xml has no jacoco-maven-plugin');
  const end = pom.indexOf('</plugin>', i);
  return pom.slice(i, end);
}

Then('a coverage agent is prepared for the engine tests', function (this: DevArchWorld) {
  assert.match(jacocoPlugin(this.data.pom as string), /<goal>prepare-agent<\/goal>/);
  assert.doesNotMatch(this.data.pom as string, /<argLine>(?![^<]*@\{argLine\})/, 'a surefire argLine would drop the JaCoCo agent');
});

Then('a coverage report in XML and HTML is produced in the verify phase', function (this: DevArchWorld) {
  const plugin = jacocoPlugin(this.data.pom as string);
  const exec = plugin.split('<execution>').find((e) => /<goal>report<\/goal>/.test(e));
  assert.ok(exec, 'no JaCoCo report execution');
  assert.match(exec, /<phase>verify<\/phase>/, 'the JaCoCo report is not bound to verify');
  const formats = /<formats>([\s\S]*?)<\/formats>/.exec(plugin)?.[1];
  if (formats) {
    assert.match(formats, /<format>XML<\/format>/);
    assert.match(formats, /<format>HTML<\/format>/);
  }
});

Given('the .NET analyzer test project', function (this: DevArchWorld) {
  this.data.csproj = productFile('engine/src/test/dotnet/DotNetAnalyzer.Tests/DotNetAnalyzer.Tests.csproj');
});

Then('it references a coverage collector', function (this: DevArchWorld) {
  assert.match(this.data.csproj as string, /<PackageReference Include="coverlet\.collector"/);
});

Then('the product test script runs the .NET analyzer tests collecting coverage excluding the category {string}', function (this: DevArchWorld, category: string) {
  const body = bashFunction(productFile('scripts/test.sh'), 'run_engine');
  const line = body.split('\n').find((l) => /^\s*dotnet test /.test(l));
  assert.ok(line, 'run_engine runs no dotnet test');
  assert.ok(line.includes(`Category!=${category}`), line);
  assert.match(line, /--collect[ =]"?XPlat Code Coverage"?/, line);
});

