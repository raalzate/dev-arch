// 014-standalone-repo (TS-001..TS-010): own repository with the product at the root, CI in the repository, guards
// bounded to their own commit range and the front-page documentation of the thesis with real screenshots.
import { Given, Then, When } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { git, gitOk } from '../support/git.ts';
import { assertionHash } from '../support/iikit-hash.ts';
import { layout } from '../support/layout.ts';
import type { DevArchWorld } from '../support/world.ts';

const root = () => layout.productRoot;
const read = (rel: string) => readFileSync(path.join(root(), rel), 'utf8');

/** Last commit of feature 013 before this feature (base of 014). */
export const CLOSING_013_COMMIT = 'c9100f51c44a';

/** Locked scenarios re-testified by 014 (plan.md "Re-testify"). */
const RETESTIFIED = new Set([
  'specs/006-devarch-monorepo/tests/features/build-and-test.feature',
  'specs/006-devarch-monorepo/tests/features/continuous-integration.feature',
  'specs/006-devarch-monorepo/tests/features/repository-structure.feature',
  'specs/006-devarch-monorepo/tests/features/unified-configuration.feature',
  'specs/007-native-engine-runtime/tests/features/sync-compatibility.feature',
  'specs/011-quality-delivery/tests/features/guards.feature',
  'specs/012-install-doctor-docker/tests/features/container.feature',
  'specs/012-install-doctor-docker/tests/features/guards.feature',
  'specs/013-agent-mcp-bridge/tests/features/guards.feature',
]);

/** Files of code, scripts, containers, CI and tests (documentation and specifications are history, not code). */
const CODE = /\.(ts|tsx|js|mjs|cjs|java|cs|vb|sh|ya?ml|json|xml|properties|csproj|vbproj|props|targets)$|(^|\/)(Makefile|Dockerfile[^/]*|\.gitignore|\.editorconfig)$/;

// --- TS-001 --------------------------------------------------------------------------------------------------

Given('the repository checkout', function (this: DevArchWorld) {
  this.data.tracked = git(['ls-files'], root()).split('\n').filter(Boolean);
});

Then('the repository root is the product root', function () {
  assert.equal(path.resolve(layout.monorepoRoot), path.resolve(layout.productRoot));
  assert.equal(git(['rev-parse', '--show-toplevel'], root()), path.resolve(root()));
  for (const area of ['engine', 'web', 'schema', 'docker', 'docs', 'specs']) assert.ok(existsSync(path.join(root(), area)), area);
});

Then('there is no {string} directory', function (this: DevArchWorld, dir: string) {
  assert.ok(!existsSync(path.join(root(), dir)));
  assert.ok(!(this.data.tracked as string[]).some((f) => f.startsWith(`${dir}/`)));
});

Then('no code, script, container or test file refers to {string}', function (this: DevArchWorld, needle: string) {
  const offenders = (this.data.tracked as string[])
    .filter((f) => !f.startsWith('specs/') && !f.startsWith('.specify/') && CODE.test(f))
    .filter((f) => existsSync(path.join(root(), f)) && read(f).includes(needle));
  assert.deepEqual(offenders, []);
});

// --- TS-002 --------------------------------------------------------------------------------------------------

Given('the repository history', function (this: DevArchWorld) {
  this.data.subjects = git(['log', '--format=%s', 'HEAD'], root()).split('\n');
});

Then('it contains commits of every feature from {string} to {string}', function (this: DevArchWorld, from: string, to: string) {
  const features = readdirSync(path.join(root(), 'specs')).filter((d) => /^\d{3}-/.test(d)).sort()
    .filter((d) => d >= from && d <= to);
  assert.ok(features.length >= 8, features.join(', '));
  const subjects = this.data.subjects as string[];
  for (const f of features) assert.ok(subjects.some((s) => s.includes(f) || s.includes(f.replace(/^\d{3}-/, ''))), `no commit of ${f}`);
});

Then('the tag {string} points to a commit of feature {string}', function (this: DevArchWorld, tag: string, feature: string) {
  assert.ok(gitOk(['rev-parse', '--verify', '--quiet', `refs/tags/${tag}^{commit}`], root()), `missing tag ${tag}`);
  assert.match(git(['log', '-1', '--format=%s', `${tag}^{commit}`], root()), new RegExp(feature));
});

// --- TS-004 --------------------------------------------------------------------------------------------------

type Job = { 'working-directory'?: string; defaults?: { run?: { 'working-directory'?: string } }; steps?: { 'working-directory'?: string; with?: Record<string, unknown>; uses?: string }[] };

