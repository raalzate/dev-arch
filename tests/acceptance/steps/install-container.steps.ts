// 012-install-doctor-docker — US3 (image, Compose, CI job, smoke test). Docker is not required: the image and
// Compose definitions are validated statically; the real build and smoke test run in the CI job "docker".
import { Given, Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { layout } from '../support/layout.ts';
import { job, stepsOf, workflow, type CiStep } from '../support/quality.ts';
import type { DevArchWorld } from '../support/world.ts';

type Instruction = { op: string; args: string };
type Stage = { name: string; base: string; instructions: Instruction[] };

/** Parses a Dockerfile: continuation lines joined, comments dropped, ARG defaults substituted in FROM. */
export function parseDockerfile(text: string): { args: Record<string, string>; stages: Stage[] } {
  const logical: string[] = [];
  let current = '';
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (!current && (line.trim().startsWith('#') || !line.trim())) continue;
    if (line.endsWith('\\')) {
      current += `${line.slice(0, -1)} `;
      continue;
    }
    logical.push((current + line).trim());
    current = '';
  }
  const args: Record<string, string> = {};
  const stages: Stage[] = [];
  for (const l of logical) {
    const [op, ...rest] = l.split(/\s+/);
    const a = rest.join(' ');
    if (op.toUpperCase() === 'ARG' && stages.length === 0) {
      const [k, v] = a.split('=');
      args[k] = v ?? '';
      continue;
    }
    if (op.toUpperCase() === 'FROM') {
      const m = /^(?:--platform=\S+\s+)?(\S+)(?:\s+AS\s+(\S+))?$/i.exec(a);
      assert.ok(m, `bad FROM ${a}`);
      const base = m[1].replace(/\$\{(\w+)\}/g, (_, k: string) => args[k] ?? '');
      stages.push({ name: m[2] ?? `#${stages.length}`, base, instructions: [] });
      continue;
    }
    assert.ok(stages.length, `instruction before FROM: ${l}`);
    stages[stages.length - 1].instructions.push({ op: op.toUpperCase(), args: a });
  }
  return { args, stages };
}

const DOCKERFILE = path.join(layout.productRoot, 'docker', 'Dockerfile');
const COMPOSE = path.join(layout.productRoot, 'docker', 'compose.yaml');

function stage(world: DevArchWorld, name: string): Stage {
  const s = (world.data.stages as Stage[]).find((x) => x.name === name);
  assert.ok(s, `no stage ${name}`);
  return s;
}
const resolveBase = (world: DevArchWorld, base: string): Stage | null => (world.data.stages as Stage[]).find((x) => x.name === base) ?? null;
const text = (s: Stage) => s.instructions.map((i) => `${i.op} ${i.args}`).join('\n');

// --- TS-027 -----------------------------------------------------------------------------------------------------

Given('the product image definition', function (this: DevArchWorld) {
  assert.ok(existsSync(DOCKERFILE), 'docker/Dockerfile missing');
  const parsed = parseDockerfile(readFileSync(DOCKERFILE, 'utf8'));
  this.data.stages = parsed.stages;
  this.data.dockerArgs = parsed.args;
});

Then('it has the stages {string}, {string}, {string}, {string} and {string}', function (this: DevArchWorld, names0: string, names1: string, names2: string, names3: string, names4: string) {
  const names = [names0, names1, names2, names3, names4];
  const have = (this.data.stages as Stage[]).map((s) => s.name);
  for (const n of names) assert.ok(have.includes(n), `missing stage ${n} in ${have.join(', ')}`);
});

Then('the stage {string} builds from a Maven image with JDK 17', function (this: DevArchWorld, name: string) {
  const s = stage(this, name);
  assert.match(s.base, /^maven:3\.9[\w.-]*-(eclipse-)?temurin-17/);
  assert.match(text(s), /mvn .*package/);
});

Then('the stage {string} builds from the .NET 8 SDK image for the target architecture', function (this: DevArchWorld, name: string) {
  const s = stage(this, name);
  assert.match(s.base, /^mcr\.microsoft\.com\/dotnet\/sdk:8\.0/);
  const t = text(s);
  assert.match(t, /ARG TARGETARCH/);
  assert.match(t, /dotnet publish .*DotNetAnalyzer\.csproj/);
  assert.match(t, /linux-arm64/);
  assert.match(t, /linux-x64/);
});

Then('the stage {string} builds from a Node 20 image with the standalone output', function (this: DevArchWorld, name: string) {
  const s = stage(this, name);
  assert.match(s.base, /^node:20/);
  assert.match(text(s), /NEXT_OUTPUT=standalone npm run build -w web/);
});

