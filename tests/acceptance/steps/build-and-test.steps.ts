// US2 — Build and test the whole product from a clean clone (TS-006..TS-013).
import { Before, Given, Then, When } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { layout, PRODUCT_REL } from '../support/layout.ts';
import { cleanClone, git, trackedFiles } from '../support/git.ts';
import { run } from '../support/process.ts';
import { fakeJdk, jdk17Home, recordingShims, tempDir, which, writeExecutable } from '../support/tools.ts';
import type { DevArchWorld } from '../support/world.ts';

const BUILD_TIMEOUT = 45 * 60 * 1000;

export function productDir(world: DevArchWorld): string {
  return world.product || layout.productRoot;
}

/** Checks out the clean clone made by "a clean clone of the monorepo on the feature branch" when needed. */
export function ensureCheckout(world: DevArchWorld): void {
  if (world.data.checkedOut === false) {
    const res = run('git', ['checkout', '--quiet', world.commit], { cwd: world.monorepo, timeoutMs: BUILD_TIMEOUT });
    assert.equal(res.code, 0, res.output);
    world.data.checkedOut = true;
  }
}

/** Build outputs of `make build` (contracts/make-targets.md). */
export function buildOutputs(product: string): Record<string, string> {
  return {
    'engine archive': path.join(product, 'engine', 'target', 'java-dependency-extractor.jar'),
    'staged engine archive': path.join(product, 'web', 'engine-dist', 'engine.jar'),
    '.NET analyzer': path.join(product, 'web', 'engine-dist', 'dotnet-analyzer'),
    'web build output': path.join(product, 'web', '.next', 'BUILD_ID'),
  };
}

export function isBuilt(product: string): boolean {
  return Object.values(buildOutputs(product)).every((f) => existsSync(f));
}

/** Environment of product commands: the scenario environment plus a JDK 17 JAVA_HOME when available. */
export function commandEnv(world: DevArchWorld): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  const jdk = jdk17Home();
  if (jdk) env.JAVA_HOME = jdk;
  return { ...env, ...world.env };
}

/** Clean clone + checkout for scenarios that must not touch the checkout under test (make clean). */
Before({ tags: '@TS-011' }, function (this: DevArchWorld) {
  const { dir, commit } = cleanClone(layout.monorepoRoot, true);
  this.monorepo = dir;
  this.product = path.join(dir, PRODUCT_REL);
  this.commit = commit;
  this.data.checkedOut = true;
  this.cleanup.push(path.dirname(dir));
});

Given('the product is built', function (this: DevArchWorld) {
  ensureCheckout(this);
  // Scenarios that run their command on a work copy (see product-contract steps) need the checkout built.
  const product = this.data.workCopy ? layout.productRoot : productDir(this);
  if (isBuilt(product)) return;
  // Always the real tools: scenario shims and fakes apply to the command under test only.
  const env = { ...commandEnv(this), PATH: process.env.PATH };
  const res = run('make', ['build'], { cwd: product, env, timeoutMs: BUILD_TIMEOUT });
  assert.equal(res.code, 0, `make build failed:\n${res.output.slice(-6000)}`);
  assert.ok(isBuilt(product), 'make build did not produce every build output');
});

When('{string} is executed from the product root', function (this: DevArchWorld, command: string) {
  ensureCheckout(this);
  const [file, ...args] = command.split(' ');
  const env = { ...commandEnv(this), ...this.env };
  const cwd = (this.data.workCopy as string | undefined) ?? productDir(this);
  const res = run(file, args, { cwd, env, timeoutMs: BUILD_TIMEOUT });
  this.result = res;
  this.results[command] = res;
});

// --- TS-006 -----------------------------------------------------------------------------------------

