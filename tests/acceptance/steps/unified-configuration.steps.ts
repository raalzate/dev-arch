// US7 — Unified development configuration and governance (TS-036..TS-041).
import { Given, Then, When } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { layout, PRODUCT_REL } from '../support/layout.ts';
import { git, gitOk, trackedFiles } from '../support/git.ts';
import { run } from '../support/process.ts';
import { mcpHandshake } from '../support/mcp.ts';
import { jdk17Home } from '../support/tools.ts';
import type { DevArchWorld } from '../support/world.ts';

type McpConfig = { mcpServers: Record<string, { type?: string; command: string; args?: string[] }> };

const ENGINE_JAR = 'engine/target/java-dependency-extractor.jar';
const MCP_TOOLS = ['analyze_project', 'get_api_contracts', 'get_architecture_proposal', 'get_component_metrics', 'get_dependency_graph'];
const isAbsolute = (s: string) => path.isAbsolute(s) || /^[A-Za-z]:[\\/]/.test(s);

function engineEntry(config: McpConfig): [string, { command: string; args?: string[] }] {
  const entry = Object.entries(config.mcpServers).find(([, s]) => (s.args ?? []).some((a) => a.endsWith('java-dependency-extractor.jar')));
  assert.ok(entry, 'no MCP server entry runs the engine archive');
  return entry;
}

// --- TS-036 / TS-037 ---------------------------------------------------------------------------------

Given('the versioned local MCP server configuration', function (this: DevArchWorld) {
  assert.ok(gitOk(['cat-file', '-e', `HEAD:.mcp.json`], layout.monorepoRoot), '.mcp.json is not versioned');
  this.data.mcpConfig = JSON.parse(readFileSync(path.join(layout.productRoot, '.mcp.json'), 'utf8'));
});

Then('the engine server entry runs the engine archive through a path relative to the product root', function (this: DevArchWorld) {
  const [, entry] = engineEntry(this.data.mcpConfig as McpConfig);
  const jar = (entry.args ?? []).find((a) => a.endsWith('.jar'))!;
  assert.ok(!isAbsolute(jar), `absolute engine path: ${jar}`);
  assert.equal(path.normalize(jar), path.normalize(ENGINE_JAR));
  assert.ok((entry.args ?? []).includes('--mcp'), 'the engine entry does not start MCP mode');
});

Then('no entry contains an absolute path', function (this: DevArchWorld) {
  const strings: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === 'string') strings.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(this.data.mcpConfig);
  assert.deepEqual(strings.filter(isAbsolute), []);
});

When('the engine server from the local MCP configuration is started from the product root', async function (this: DevArchWorld) {
  const config = JSON.parse(readFileSync(path.join(layout.productRoot, '.mcp.json'), 'utf8')) as McpConfig;
  const [, entry] = engineEntry(config);
  const env: NodeJS.ProcessEnv = {};
  const jdk = jdk17Home();
  if (jdk) env.JAVA_HOME = jdk;
  this.data.mcp = await mcpHandshake(entry.command, entry.args ?? [], layout.productRoot, env);
});

Then('it answers the MCP initialization with the five analysis tools', function (this: DevArchWorld) {
  const session = this.data.mcp as { initialize: { result?: unknown }; tools: { name: string }[] };
  assert.ok(session.initialize.result, `initialize failed: ${JSON.stringify(session.initialize)}`);
  assert.deepEqual(session.tools.map((t) => t.name).sort(), MCP_TOOLS);
});

// --- TS-038 ------------------------------------------------------------------------------------------

Given('the product ignore rules', function (this: DevArchWorld) {
  assert.ok(existsSync(path.join(layout.productRoot, '.gitignore')), 'no product .gitignore');
});

When('the path {string} is checked', function (this: DevArchWorld, file: string) {
  // --no-index: evaluate the rules even for tracked files (package-lock.json, specs).
  this.data.ignored = run('git', ['check-ignore', '-q', '--no-index', file], { cwd: layout.monorepoRoot }).code === 0;
  this.data.checkedPath = file;
});

Then('it is ignored', function (this: DevArchWorld) {
  assert.equal(this.data.ignored, true, `${this.data.checkedPath} is not ignored`);
});

Then('it is not ignored', function (this: DevArchWorld) {
  assert.equal(this.data.ignored, false, `${this.data.checkedPath} is ignored`);
});

// --- TS-039 ------------------------------------------------------------------------------------------

