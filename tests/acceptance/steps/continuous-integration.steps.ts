// US5 — Continuous integration per area (TS-025..TS-030), evaluated over the workflow definition:
// `on.*.paths` decides whether the workflow runs; the `changes` job (dorny/paths-filter) decides which area
// checks run. Area checks are the jobs gated by exactly one `needs.changes.outputs.<filter> == 'true'`.
import { Given, Then, When } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import picomatch from 'picomatch';
import { parse } from 'yaml';
import { layout } from '../support/layout.ts';
import type { DevArchWorld } from '../support/world.ts';

type Step = { name?: string; uses?: string; run?: string; with?: Record<string, unknown>; 'continue-on-error'?: unknown };
type Job = { if?: string; needs?: string | string[]; steps?: Step[]; 'timeout-minutes'?: number; 'continue-on-error'?: unknown; strategy?: { matrix?: { include?: { rid?: string }[]; rid?: string[] } } };
type Workflow = { on: Record<string, { paths?: string[]; tags?: string[]; branches?: string[] }>; jobs: Record<string, Job> };

export const WORKFLOW = path.join('.github', 'workflows', 'dev-arch.yml');
const AREA_GATE = /^\s*(?:\$\{\{\s*)?needs\.changes\.outputs\.([\w-]+)\s*==\s*'true'\s*(?:\}\})?\s*$/;

function steps(job: Job): Step[] {
  return job.steps ?? [];
}

function tolerates(job: Job, step: Step): boolean {
  const truthy = (v: unknown) => v === true || String(v) === 'true';
  return truthy(job['continue-on-error']) || truthy(step['continue-on-error']) || String(step.run ?? '').includes('|| true');
}

function areaJobs(wf: Workflow): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, job] of Object.entries(wf.jobs)) {
    const m = AREA_GATE.exec(String(job.if ?? ''));
    if (m) out[name] = m[1];
  }
  return out;
}

function filters(wf: Workflow): Record<string, string[]> {
  const step = steps(wf.jobs.changes ?? {}).find((s) => String(s.uses ?? '').startsWith('dorny/paths-filter@'));
  assert.ok(step, 'the changes job does not use dorny/paths-filter');
  const raw = step.with?.filters;
  return (typeof raw === 'string' ? parse(raw) : raw) as Record<string, string[]>;
}

const matches = (patterns: string[], file: string) => patterns.some((p) => picomatch(p, { dot: true })(file));

Given('the product continuous integration definition', function (this: DevArchWorld) {
  const file = path.join(layout.monorepoRoot, WORKFLOW);
  assert.ok(existsSync(file), `missing ${WORKFLOW} at the monorepo root`);
  this.data.workflow = parse(readFileSync(file, 'utf8')) as Workflow;
});

When('a change touches only {string}', function (this: DevArchWorld, file: string) {
  const wf = this.data.workflow as Workflow;
  const events = ['push', 'pull_request'].map((e) => wf.on[e]).filter(Boolean);
  assert.ok(events.length === 2, 'the workflow must run on push and pull_request');
  this.data.triggered = events.some((e) => matches(e.paths ?? ['**'], file));
  const changed = Object.entries(filters(wf)).filter(([, patterns]) => matches(patterns, file)).map(([name]) => name);
  this.data.checks = Object.entries(areaJobs(wf))
    .filter(([, filter]) => changed.includes(filter))
    .map(([job]) => job);
});

Then('the triggered checks are exactly {string}', function (this: DevArchWorld, expected: string) {
  assert.equal(this.data.triggered, true, 'the workflow is not triggered by this change');
  const want = expected.split(',').map((s) => s.trim()).sort();
  assert.deepEqual([...(this.data.checks as string[])].sort(), want);
});

Then('the workflow is not triggered', function (this: DevArchWorld) {
  assert.equal(this.data.triggered, false, 'the dev-arch workflow is triggered by a change outside the product');
});

When('the jobs are inspected', function (this: DevArchWorld) {
  const wf = this.data.workflow as Workflow;
  assert.ok(Object.keys(wf.jobs).length > 0, 'the workflow has no jobs');
});

When('the engine jobs are inspected', function (this: DevArchWorld) {
  const wf = this.data.workflow as Workflow;
  assert.ok(wf.jobs['engine-java'] && wf.jobs['engine-dotnet'], 'missing engine-java or engine-dotnet job');
});

When('the release job is inspected', function (this: DevArchWorld) {
  const wf = this.data.workflow as Workflow;
  assert.ok(wf.jobs.release, 'missing release job');
});

// --- TS-027 -----------------------------------------------------------------------------------------

function setupVersion(job: Job, action: string, key: string): string {
  const step = steps(job).find((s) => String(s.uses ?? '').startsWith(`${action}@`));
  return step ? String(step.with?.[key] ?? '') : '';
}