Given('JDK 17, the .NET SDK and Node 20 are available', function (this: DevArchWorld) {
  assert.ok(jdk17Home(), 'no JDK 17 on this machine (set JAVA_HOME to a JDK 17)');
  assert.ok(which('dotnet'), 'no .NET SDK on the PATH');
  const node = run('node', ['--version'], { cwd: layout.productRoot }).stdout.trim();
  assert.ok(Number(/^v(\d+)/.exec(node)?.[1] ?? 0) >= 20, `Node 20+ required, found ${node}`);
});

Then('both commands exit with code 0', function (this: DevArchWorld) {
  for (const command of ['make build', 'make test']) {
    const res = this.results[command];
    assert.ok(res, `${command} was not executed`);
    assert.equal(res.code, 0, `${command} failed:\n${res.output.slice(-6000)}`);
  }
});

Then('the engine archive, the .NET analyzer and the web build output exist', function (this: DevArchWorld) {
  for (const [what, file] of Object.entries(buildOutputs(productDir(this)))) {
    assert.ok(existsSync(file), `missing ${what}: ${file}`);
  }
});

Then('the working tree has no changed or untracked files', function (this: DevArchWorld) {
  const status = git(['status', '--porcelain', '--untracked-files=all'], this.monorepo || layout.monorepoRoot);
  assert.equal(status, '', `working tree is not clean after build and test:\n${status}`);
});

// --- TS-007 -----------------------------------------------------------------------------------------

Then(
  'it runs the Java engine tests, the .NET analyzer tests, the contract check, the web tests and the acceptance tests',
  function (this: DevArchWorld) {
    const out = this.result!.output;
    assert.equal(this.result!.code, 0, out.slice(-6000));
    for (const subset of ['engine-java', 'engine-dotnet', 'schema-check', 'web', 'acceptance']) {
      assert.match(out, new RegExp(`^\\[test\\] ${subset}: OK`, 'm'), `subset ${subset} did not run OK`);
    }
  },
);

Then('the .NET analyzer tests are run excluding the category {string}', function (this: DevArchWorld, category: string) {
  assert.ok(this.result!.output.includes(`Category!=${category}`), `.NET tests not filtered with Category!=${category}`);
});

Then('every test that passed in the original engine repository passes', function (this: DevArchWorld) {
  const out = this.result!.output;
  const summaries = [...out.matchAll(/^\[(?:INFO|ERROR|WARNING)\] Tests run: (\d+), Failures: (\d+), Errors: (\d+), Skipped: (\d+)$/gm)];
  assert.ok(summaries.length > 0, 'no Maven test summary in the output');
  const total = summaries[summaries.length - 1];
  assert.equal(`${total[2]}/${total[3]}`, '0/0', `Maven failures/errors: ${total[0]}`);
  assert.ok(Number(total[1]) >= 102, `expected at least the 102 pre-existing Java tests, ran ${total[1]}`);
});

// --- TS-008 -----------------------------------------------------------------------------------------

Given('the default {string} on the PATH is a JDK other than 17', function (this: DevArchWorld, tool: string) {
  assert.equal(tool, 'java');
  const fake = fakeJdk('25');
  this.cleanup.push(fake);
  this.data.fakeJavaDir = path.join(fake, 'bin');
  this.env.PATH = `${this.data.fakeJavaDir}:${process.env.PATH}`;
});

Given('JAVA_HOME points to a JDK 17', function (this: DevArchWorld) {
  const jdk = jdk17Home();
  assert.ok(jdk, 'no JDK 17 on this machine');
  this.env.JAVA_HOME = jdk;
});

When('the prerequisite check is executed', function (this: DevArchWorld) {
  this.result = run('bash', ['scripts/check-prereqs.sh'], { cwd: productDir(this), env: this.env });
});

Then('it reports {string} for {string}', function (this: DevArchWorld, status: string, tool: string) {
  assert.match(this.result!.output, new RegExp(`^\\[prereqs\\] ${tool}: ${status}\\b`, 'm'), this.result!.output);
});