Then('its path filters refer to the areas at the repository root without {string}', function (this: DevArchWorld, prefix: string) {
  const wf = this.data.workflow as { on: Record<string, { paths?: string[] }>; jobs: Record<string, Job> };
  const filterStep = (wf.jobs.changes?.steps ?? []).find((s) => String(s.uses ?? '').startsWith('dorny/paths-filter@'));
  const raw = filterStep?.with?.filters;
  const filters = (typeof raw === 'string' ? parse(raw) : raw) as Record<string, string[]>;
  const patterns = [...Object.values(filters).flat(), ...(wf.on.push.paths ?? []), ...(wf.on.pull_request.paths ?? [])];
  assert.ok(patterns.length > 10);
  for (const p of patterns) {
    assert.ok(!p.includes(prefix), p);
    const first = p.split('/')[0];
    assert.ok(existsSync(path.join(root(), first)), `${p}: ${first} is not at the repository root`);
  }
});

Then('it declares the jobs {string}, {string}, {string}, {string}, {string}, {string} and {string}', function (
  this: DevArchWorld, j1: string, j2: string, j3: string, j4: string, j5: string, j6: string, j7: string,
) {
  const jobs = Object.keys((this.data.workflow as { jobs: Record<string, unknown> }).jobs);
  for (const j of [j1, j2, j3, j4, j5, j6, j7]) assert.ok(jobs.includes(j), `no job ${j}`);
});

Then('every job runs from the repository root', function (this: DevArchWorld) {
  const wf = this.data.workflow as { defaults?: { run?: { 'working-directory'?: string } }; jobs: Record<string, Job> };
  const top = wf.defaults?.run?.['working-directory'];
  assert.ok(!top || top === '.', `workflow working-directory ${top}`);
  for (const [name, job] of Object.entries(wf.jobs)) {
    const dirs = [job.defaults?.run?.['working-directory'], ...(job.steps ?? []).map((s) => s['working-directory'])].filter(Boolean) as string[];
    for (const d of dirs) assert.ok(d === '.' || d === 'dist' || existsSync(path.join(root(), d)), `${name}: working-directory ${d}`);
  }
});

// --- TS-005..TS-008 (documentation) --------------------------------------------------------------------------

Given('the repository front page', function (this: DevArchWorld) {
  this.data.readme = read('README.md');
});

Given('the repository front page and the documentation', function (this: DevArchWorld) {
  const docs = readdirSync(path.join(root(), 'docs')).filter((f) => f.endsWith('.md')).map((f) => ({ file: `docs/${f}`, text: read(`docs/${f}`) }));
  this.data.pages = [{ file: 'README.md', text: read('README.md') }, ...docs];
});

Given('the continuous modernization guide', function (this: DevArchWorld) {
  this.data.guide = read('docs/CONTINUOUS-MODERNIZATION.md');
});

const readme = (w: DevArchWorld) => w.data.readme as string;

Then('it explains that the analysis is deterministic and reproducible', function (this: DevArchWorld) {
  assert.match(readme(this), /determin/i);
  assert.match(readme(this), /reproducib|misma entrada|same input/i);
});

Then('it explains that AI models refactor while the deterministic analysis states how the project is without inventing', function (this: DevArchWorld) {
  assert.match(readme(this), /refactori/i);
  assert.match(readme(this), /sin inventar|alucin|without (inventing|hallucinat)/i);
});

Then('it explains that repeated analysis acts as a guardrail of principles and good practices', function (this: DevArchWorld) {
  assert.match(readme(this), /guardrail/i);
  assert.match(readme(this), /buenas pr[aá]cticas|good practices/i);
  assert.match(readme(this), /principios|principles/i);
});

Then('it explains continuous modernization', function (this: DevArchWorld) {
  assert.match(readme(this), /modernizaci[oó]n continua|continuous modernization/i);
});

const IMAGE = /!\[[^\]]*\]\(([^)\s]+\.png)\)/g;

function images(w: DevArchWorld): { page: string; src: string; file: string }[] {
  return (w.data.pages as { file: string; text: string }[]).flatMap((p) =>
    [...p.text.matchAll(IMAGE)].map((m) => ({ page: p.file, src: m[1], file: path.normalize(path.join(path.dirname(p.file), m[1])) })));
}

Then('they reference screenshots of the summary, system map, proposals, findings and plan steps', function (this: DevArchWorld) {
  const srcs = images(this).map((i) => i.src).join(' ');
  for (const step of ['summary', 'map', 'proposals', 'findings', 'plan']) assert.match(srcs, new RegExp(step), `no ${step} screenshot`);
});

Then('they reference a screenshot of the agent connection', function (this: DevArchWorld) {
  assert.match(images(this).map((i) => i.src).join(' '), /agent/);
});