Then('the stage {string} starts from the .NET 8 runtime image and copies a JRE 17 and Node 20, without any SDK or build tool', function (this: DevArchWorld, name: string) {
  const s = stage(this, name);
  assert.match(s.base, /^mcr\.microsoft\.com\/dotnet\/runtime:8\.0/);
  const copies = s.instructions.filter((i) => i.op === 'COPY').map((i) => /--from=(\S+)/.exec(i.args)?.[1]).filter(Boolean) as string[];
  const bases = copies.map((c) => resolveBase(this, c)?.base ?? c);
  assert.ok(bases.some((b) => /^eclipse-temurin:17-jre/.test(b)), `no JRE 17 copied: ${bases.join(', ')}`);
  assert.ok(bases.some((b) => /^node:20/.test(b)), `no Node 20 copied: ${bases.join(', ')}`);
  // Build stages may only hand over their artifacts, never a toolchain (JDK, SDK, Maven, npm).
  const toolchain = /^\/(opt\/java|usr\/share\/(dotnet|maven)|usr\/local\/lib\/node_modules|root\/\.m2)/;
  for (const i of s.instructions.filter((x) => x.op === 'COPY' && x.args.includes('--from='))) {
    const from = /--from=(\S+)/.exec(i.args)![1];
    const base = resolveBase(this, from)?.base ?? from;
    if (!/dotnet\/sdk|maven|-jdk|^node:/.test(base) || /^node:/.test(base) && !resolveBase(this, from)?.instructions.length) continue;
    const sources = i.args.replace(/--\S+/g, '').trim().split(/\s+/).slice(0, -1);
    for (const src of sources) assert.doesNotMatch(src, toolchain, `the final stage copies a toolchain from ${from}: ${src}`);
  }
  assert.doesNotMatch(text(s), /apt-get install|dotnet-sdk|\bmvn\b|npm (ci|install)/, 'the final stage installs build tools');
});

Then('the stage {string} runs as a non-root user, exposes {int} and declares a health check on {string}', function (this: DevArchWorld, name: string, port: number, url: string) {
  const s = stage(this, name);
  const users = s.instructions.filter((i) => i.op === 'USER').map((i) => i.args.trim());
  assert.ok(users.length && !['root', '0'].includes(users[users.length - 1]), `user ${users.join(',')}`);
  assert.ok(s.instructions.some((i) => i.op === 'EXPOSE' && i.args.split(/\s+/).includes(String(port))));
  const hc = s.instructions.find((i) => i.op === 'HEALTHCHECK');
  assert.ok(hc && hc.args.includes(url), 'no HEALTHCHECK on the health endpoint');
});

Then('every file the image copies from the build context exists in the product', function (this: DevArchWorld) {
  const missing: string[] = [];
  for (const s of this.data.stages as Stage[]) {
    for (const i of s.instructions.filter((x) => x.op === 'COPY' && !x.args.includes('--from='))) {
      const parts = i.args.replace(/--\S+/g, '').trim().split(/\s+/);
      for (const src of parts.slice(0, -1)) if (!existsSync(path.join(layout.productRoot, src))) missing.push(src);
    }
  }
  assert.deepEqual(missing, []);
});

// --- TS-028 -----------------------------------------------------------------------------------------------------

type Service = { profiles?: string[]; build?: { context?: string; dockerfile?: string; target?: string }; image?: string; ports?: string[];
  volumes?: string[]; environment?: Record<string, string>; mem_limit?: string; command?: unknown };
type Compose = { name?: string; services: Record<string, Service>; volumes?: Record<string, unknown> };

Given('the product Compose definition', function (this: DevArchWorld) {
  assert.ok(existsSync(COMPOSE), 'docker/compose.yaml missing');
  this.data.compose = parse(readFileSync(COMPOSE, 'utf8')) as Compose;
});

const compose = (w: DevArchWorld) => w.data.compose as Compose;

Then('its services are exactly {string} without profile and {string} in the profile {string}', function (this: DevArchWorld, web: string, dev: string, profile: string) {
  const c = compose(this);
  assert.deepEqual(Object.keys(c.services).sort(), [web, dev].sort());
  assert.equal(c.services[web].profiles, undefined);
  assert.deepEqual(c.services[dev].profiles, [profile]);
});

Then('no service declares another profile, a separate engine or an MCP network transport', function (this: DevArchWorld) {
  const raw = readFileSync(COMPOSE, 'utf8');
  for (const [name, s] of Object.entries(compose(this).services)) {
    for (const p of s.profiles ?? []) assert.equal(p, 'dev', `${name} profile ${p}`);
  }
  assert.doesNotMatch(raw, /split|ENGINE_TRANSPORT|ENGINE_URL|mcp-http|--mcp\b/);
  assert.ok(!Object.keys(compose(this).services).some((n) => /engine/.test(n)), 'separate engine service');
});