Then('every Java tool invoked by the product commands uses the JDK at JAVA_HOME', function (this: DevArchWorld) {
  const jdk = this.env.JAVA_HOME as string;
  assert.ok(this.result!.output.includes(path.join(jdk, 'bin', 'java')), `prereqs did not use ${jdk}/bin/java`);
  // Run the engine commands with recording shims: Maven must receive the selected JAVA_HOME.
  const shims = recordingShims(['mvn', 'dotnet', 'npm', 'npx']);
  this.cleanup.push(shims.dir);
  const env = { ...this.env, PATH: `${shims.dir}:${this.env.PATH}` };
  const res = run('make', ['test-engine'], { cwd: productDir(this), env });
  assert.equal(res.code, 0, res.output.slice(-4000));
  const maven = shims.lines().filter((l) => l.startsWith('mvn '));
  assert.ok(maven.length > 0, 'make test-engine did not invoke Maven');
  for (const line of maven) assert.ok(line.endsWith(`JAVA_HOME=${jdk}`), `Maven ran with another JDK: ${line}`);
});

// --- TS-009 -----------------------------------------------------------------------------------------

Given('a JDK 17 \\(JAVA_HOME points to a JDK 25) is not available', function (this: DevArchWorld) {
  const fake = fakeJdk('25');
  this.cleanup.push(fake);
  this.env.JAVA_HOME = fake;
  this.data.expected = { found: '25', required: '17' };
});

Given('the .NET 8 runtime is not available', function (this: DevArchWorld) {
  const dir = tempDir('dotnet10');
  this.cleanup.push(dir);
  writeExecutable(
    path.join(dir, 'dotnet'),
    [
      'case "${1:-}" in',
      '  --list-sdks) echo "10.0.105 [/opt/fake/dotnet/sdk]";;',
      '  --list-runtimes) echo "Microsoft.NETCore.App 10.0.5 [/opt/fake/dotnet/shared/Microsoft.NETCore.App]";;',
      '  --version) echo "10.0.105";;',
      '  *) echo "fake dotnet invoked: $*" >&2; exit 1;;',
      'esac',
    ].join('\n'),
  );
  this.env.PATH = `${dir}:${process.env.PATH}`;
  this.data.expected = { found: '10.0.5', required: '8' };
});

Given('Node 20 or newer \\(Node 18 on the PATH) is not available', function (this: DevArchWorld) {
  const dir = tempDir('node18');
  this.cleanup.push(dir);
  writeExecutable(path.join(dir, 'node'), 'case "${1:-}" in --version|-v) echo "v18.20.4";; *) echo "fake node" >&2; exit 1;; esac');
  this.env.PATH = `${dir}:${process.env.PATH}`;
  this.data.expected = { found: '18', required: '20' };
});

Then('it exits with a non-zero code before any compilation starts', function (this: DevArchWorld) {
  const out = this.result!.output;
  assert.notEqual(this.result!.code, 0, out);
  assert.match(out, /^\[prereqs\] \w+: FAIL/m, `no failing prerequisite line:\n${out}`);
  assert.doesNotMatch(out, /^\[build\]/m, `compilation started:\n${out}`);
});

Then(
  'the output names {string}, the version found and the version required',
  function (this: DevArchWorld, tool: string) {
    const { found, required } = this.data.expected as { found: string; required: string };
    const line = this.result!.output.split('\n').find((l) => l.startsWith(`[prereqs] ${tool}: FAIL`));
    assert.ok(line, `no FAIL line for ${tool}:\n${this.result!.output}`);
    assert.ok(line.includes(found), `${line} does not name the version found (${found})`);
    assert.ok(line.includes(required), `${line} does not name the version required (${required})`);
  },
);

// --- TS-010 -----------------------------------------------------------------------------------------

/** Subset commands run with recording shims: the scenario checks which test tools the target invokes. */
Before({ tags: '@TS-010' }, function (this: DevArchWorld) {
  const shims = recordingShims(['mvn', 'dotnet', 'npm', 'npx']);
  this.cleanup.push(shims.dir);
  this.data.shims = shims;
  this.env.PATH = `${shims.dir}:${process.env.PATH}`;
});