Given('the monorepo global ignore rules on the main branch', function (this: DevArchWorld) {
  const main = ['main', 'origin/main'].find((ref) => gitOk(['rev-parse', '--verify', '--quiet', ref], layout.monorepoRoot));
  assert.ok(main, 'no main branch of the monorepo');
  this.data.mainIgnore = git(['show', `${main}:.gitignore`], layout.monorepoRoot);
});

When('they are compared with the feature branch', function (this: DevArchWorld) {
  this.data.featureIgnore = git(['show', 'HEAD:.gitignore'], layout.monorepoRoot);
});

Then('they are identical', function (this: DevArchWorld) {
  assert.equal(this.data.featureIgnore, this.data.mainIgnore);
});

// --- TS-040 ------------------------------------------------------------------------------------------

/**
 * Sample projects analyzed by the engine tests (test-for-demo/, test fixtures) carry their own repository
 * files as input data; they are not configuration of the product.
 */
const SAMPLE_DATA = [`engine/test-for-demo/`, `engine/src/test/`];
const AGENT_FILES = /(^|\/)(AGENTS\.md|CLAUDE\.md|GEMINI\.md|\.cursorrules|copilot-instructions\.md)$/;

Given('the product folder', function (this: DevArchWorld) {
  this.data.tracked = trackedFiles(layout.monorepoRoot, 'HEAD', PRODUCT_REL).filter((f) => !SAMPLE_DATA.some((d) => f.startsWith(d)));
});

Then('exactly one editor configuration and one ignore file exist in the product, both at its root', function (this: DevArchWorld) {
  const tracked = this.data.tracked as string[];
  const named = (name: string) => tracked.filter((f) => f === name || f.endsWith(`/${name}`));
  assert.deepEqual(named('.editorconfig'), ['.editorconfig']);
  assert.deepEqual(named('.gitignore'), ['.gitignore']);
});

Then('the agent instruction files at the product root reference the iikit rules', function (this: DevArchWorld) {
  const read = (f: string) => readFileSync(path.join(layout.productRoot, f), 'utf8');
  assert.ok(read('AGENTS.md').includes('.tessl/RULES.md'), 'AGENTS.md does not reference .tessl/RULES.md');
  assert.ok(/@AGENTS\.md|\.tessl\/RULES\.md/.test(read('CLAUDE.md')), 'CLAUDE.md does not reference the agent rules');
  const rules = read('.tessl/RULES.md');
  for (const rule of ['assertion-integrity', 'phase-discipline', 'constitution', 'phase-separation']) {
    assert.ok(rules.includes(`intent-integrity-kit/rules/${rule}.md`), `.tessl/RULES.md lacks the iikit rule ${rule}`);
  }
});

Then('no agent instruction file exists inside {string}, {string} or {string}', function (this: DevArchWorld, a: string, b: string, c: string) {
  const inside = (this.data.tracked as string[]).filter((f) => [a, b, c].some((d) => f.startsWith(`${d}/`)) && AGENT_FILES.test(f));
  assert.deepEqual(inside, []);
});

// --- TS-041 ------------------------------------------------------------------------------------------

const DASHBOARD_SCRIPT = '.tessl/tiles/tessl-labs/intent-integrity-kit/skills/iikit-core/scripts/bash/generate-dashboard-safe.sh';

Given('the specifications 001 to 006 at the product root', function (this: DevArchWorld) {
  const specs = readdirSync(path.join(layout.productRoot, 'specs')).filter((d) => /^00[1-6]-/.test(d));
  assert.equal(specs.length, 6, `specs found: ${specs}`);
  this.data.specs = specs;
});

When('the iikit dashboard is generated from the product root', function (this: DevArchWorld) {
  // The iikit tiles are installed (tessl install), never versioned (.tessl/tiles/ is ignored): like the 005
  // tool-dependent scenarios, skip with the reason when they are not installed in this checkout.
  if (!existsSync(path.join(layout.productRoot, DASHBOARD_SCRIPT))) {
    this.attach(`iikit tiles not installed in ${layout.productRoot} (${DASHBOARD_SCRIPT}); run tessl install`);
    return 'skipped';
  }
  this.result = run('bash', [DASHBOARD_SCRIPT], { cwd: layout.productRoot, timeoutMs: 5 * 60 * 1000 });
  assert.equal(this.result.code, 0, this.result.output);
  return undefined;
});

Then('it lists the features 001 to 006', function (this: DevArchWorld) {
  const html = readFileSync(path.join(layout.productRoot, '.specify', 'dashboard.html'), 'utf8');
  for (const spec of this.data.specs as string[]) assert.ok(html.includes(spec), `dashboard does not list ${spec}`);
});