Then('the service {string} builds the target {string}, publishes {int}, persists the analysis data in a named volume and limits its memory', function (this: DevArchWorld, name: string, target: string, port: number) {
  const c = compose(this);
  const s = c.services[name];
  assert.equal(s.build?.target, target);
  assert.equal(s.build?.dockerfile, 'docker/Dockerfile');
  assert.ok((s.ports ?? []).some((p) => String(p).endsWith(`:${port}`) && String(p).includes(String(port))), JSON.stringify(s.ports));
  const data = (s.volumes ?? []).find((v) => String(v).endsWith(':/data'));
  assert.ok(data, 'no volume on /data');
  const volName = String(data).split(':')[0];
  assert.ok(c.volumes && volName in c.volumes, `volume ${volName} is not a named volume`);
  assert.equal(s.environment?.ARCHVIEW_DATA_DIR ?? '/data', '/data');
  assert.ok(s.mem_limit, 'no mem_limit');
});

Then('the service {string} passes the optional variables {string}, {string}, {string} and {string}', function (this: DevArchWorld, name: string, vars0: string, vars1: string, vars2: string, vars3: string) {
  const vars = [vars0, vars1, vars2, vars3];
  const env = compose(this).services[name].environment ?? {};
  for (const v of vars) {
    assert.ok(v in env, `${name} does not pass ${v}`);
    assert.match(String(env[v]), new RegExp(`^\\$\\{${v}:?-`), `${v} is not optional: ${env[v]}`);
  }
});

Then('the service {string} builds the target {string}, mounts the product sources and publishes {int}', function (this: DevArchWorld, name: string, target: string, port: number) {
  const s = compose(this).services[name];
  assert.equal(s.build?.target, target);
  assert.ok((s.volumes ?? []).some((v) => String(v).startsWith('..:/app')), JSON.stringify(s.volumes));
  assert.ok((s.ports ?? []).some((p) => new RegExp(`(^|:)${port}:\\d+$`).test(String(p))), JSON.stringify(s.ports));
});

Then('neither the image nor Compose contains configuration of a cloud provider', function () {
  const all = `${readFileSync(DOCKERFILE, 'utf8')}\n${readFileSync(COMPOSE, 'utf8')}`;
  assert.doesNotMatch(all, /\b(railway|cloud ?run|heroku|fly\.io|render\.com|aws|azure|gcloud|vercel)\b/i);
});

// --- TS-029 -----------------------------------------------------------------------------------------------------

const runOf = (s: CiStep) => String(s.run ?? '');
const AREA_GATE = /^\s*(?:\$\{\{\s*)?needs\.changes\.outputs\.([\w-]+)\s*==\s*'true'\s*(?:\}\})?\s*$/;

Then('the job {string} builds the image with Compose, starts it and runs the smoke test', function (this: DevArchWorld, name: string) {
  const steps = stepsOf(job(workflow(this), name));
  const idx = (re: RegExp) => steps.findIndex((s) => re.test(runOf(s)));
  const build = idx(/docker compose -f docker\/compose\.yaml build/);
  const up = idx(/docker compose -f docker\/compose\.yaml up -d/);
  const smoke = idx(/bash docker\/smoke-test\.sh/);
  assert.ok(build >= 0 && up > build && smoke > up, `build ${build}, up ${up}, smoke ${smoke}`);
});

Then('the job {string} runs on changes of the container or doctor files, on main and on {string} tags', function (this: DevArchWorld, name: string, tags: string) {
  const wf = workflow(this);
  const cond = String(job(wf, name).if ?? '');
  assert.match(cond, /needs\.changes\.outputs\.docker == 'true'/);
  assert.match(cond, /refs\/heads\/main/);
  assert.ok(cond.includes(`refs/tags/${tags.replace('*', '')}`), cond);
  const changes = stepsOf(job(wf, 'changes')).find((s) => String(s.uses ?? '').startsWith('dorny/paths-filter@'));
  const filters = parse(String(changes?.with?.filters ?? '')) as Record<string, string[]>;
  assert.ok(filters.docker, 'no docker paths filter');
  for (const p of ['docker/**', 'scripts/doctor/**']) assert.ok(filters.docker.includes(p), `docker filter lacks ${p}`);
  const outputs = (wf.jobs.changes as { outputs?: Record<string, string> }).outputs ?? {};
  assert.ok(outputs.docker, 'changes job does not output docker');
});