const SUBSETS: Record<string, { expected: RegExp[]; forbidden: RegExp[] }> = {
  'Java and .NET engine': {
    expected: [/^mvn .*\bverify\b/, /^dotnet test .*Category!=Corpus/],
    forbidden: [/^npm /, /^npx /],
  },
  web: {
    expected: [/^npm (run )?test .*(-w|--workspace)[ =]web\b/],
    forbidden: [/^mvn /, /^dotnet test /, /^npx /],
  },
};

Then('only the {} tests are run', function (this: DevArchWorld, subset: string) {
  assert.equal(this.result!.code, 0, this.result!.output.slice(-4000));
  const rules = SUBSETS[subset];
  assert.ok(rules, `unknown subset ${subset}`);
  const lines = (this.data.shims as ReturnType<typeof recordingShims>).lines();
  for (const re of rules.expected) assert.ok(lines.some((l) => re.test(l)), `${re} not invoked; invocations:\n${lines.join('\n')}`);
  for (const re of rules.forbidden) {
    const hit = lines.find((l) => re.test(l));
    assert.ok(!hit, `${subset} subset also ran: ${hit}`);
  }
});

// --- TS-011 -----------------------------------------------------------------------------------------

Then(
  'the engine build directory, the web build output and the staged engine directory no longer exist',
  function (this: DevArchWorld) {
    assert.equal(this.result!.code, 0, this.result!.output.slice(-4000));
    const product = productDir(this);
    for (const dir of ['engine/target', 'web/.next', 'web/engine-dist']) {
      assert.ok(!existsSync(path.join(product, dir)), `${dir} still exists after make clean`);
    }
  },
);

Then('the working tree is identical to the clean clone', function (this: DevArchWorld) {
  const status = git(['status', '--porcelain', '--ignored', '--untracked-files=all'], this.monorepo);
  assert.equal(status, '', `files left after make clean:\n${status.split('\n').slice(0, 40).join('\n')}`);
});

// --- TS-012 -----------------------------------------------------------------------------------------

Then('the output contains {string}', function (this: DevArchWorld, message: string) {
  assert.ok(this.result!.output.includes(message), `output lacks "${message}":\n${this.result!.output}`);
});

// --- TS-013 -----------------------------------------------------------------------------------------

Given('the product package manifest', function (this: DevArchWorld) {
  const repo = layout.monorepoRoot;
  this.data.manifest = JSON.parse(git(['show', `HEAD:${PRODUCT_REL}/package.json`], repo));
  this.data.tracked = trackedFiles(repo, 'HEAD', PRODUCT_REL);
});

Then('it declares the workspaces {string} and {string}', function (this: DevArchWorld, a: string, b: string) {
  const workspaces = (this.data.manifest as { workspaces?: string[] }).workspaces ?? [];
  assert.deepEqual([...workspaces].sort(), [a, b].sort());
});

Then('a single dependency lock file is tracked at the product root', function (this: DevArchWorld) {
  const locks = (this.data.tracked as string[]).filter((f) => /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml)$/.test(f))
    .filter((f) => !f.startsWith(`${PRODUCT_REL}/engine/test-for-demo/`));
  assert.deepEqual(locks, [`${PRODUCT_REL}/package-lock.json`]);
  const lock = JSON.parse(readFileSync(path.join(layout.productRoot, 'package-lock.json'), 'utf8'));
  assert.ok(lock.packages?.['web'] && lock.packages?.['schema'], 'the lock file does not cover both workspaces');
});

Then('no lock file is tracked inside {string} or {string}', function (this: DevArchWorld, a: string, b: string) {
  const inside = (this.data.tracked as string[]).filter(
    (f) => (f.startsWith(`${PRODUCT_REL}/${a}/`) || f.startsWith(`${PRODUCT_REL}/${b}/`)) && /lock/i.test(path.posix.basename(f)),
  );
  assert.deepEqual(inside, []);
});