Then('every referenced image exists in the repository and is a PNG of at least {int} KB', function (this: DevArchWorld, kb: number) {
  const list = images(this);
  assert.ok(list.length >= 6, `only ${list.length} images`);
  for (const i of list) {
    const abs = path.join(root(), i.file);
    assert.ok(existsSync(abs), `${i.page}: missing ${i.src}`);
    assert.ok(gitOk(['ls-files', '--error-unmatch', i.file], root()), `${i.file} is not versioned`);
    const buf = readFileSync(abs);
    assert.ok(buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), `${i.file} is not a PNG`);
    assert.ok(statSync(abs).size >= kb * 1024, `${i.file} is smaller than ${kb} KB`);
  }
});

Then('the quick start clones {string}', function (this: DevArchWorld, repo: string) {
  assert.ok(readme(this).includes(`git clone https://github.com/${repo}.git`), 'no git clone of the repository');
});

Then('it builds from the root, starts the web or the container and links the agent connection guide', function (this: DevArchWorld) {
  const r = readme(this);
  assert.match(r, /make build/);
  assert.match(r, /make dev|docker compose -f docker\/compose\.yaml up/);
  assert.match(r, /\(docs\/AGENTS-MCP\.md\)/);
});

Then('it describes the loop analyze, refactor with AI, analyze again and compare', function (this: DevArchWorld) {
  const g = this.data.guide as string;
  for (const re of [/analiz/i, /refactori/i, /reanaliz|analizar de nuevo|vuelve a analizar/i, /compar/i]) assert.match(g, re);
});

Then('it names the indicators findings by severity, coupling, cohesion and viability', function (this: DevArchWorld) {
  const g = this.data.guide as string;
  for (const re of [/severidad|severity/i, /acoplamiento|coupling/i, /cohesi[oó]n|cohesion/i, /viabilidad|viability/i]) assert.match(g, re);
});

// --- TS-009 / TS-010 (guards) --------------------------------------------------------------------------------

When('the product is compared with the closing commit of feature 013', function (this: DevArchWorld) {
  assert.ok(gitOk(['cat-file', '-e', `${CLOSING_013_COMMIT}^{commit}`], root()), `commit ${CLOSING_013_COMMIT} is not available`);
  this.data.modifiedFeatures = git(['diff', '--name-only', '--no-renames', '--diff-filter=MD', CLOSING_013_COMMIT, 'HEAD', '--', 'specs'], root())
    .split('\n').filter((f) => f.endsWith('.feature'));
});

Then('the only modified {string} files are the re-testified ones of features 006, 007, 011, 012 and 013', function (this: DevArchWorld, ext: string) {
  const unexpected = (this.data.modifiedFeatures as string[]).filter((f) => f.endsWith(ext) && !RETESTIFIED.has(f));
  assert.deepEqual(unexpected, []);
});

Then('every assertion integrity hash of features 001 to 014 verifies', function () {
  let verified = 0;
  for (const name of readdirSync(path.join(root(), 'specs')).filter((n) => /^(00\d|01[0-4])-/.test(n))) {
    const ctx = path.join(root(), 'specs', name, 'context.json');
    if (!existsSync(ctx)) continue;
    const expected = JSON.parse(readFileSync(ctx, 'utf8'))?.testify?.assertion_hash as string | undefined;
    if (!expected) continue;
    assert.equal(assertionHash(path.join(root(), 'specs', name, 'tests', 'features')), expected, `assertion hash of ${name}`);
    verified++;
  }
  assert.ok(verified >= 12, `only ${verified} hashes verified`);
});

const GUARDS: Record<string, string> = {
  '007': 'specs/007-native-engine-runtime/tests/features/sync-compatibility.feature',
  '011': 'specs/011-quality-delivery/tests/features/guards.feature',
  '012': 'specs/012-install-doctor-docker/tests/features/guards.feature',
  '013': 'specs/013-agent-mcp-bridge/tests/features/guards.feature',
};

Given('the guard scenarios of features 007, 011, 012 and 013', function (this: DevArchWorld) {
  this.data.guards = Object.fromEntries(Object.entries(GUARDS).map(([n, f]) => [n, read(f)]));
});

Then('each compares the closing commit of its feature with the base of its feature', function (this: DevArchWorld) {
  for (const [n, text] of Object.entries(this.data.guards as Record<string, string>)) {
    assert.match(text, new RegExp(`When the product at the closing commit "[0-9a-f]{12,40}" of feature ${n} is compared with`), `guard of ${n}`);
  }
});

Then('every commit they reference exists in this repository', function (this: DevArchWorld) {
  for (const text of Object.values(this.data.guards as Record<string, string>)) {
    for (const [, sha] of text.matchAll(/"([0-9a-f]{12,40})"/g)) assert.ok(gitOk(['cat-file', '-e', `${sha}^{commit}`], root()), `missing commit ${sha}`);
    for (const [, tag] of text.matchAll(/tag "([^"]+)"/g)) assert.ok(gitOk(['rev-parse', '--verify', '--quiet', `refs/tags/${tag}`], root()), `missing tag ${tag}`);
  }
});
