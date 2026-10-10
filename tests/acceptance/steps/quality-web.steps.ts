// 011-quality-delivery — US1 (type check and lint block the web build) and the web parts of US3/US4 (coverage,
// API route and engine client unit tests). Commands run for real in the product checkout.
import { Given, Then, When } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { layout } from '../support/layout.ts';
import { run } from '../support/process.ts';
import { bashFunction, filesUnder, job, npmWeb, productFile, stepsOf, tolerates, webCoverageTargets, workflow } from '../support/quality.ts';
import type { DevArchWorld } from '../support/world.ts';

// --- TS-001 -------------------------------------------------------------------------------------------------

Given('the web build configuration', function (this: DevArchWorld) {
  this.data.nextConfig = productFile('web/next.config.ts');
});

Then('it contains no option that ignores type errors during the build', function (this: DevArchWorld) {
  assert.doesNotMatch(this.data.nextConfig as string, /ignoreBuildErrors/, 'next.config.ts still ignores type errors');
});

Then('it contains no option that ignores lint errors during the build', function (this: DevArchWorld) {
  assert.doesNotMatch(this.data.nextConfig as string, /ignoreDuringBuilds/, 'next.config.ts still ignores lint errors');
});

// --- TS-002 / TS-004 ----------------------------------------------------------------------------------------

When('the web type check is executed', function (this: DevArchWorld) {
  this.result = npmWeb('typecheck');
});

Then('it reports {int} type errors', function (this: DevArchWorld, n: number) {
  const errors = this.result!.output.match(/error TS\d+/g) ?? [];
  assert.equal(errors.length, n, this.result!.output.slice(-4000));
});

Then('the type check configuration excludes no web source or test file', function (this: DevArchWorld) {
  const tsconfig = JSON.parse(productFile('web/tsconfig.json')) as { include?: string[]; exclude?: string[] };
  assert.ok((tsconfig.include ?? []).includes('**/*.ts') && (tsconfig.include ?? []).includes('**/*.tsx'),
    `tsconfig include ${JSON.stringify(tsconfig.include)}`);
  const allowed = new Set(['node_modules', '.next', 'coverage', 'engine-dist']);
  const extra = (tsconfig.exclude ?? []).filter((e) => !allowed.has(e.replace(/\/\*\*$/, '')));
  assert.deepEqual(extra, [], 'tsconfig excludes web files');
  const script = (JSON.parse(productFile('web/package.json')) as { scripts: Record<string, string> }).scripts.typecheck;
  assert.match(script, /^tsc --noEmit\b/, `typecheck script: ${script}`);
});

Given('a temporary web source file with a type error', function (this: DevArchWorld) {
  const file = path.join(layout.webDir, 'src', `__typecheck_probe_${process.pid}__.ts`);
  writeFileSync(file, "// Temporary probe of 011 TS-004 (removed after the scenario).\nexport const probe: number = 'not a number';\n");
  this.cleanup.push(file);
  this.data.probe = path.relative(layout.webDir, file).split(path.sep).join('/');
});

Then('the output names the temporary web source file', function (this: DevArchWorld) {
  assert.ok(this.result!.output.includes(this.data.probe as string), this.result!.output.slice(-3000));
});

// --- TS-003 -------------------------------------------------------------------------------------------------

Given('the web lint configuration', function (this: DevArchWorld) {
  this.data.eslint = productFile('web/eslint.config.mjs');
});

Then('it extends the framework rule set {string}', function (this: DevArchWorld, ruleSet: string) {
  assert.ok((this.data.eslint as string).includes(`'${ruleSet}'`) || (this.data.eslint as string).includes(`"${ruleSet}"`),
    `eslint.config.mjs does not extend ${ruleSet}`);
});