Then('the job {string} pushes the image to GHCR only on tags', function (this: DevArchWorld, name: string) {
  const steps = stepsOf(job(workflow(this), name)) as (CiStep & { if?: string })[];
  const pushing = steps.filter((s) => /docker push|ghcr\.io/.test(runOf(s)) || String(s.uses ?? '').startsWith('docker/login-action@'));
  assert.ok(pushing.some((s) => /docker push/.test(runOf(s)) && runOf(s).includes('ghcr.io')), 'no push to ghcr.io');
  for (const s of pushing) assert.match(String(s.if ?? ''), /startsWith\(github\.ref, 'refs\/tags\/dev-arch-v'\)/, `${s.name} is not tag-only`);
});

Then('the job {string} is not an area job', function (this: DevArchWorld, name: string) {
  assert.doesNotMatch(String(job(workflow(this), name).if ?? ''), AREA_GATE);
});

// --- TS-030 -----------------------------------------------------------------------------------------------------

Given('the container smoke test script', function (this: DevArchWorld) {
  const f = path.join(layout.productRoot, 'docker', 'smoke-test.sh');
  assert.ok(existsSync(f), 'docker/smoke-test.sh missing');
  this.data.smoke = readFileSync(f, 'utf8');
});

Then('it waits for the container health status {string}', function (this: DevArchWorld, status: string) {
  const s = this.data.smoke as string;
  assert.match(s, /\{\{\.State\.Health\.Status\}\}/);
  assert.ok(s.includes(`"${status}"`), s);
});

Then('it runs the doctor with {string} and fails on a doctor failure', function (this: DevArchWorld, args: string) {
  assert.match(this.data.smoke as string, new RegExp(`node scripts/doctor/cli\\.mjs ${args.replace(/-/g, '\\-')} \\|\\| fail`));
});

Then('it submits {string} to {string} and requires a graph with components', function (this: DevArchWorld, demo: string, url: string) {
  const s = this.data.smoke as string;
  assert.ok(s.includes(demo) && s.includes(url), 'demo or endpoint missing');
  assert.match(s, /\/graph/);
  assert.match(s, /components/);
  assert.match(s, /set -euo pipefail/);
});

// --- TS-031 -----------------------------------------------------------------------------------------------------

Given('the step definitions and test scripts of this feature', function (this: DevArchWorld) {
  const steps = path.join(layout.productRoot, 'tests', 'acceptance', 'steps');
  const doctor = path.join(layout.productRoot, 'scripts', 'doctor');
  this.data.ownFiles = [
    ...readdirSync(steps).filter((f) => f.startsWith('install-')).map((f) => path.join(steps, f)),
    ...readdirSync(doctor).filter((f) => f.endsWith('.test.mjs')).map((f) => path.join(doctor, f)),
    path.join(layout.productRoot, 'scripts', 'test.sh'),
  ];
});

Then('none of them runs the {string} command', function (this: DevArchWorld, command: string) {
  const call = new RegExp(`\\b(run|runOk|spawn|spawnSync|execFile|execFileSync|exec|execSync)\\(\\s*['"\`]${command}\\b`);
  const shell = new RegExp(`^\\s*${command}\\s+(build|compose|run)\\b`, 'm');
  const bad = (this.data.ownFiles as string[]).filter((f) => call.test(readFileSync(f, 'utf8')) || (f.endsWith('.sh') && shell.test(readFileSync(f, 'utf8'))));
  assert.deepEqual(bad, []);
});

Then('the build context ignore file of the image excludes {string}, {string}, {string} and {string}', function (this: DevArchWorld, dirs0: string, dirs1: string, dirs2: string, dirs3: string) {
  const dirs = [dirs0, dirs1, dirs2, dirs3];
  const f = path.join(layout.productRoot, 'docker', 'Dockerfile.dockerignore');
  assert.ok(existsSync(f), 'docker/Dockerfile.dockerignore missing');
  const lines = readFileSync(f, 'utf8').split('\n').map((l) => l.trim());
  for (const d of dirs) assert.ok(lines.some((l) => l === `**/${d}` || l === d), `${d} not ignored`);
});

// --- TS-032 -----------------------------------------------------------------------------------------------------

// "Given the web build configuration" is the 011 step (quality-web.steps.ts): it loads this.data.nextConfig.

Then('the standalone output and the workspace tracing root are enabled only when {string} is {string}', function (this: DevArchWorld, variable: string, value: string) {
  const src = this.data.nextConfig as string;
  const guard = `process.env.${variable} === '${value}'`;
  assert.ok(src.includes(guard), `no ${guard}`);
  assert.match(src, /output:\s*'standalone'/);
  assert.match(src, /outputFileTracingRoot/);
  const flag = new RegExp(`const (\\w+) = ${guard.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).exec(src)?.[1];
  assert.ok(flag, 'the guard is not a named flag');
  assert.match(src, new RegExp(`\\.\\.\\.\\(${flag} \\? \\{[^}]*output:\\s*'standalone'[^}]*outputFileTracingRoot`), 'output/tracing root not guarded by the flag');
});