Then(
  'a job runs {string} with JDK {int}, .NET {int} and Node {int}',
  function (this: DevArchWorld, command: string, jdk: number, dotnet: number, node: number) {
    const wf = this.data.workflow as Workflow;
    const jobs = Object.entries(wf.jobs).filter(([, j]) => steps(j).some((s) => String(s.run ?? '').includes(command)));
    assert.ok(jobs.length > 0, `no job runs ${command}`);
    const [name, job] = jobs[0];
    this.data.schemaJob = job;
    this.data.command = command;
    assert.equal(setupVersion(job, 'actions/setup-java', 'java-version'), String(jdk), `${name}: JDK`);
    assert.ok(setupVersion(job, 'actions/setup-dotnet', 'dotnet-version').startsWith(`${dotnet}.`), `${name}: .NET`);
    assert.equal(setupVersion(job, 'actions/setup-node', 'node-version'), String(node), `${name}: Node`);
  },
);

Then('that job is not configured to tolerate failure', function (this: DevArchWorld) {
  const job = this.data.schemaJob as Job;
  for (const step of steps(job).filter((s) => String(s.run ?? '').includes(this.data.command as string))) {
    assert.ok(!tolerates(job, step), 'the contract check tolerates failure');
  }
});

// --- TS-028 -----------------------------------------------------------------------------------------

function runs(wf: Workflow, job: string): Step[] {
  return steps(wf.jobs[job]).filter((s) => s.run);
}

Then('static analysis runs with the SpotBugs exclude filter', function (this: DevArchWorld) {
  const wf = this.data.workflow as Workflow;
  assert.ok(
    runs(wf, 'engine-java').some((s) => /spotbugs.*:check/.test(s.run!) && s.run!.includes('-Dspotbugs.excludeFilterFile=spotbugs-exclude.xml')),
    'no SpotBugs check with spotbugs-exclude.xml in engine-java',
  );
});

Then('Checkstyle runs with a maximum of {int} allowed violations', function (this: DevArchWorld, max: number) {
  const wf = this.data.workflow as Workflow;
  assert.ok(
    runs(wf, 'engine-java').some((s) => s.run!.includes('checkstyle:check') && s.run!.includes(`-Dcheckstyle.maxAllowedViolations=${max}`)),
    `no Checkstyle check with maxAllowedViolations=${max}`,
  );
});

Then('the .NET tests exclude the category {string}', function (this: DevArchWorld, category: string) {
  const wf = this.data.workflow as Workflow;
  assert.ok(
    runs(wf, 'engine-dotnet').some((s) => /dotnet test/.test(s.run!) && s.run!.includes(`Category!=${category}`)),
    `no dotnet test excluding ${category}`,
  );
});

Then('the .NET format verification runs without tolerating failure', function (this: DevArchWorld) {
  const wf = this.data.workflow as Workflow;
  const job = wf.jobs['engine-dotnet'];
  const step = runs(wf, 'engine-dotnet').find((s) => s.run!.includes('dotnet format') && s.run!.includes('--verify-no-changes'));
  assert.ok(step, 'no dotnet format --verify-no-changes step');
  assert.ok(!tolerates(job, step), 'dotnet format verification tolerates failure');
});

// --- TS-029 -----------------------------------------------------------------------------------------

Then(
  'it is triggered by tags matching {string} and by pushes to main with engine changes',
  function (this: DevArchWorld, tagPattern: string) {
    const wf = this.data.workflow as Workflow;
    assert.ok((wf.on.push?.tags ?? []).includes(tagPattern), `push.tags does not include ${tagPattern}`);
    const cond = String(wf.jobs.release.if ?? '');
    assert.ok(cond.includes(`refs/tags/${tagPattern.replace('*', '')}`), `release if does not check ${tagPattern}: ${cond}`);
    assert.ok(cond.includes("refs/heads/main"), 'release if does not check pushes to main');
    assert.ok(/needs\.changes\.outputs\.engine-(java|dotnet)/.test(cond), 'release on main is not limited to engine changes');
  },
);

Then('it depends on the Java and .NET engine jobs', function (this: DevArchWorld) {
  const wf = this.data.workflow as Workflow;
  const needs = ([] as string[]).concat(wf.jobs.release.needs ?? []);
  assert.ok(needs.includes('engine-java') && needs.includes('engine-dotnet'), `release needs ${needs}`);
});

Then(
  'it builds the platforms {string}, {string}, {string} and {string} as framework-dependent',
  function (this: DevArchWorld, a: string, b: string, c: string, d: string) {
    const wf = this.data.workflow as Workflow;
    const matrix = wf.jobs.release.strategy?.matrix ?? {};
    const rids = (matrix.include ?? []).map((i) => i.rid).concat(matrix.rid ?? []);
    assert.deepEqual([...new Set(rids)].sort(), [a, b, c, d].sort());
    const publish = runs(wf, 'release').find((s) => s.run!.includes('dotnet publish'));
    assert.ok(publish, 'release does not publish the .NET analyzer');
    assert.ok(publish.run!.includes('--self-contained false') && !publish.run!.includes('PublishSingleFile=true'),
      'release publish is not framework-dependent');
  },
);

// --- TS-030 -----------------------------------------------------------------------------------------

Then('every area job declares a timeout of at most {int} minutes', function (this: DevArchWorld, max: number) {
  const wf = this.data.workflow as Workflow;
  const areas = Object.keys(areaJobs(wf));
  assert.ok(areas.length >= 4, `expected the area jobs, found ${areas}`);
  for (const name of areas) {
    const t = wf.jobs[name]['timeout-minutes'];
    assert.ok(typeof t === 'number' && t <= max, `${name} timeout-minutes=${t}`);
  }
});