Then('it disables no rule globally', function (this: DevArchWorld) {
  const cfg = this.data.eslint as string;
  assert.doesNotMatch(cfg, /['"]off['"]|:\s*0\s*[,}\]]/, 'a lint rule is disabled in eslint.config.mjs');
  assert.doesNotMatch(cfg, /eslint-disable/, 'eslint-disable in the lint configuration');
});

When('the web lint is executed', function (this: DevArchWorld) {
  this.result = npmWeb('lint');
});

Then('it reports {int} lint errors', function (this: DevArchWorld, n: number) {
  const errors = this.result!.output.split('\n').filter((l) => /\d+:\d+\s+Error:/.test(l));
  assert.equal(errors.length, n, this.result!.output.slice(-4000));
});

// --- TS-005 -------------------------------------------------------------------------------------------------

Given('the product test script', function (this: DevArchWorld) {
  this.data.testScript = productFile('scripts/test.sh');
});

Then('its web subset runs the web type check, the web lint and the web unit tests', function (this: DevArchWorld) {
  const body = bashFunction(this.data.testScript as string, 'run_web');
  for (const re of [/npm run typecheck -w web/, /npm run lint -w web/, /npm test -w web/]) {
    assert.match(body, re, `run_web does not run ${re}`);
  }
  assert.doesNotMatch(body, /\bnpx\b|\|\|\s*true/, 'run_web uses npx or tolerates failures');
});

Then('the web job runs the web type check and the web lint without tolerating failure', function (this: DevArchWorld) {
  const web = job(workflow(this), 'web');
  for (const re of [/npm run typecheck -w web/, /npm run lint -w web/]) {
    const step = stepsOf(web).find((s) => re.test(String(s.run ?? '')));
    assert.ok(step, `the web job does not run ${re}`);
    assert.ok(!tolerates(web, step), `the web job tolerates the failure of ${re}`);
  }
});

// --- TS-013 / TS-014 ----------------------------------------------------------------------------------------

type Summary = { lines: { covered: number; total: number; pct: number }; files: Record<string, { covered: number; total: number; pct: number }> };

When('the web unit tests are executed with coverage', function (this: DevArchWorld) {
  this.result = npmWeb('coverage');
});

Then('a machine-readable web coverage report and a per-file summary exist', function (this: DevArchWorld) {
  const lcov = path.join(layout.webDir, 'coverage', 'lcov.info');
  const summary = path.join(layout.webDir, 'coverage', 'summary.json');
  assert.ok(existsSync(lcov) && /^SF:/m.test(readFileSync(lcov, 'utf8')), 'no web/coverage/lcov.info');
  assert.ok(existsSync(summary), 'no web/coverage/summary.json');
  this.data.summary = JSON.parse(readFileSync(summary, 'utf8')) as Summary;
});

Then('every non-visual server, API route and utility module of the web appears in the summary', function (this: DevArchWorld) {
  const summary = this.data.summary as Summary;
  const targets = webCoverageTargets();
  assert.ok(targets.length >= 30, `only ${targets.length} target modules`);
  const missing = targets.filter((t) => !summary.files[t]);
  assert.deepEqual(missing, [], 'modules never loaded by the web unit tests');
});

Then('the aggregate line coverage of those modules is at least {int} percent', function (this: DevArchWorld, min: number) {
  const summary = this.data.summary as Summary;
  let covered = 0;
  let total = 0;
  for (const t of webCoverageTargets()) {
    covered += summary.files[t].covered;
    total += summary.files[t].total;
  }
  const pct = (100 * covered) / total;
  assert.ok(pct >= min, `aggregate line coverage ${pct.toFixed(2)}% < ${min}%`);
  assert.ok(Math.abs(summary.lines.pct - pct) < 0.01, `summary pct ${summary.lines.pct} != recomputed ${pct}`);
});

function syntheticLcov(world: DevArchWorld, hits: (file: string) => number, skip?: string): void {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'devarch-011-lcov-'));
  world.cleanup.push(dir);
  const body = webCoverageTargets()
    .filter((f) => f !== skip)
    .map((f) => `TN:\nSF:${f}\nLF:100\nLH:${hits(f)}\nend_of_record`)
    .join('\n');
  const file = path.join(dir, 'lcov.info');
  writeFileSync(file, `${body}\n`);
  world.data.lcov = file;
}

Given('a web coverage summary where a target module was never loaded', function (this: DevArchWorld) {
  const missing = webCoverageTargets().find((f) => f.startsWith('src/app/api/'))!;
  this.data.missingModule = missing;
  syntheticLcov(this, () => 100, missing);
});

Given('a web coverage summary with an aggregate line coverage of {int} percent', function (this: DevArchWorld, pct: number) {
  this.data.missingModule = undefined;
  syntheticLcov(this, () => pct);
});

When('the web coverage check evaluates it', function (this: DevArchWorld) {
  this.result = run('node', ['scripts/run-tests.mjs', '--check', this.data.lcov as string], { cwd: layout.webDir });
});

