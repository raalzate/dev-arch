// US6 — Single product version (TS-031..TS-035).
import { Given, Then, When } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { layout } from '../support/layout.ts';
import { run } from '../support/process.ts';
import { mcpHandshake } from '../support/mcp.ts';
import { jdk17Home, tempDir } from '../support/tools.ts';
import type { DevArchWorld } from '../support/world.ts';

/** Version declarations of the product (contracts/version.md). */
export const DECLARATIONS = {
  'engine build descriptor': 'engine/pom.xml',
  '.NET analyzer project': 'engine/src/main/dotnet/DotNetAnalyzer/DotNetAnalyzer.csproj',
  'web manifest': 'web/package.json',
  'product manifest': 'package.json',
} as const;

/** Files version.sh reads or writes, plus the contract version: enough for a copy of the product. */
const VERSION_FILES = ['VERSION', 'Makefile', 'schema/VERSION', ...Object.values(DECLARATIONS)];

export function declaredVersion(product: string, file: string): string {
  const text = readFileSync(path.join(product, file), 'utf8');
  if (file.endsWith('.json')) return String(JSON.parse(text).version ?? '');
  if (file.endsWith('pom.xml')) return /<artifactId>java-dependency-extractor<\/artifactId>\s*<version>([^<]+)<\/version>/.exec(text)?.[1] ?? '';
  return /<Version>([^<]+)<\/Version>/.exec(text)?.[1] ?? '';
}

function versionCopy(world: DevArchWorld): string {
  if (world.data.versionCopy) return world.data.versionCopy as string;
  const copy = tempDir('version-copy');
  world.cleanup.push(copy);
  cpSync(path.join(layout.productRoot, 'scripts'), path.join(copy, 'scripts'), { recursive: true });
  for (const f of VERSION_FILES) {
    const from = path.join(layout.productRoot, f);
    if (!existsSync(from)) continue;
    mkdirSync(path.dirname(path.join(copy, f)), { recursive: true });
    copyFileSync(from, path.join(copy, f));
  }
  world.data.versionCopy = copy;
  return copy;
}

const product = (world: DevArchWorld) => (world.data.versionCopy as string | undefined) ?? layout.productRoot;

function snapshot(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (rel: string) => {
    const abs = path.join(dir, rel);
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const r = path.join(rel, entry.name);
      if (entry.isDirectory()) walk(r);
      else out[r] = createHash('sha256').update(readFileSync(path.join(dir, r))).digest('hex');
    }
  };
  walk('');
  return out;
}

// --- TS-031 / TS-032 ---------------------------------------------------------------------------------

Given('the product version source contains {string}', function (this: DevArchWorld, version: string) {
  if (this.data.versionCopy) {
    writeFileSync(path.join(product(this), 'VERSION'), `${version}\n`);
  } else {
    const file = path.join(layout.productRoot, 'VERSION');
    assert.ok(existsSync(file), 'no VERSION file at the product root');
    assert.equal(readFileSync(file, 'utf8').trim(), version);
  }
});

Given('the web manifest declares version {string}', function (this: DevArchWorld, version: string) {
  const copy = versionCopy(this);
  const file = path.join(copy, DECLARATIONS['web manifest']);
  const manifest = JSON.parse(readFileSync(file, 'utf8'));
  manifest.version = version;
  writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
});

When('the version check is executed', function (this: DevArchWorld) {
  this.result = run('make', ['version-check'], { cwd: product(this) });
});

Then(
  'the engine build descriptor, the .NET analyzer project, the web manifest and the product manifest declare {string}',
  function (this: DevArchWorld, version: string) {
    for (const [what, file] of Object.entries(DECLARATIONS)) {
      assert.equal(declaredVersion(product(this), file), version, `${what} (${file})`);
    }
  },
);

Then('the output names the web manifest, {string} and {string}', function (this: DevArchWorld, declared: string, source: string) {
  const line = this.result!.output.split('\n').find((l) => l.includes(DECLARATIONS['web manifest']));
  assert.ok(line, `the output does not name ${DECLARATIONS['web manifest']}:\n${this.result!.output}`);
  assert.ok(line.includes(declared) && line.includes(source), line);
});

// --- TS-033 / TS-035 ---------------------------------------------------------------------------------

Given('a copy of the product', function (this: DevArchWorld) {
  const copy = versionCopy(this);
  this.data.before = snapshot(copy);
});

Given('a copy of the product with contract version {string}', function (this: DevArchWorld, version: string) {
  const copy = versionCopy(this);
  assert.equal(readFileSync(path.join(copy, 'schema', 'VERSION'), 'utf8').trim(), version);
});

function propagate(world: DevArchWorld): void {
  world.result = run('make', ['version-sync'], { cwd: product(world) });
  assert.equal(world.result.code, 0, world.result.output);
}

When('the product version source is changed to {string}', function (this: DevArchWorld, version: string) {
  writeFileSync(path.join(product(this), 'VERSION'), `${version}\n`);
  this.data.handEdited = ['VERSION'];
  this.data.newVersion = version;
});

When('the version propagation command is executed', function (this: DevArchWorld) {
  propagate(this);
});

When('the product version is changed to {string} and propagated', function (this: DevArchWorld, version: string) {
  writeFileSync(path.join(product(this), 'VERSION'), `${version}\n`);
  propagate(this);
});

Then('the version check passes', function (this: DevArchWorld) {
  const res = run('make', ['version-check'], { cwd: product(this) });
  assert.equal(res.code, 0, res.output);
  for (const file of Object.values(DECLARATIONS)) assert.equal(declaredVersion(product(this), file), this.data.newVersion, file);
});

Then('the only file edited by hand is the product version source', function (this: DevArchWorld) {
  const before = this.data.before as Record<string, string>;
  const after = snapshot(product(this));
  const changed = Object.keys(after).filter((f) => before[f] !== after[f]).sort();
  const propagated = Object.values(DECLARATIONS).map((f) => path.normalize(f));
  const unexpected = changed.filter((f) => f !== 'VERSION' && !propagated.includes(f));
  assert.deepEqual(unexpected, [], 'files changed besides VERSION and the propagated declarations');
  assert.deepEqual(this.data.handEdited, ['VERSION']);
});

Then('the contract version is still {string}', function (this: DevArchWorld, version: string) {
  assert.equal(readFileSync(path.join(product(this), 'schema', 'VERSION'), 'utf8').trim(), version);
});

// --- TS-034 ------------------------------------------------------------------------------------------

Given('the engine is built', function (this: DevArchWorld) {
  const jar = path.join(layout.engineRoot, 'target', 'java-dependency-extractor.jar');
  if (!existsSync(jar)) {
    const res = run('make', ['build-engine'], { cwd: layout.productRoot, timeoutMs: 30 * 60 * 1000 });
    assert.equal(res.code, 0, res.output.slice(-4000));
  }
  this.data.jar = jar;
});

When('the MCP server is initialized', async function (this: DevArchWorld) {
  const jdk = jdk17Home();
  const java = jdk ? path.join(jdk, 'bin', 'java') : 'java';
  this.data.mcp = await mcpHandshake(java, ['-jar', this.data.jar as string, '--mcp'], layout.productRoot, {});
});

Then('the reported server version equals the product version', function (this: DevArchWorld) {
  const init = (this.data.mcp as { initialize: { result?: { serverInfo?: { version?: string } } } }).initialize;
  const version = readFileSync(path.join(layout.productRoot, 'VERSION'), 'utf8').trim();
  assert.equal(init.result?.serverInfo?.version, version);
});