Then('it fails naming the missing module', function (this: DevArchWorld) {
  assert.notEqual(this.result!.code, 0, this.result!.output);
  assert.ok(this.result!.output.includes(this.data.missingModule as string), this.result!.output);
});

Then('it fails naming the threshold of {int} percent', function (this: DevArchWorld, pct: number) {
  assert.notEqual(this.result!.code, 0, this.result!.output);
  assert.ok(this.result!.output.includes(`${pct}%`), this.result!.output);
});

// --- TS-018 -------------------------------------------------------------------------------------------------

const IMPORT = /(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g;

function importsOf(file: string): string[] {
  const out: string[] = [];
  for (const m of readFileSync(file, 'utf8').matchAll(IMPORT)) {
    const spec = m[1];
    let target: string | null = null;
    if (spec.startsWith('.')) target = path.resolve(path.dirname(file), spec);
    else if (spec.startsWith('@/')) target = path.join(layout.webDir, 'src', spec.slice(2));
    if (target) out.push(target.replace(/\.(ts|tsx)$/, ''));
  }
  return out;
}

Given('the API route modules of the web', function (this: DevArchWorld) {
  const routes = filesUnder(path.join(layout.webDir, 'src', 'app', 'api')).filter((f) => path.basename(f) === 'route.ts');
  assert.ok(routes.length >= 9, `only ${routes.length} API route modules`);
  this.data.routes = routes;
});

Then('each route module is imported by a web unit test', function (this: DevArchWorld) {
  const tests = filesUnder(path.join(layout.webDir, 'src')).filter((f) => f.endsWith('.test.ts'));
  const byRoute: Record<string, string[]> = {};
  for (const r of this.data.routes as string[]) {
    const key = r.replace(/\.ts$/, '');
    byRoute[r] = tests.filter((t) => importsOf(t).includes(key));
  }
  const untested = Object.entries(byRoute).filter(([, t]) => t.length === 0).map(([r]) => path.relative(layout.webDir, r));
  assert.deepEqual(untested, [], 'API route modules without unit tests');
  this.data.routeTests = byRoute;
});

Then('the unit tests of each route module assert a success status and an error status', function (this: DevArchWorld) {
  const problems: string[] = [];
  for (const [route, tests] of Object.entries(this.data.routeTests as Record<string, string[]>)) {
    const text = tests.map((t) => readFileSync(t, 'utf8')).join('\n');
    const statuses = [...text.matchAll(/status,\s*(\d{3})\b/g)].map((m) => Number(m[1]));
    if (!statuses.some((s) => s >= 200 && s < 300)) problems.push(`${path.relative(layout.webDir, route)}: no 2xx assertion`);
    if (!statuses.some((s) => s >= 400)) problems.push(`${path.relative(layout.webDir, route)}: no error status assertion`);
  }
  assert.deepEqual(problems, []);
});

// --- TS-019 -------------------------------------------------------------------------------------------------

When('the engine client unit tests are executed', function (this: DevArchWorld) {
  const dir = path.join(layout.webDir, 'src', 'server', 'engine');
  const files = filesUnder(dir).filter((f) => /engine-client.*\.test\.ts$/.test(path.basename(f)))
    .map((f) => path.relative(layout.webDir, f));
  assert.ok(files.length > 0, 'no engine client unit tests');
  this.result = run('node', ['--import', 'tsx', '--test', '--test-reporter=tap', ...files], { cwd: layout.webDir, timeoutMs: 5 * 60 * 1000 });
});

// "they pass" is the shared step of product-contract.steps.ts (exit code 0 of this.result).

Then('they include cases for the engine start, a successful response, a tool error, a process crash and a timeout', function (this: DevArchWorld) {
  const names = [...this.result!.stdout.matchAll(/^\s*ok \d+ - (.+)$/gm)].map((m) => m[1].toLowerCase());
  const wanted: Record<string, RegExp> = {
    start: /\bstart/, success: /success/, 'tool error': /tool error/, crash: /crash/, timeout: /timeout|timed out/,
  };
  const missing = Object.entries(wanted).filter(([, re]) => !names.some((n) => re.test(n))).map(([k]) => k);
  assert.deepEqual(missing, [], `engine client tests:\n${names.join('\n')}`);
});
