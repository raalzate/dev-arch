// Browser end-to-end steps of 007 (@e2e, Playwright): TS-013, TS-014, TS-015, TS-016, TS-019, TS-039, TS-047,
// TS-063, TS-075, TS-085. The web runs with the real engine ("the web is running", native-runtime-common).
import { Given, Then, When } from '@cucumber/cucumber';
import AdmZip from 'adm-zip';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { byTestId, openSession, sessions, statusLog, storage, type BrowserSession } from '../support/browser.ts';
import { layout } from '../support/layout.ts';
import { tempDir } from '../support/tools.ts';
import type { DevArchWorld } from '../support/world.ts';
import { demoProjectZip, startRealWeb, UUID_RE } from './native-runtime-common.steps.ts';

const ACTIVE_JOB = 'devarch.activeJobId';
const PHASES = ['detection', 'extraction', 'inference', 'writing'];

function url(world: DevArchWorld): string {
  const u = world.data.url as string | undefined;
  assert.ok(u, 'the web is not running');
  return u;
}

function first(world: DevArchWorld): BrowserSession {
  return sessions(world)[0];
}

function zipFile(world: DevArchWorld, name: string, buf: Buffer): string {
  const dir = tempDir('devarch-007-upload');
  world.cleanup.push(dir);
  const file = path.join(dir, name);
  writeFileSync(file, buf);
  return file;
}

async function upload(world: DevArchWorld, s: BrowserSession, project: string, zip: Buffer = demoProjectZip(project)) {
  await s.page.setInputFiles(byTestId('upload-input'), zipFile(world, `${project}.zip`, zip));
  s.uploadAt = Date.now();
  s.project = project;
  await s.page.click(byTestId('analyze-button'));
}

async function showsResults(s: BrowserSession, timeoutMs: number): Promise<void> {
  const t = Math.max(timeoutMs, 1000);
  await s.page.locator(byTestId('proposal-card')).first().waitFor({ state: 'visible', timeout: t });
  await s.page.locator(byTestId('component-node')).first().waitFor({ state: 'visible', timeout: t });
  assert.ok((await s.page.locator(byTestId('proposal-card')).count()) >= 1);
  assert.ok((await s.page.locator(byTestId('component-node')).count()) >= 1);
}

async function activeJob(s: BrowserSession): Promise<string> {
  const id = (await storage(s.page)).local[ACTIVE_JOB];
  assert.match(id ?? '', UUID_RE, `localStorage ${ACTIVE_JOB}: ${id}`);
  return id;
}

// --- sessions -------------------------------------------------------------------------------------------

Given('a browser session is open on the web', async function (this: DevArchWorld) {
  await openSession(this, url(this));
});

Given('two independent browser sessions are open on the web', async function (this: DevArchWorld) {
  await openSession(this, url(this));
  await openSession(this, url(this));
  const [a, b] = sessions(this);
  assert.notEqual(a.context, b.context);
});

Given('the web is running with the API token {string}', async function (this: DevArchWorld, token: string) {
  await startRealWeb(this, { DEVARCH_API_TOKEN: token });
});

// --- TS-013 / TS-014 / TS-015 ---------------------------------------------------------------------------

When('the user uploads the ZIP of the demo project {string}', async function (this: DevArchWorld, project: string) {
  await upload(this, first(this), project);
});

Then('the page shows the analysis phase while it runs', async function (this: DevArchWorld) {
  const s = first(this);
  await s.page.locator(byTestId('analysis-status')).waitFor({ state: 'visible', timeout: 60_000 });
  const deadline = Date.now() + 10 * 60_000;
  for (;;) {
    const log = await statusLog(s.page);
    const seen = log.find((e) => e.status === 'running' && PHASES.includes(e.phase));
    if (seen) {
      const label = await s.page.locator(byTestId('analysis-phase')).textContent();
      assert.ok(label && label.trim().length > 0, 'the phase has no visible label');
      return;
    }
    const done = log.find((e) => e.status === 'completed' || e.status === 'failed');
    assert.ok(!done, `the analysis finished without showing a phase while running: ${JSON.stringify(log)}`);
    assert.ok(Date.now() < deadline, `no phase shown: ${JSON.stringify(log)}`);
    await s.page.waitForTimeout(100);
  }
});

Then(
  'within {int} minutes of the upload the page shows at least one component and at least one proposal',
  async function (this: DevArchWorld, minutes: number) {
    const s = first(this);
    assert.ok(s.uploadAt, 'nothing was uploaded');
    await showsResults(s, minutes * 60_000 - (Date.now() - s.uploadAt));
    assert.ok(Date.now() - s.uploadAt < minutes * 60_000, `took ${Date.now() - s.uploadAt} ms`);
  },
);

When('the user uploads the ZIP of the demo project {string} and the analysis completes', async function (this: DevArchWorld, project: string) {
  const s = first(this);
  await upload(this, s, project);
  await showsResults(s, 10 * 60_000);
  assert.equal(await s.page.locator(byTestId('analysis-status')).getAttribute('data-status'), 'completed');
});

Then('the browser storage holds the active analysis identifier', async function (this: DevArchWorld) {
  const s = first(this);
  const id = await activeJob(s);
  assert.equal((await s.page.locator(byTestId('analysis-id')).textContent())?.trim(), id);
});

Then('the browser storage holds no analysis results', async function (this: DevArchWorld) {
  const { local, session } = await storage(first(this).page);
  for (const [k, v] of Object.entries({ ...local, ...session })) {
    assert.ok(!/"(components|proposals|edges|endpoints)"/.test(v), `storage key ${k} holds analysis results`);
    assert.ok(v.length < 512, `storage key ${k} holds ${v.length} characters`);
  }
  assert.ok(!('componentsData' in local) && !('archData' in local), 'legacy result keys are still stored');
});

// --- TS-016 ---------------------------------------------------------------------------------------------

When('the first session uploads {string} and the second uploads {string} at the same time', async function (this: DevArchWorld, a: string, b: string) {
  const [s1, s2] = sessions(this);
  await Promise.all([upload(this, s1, a), upload(this, s2, b)]);
  this.data.waitBrowserSessions = async () => {
    await Promise.all([showsResults(s1, 10 * 60_000), showsResults(s2, 10 * 60_000)]);
    for (const s of [s1, s2]) {
      assert.equal(await s.page.locator(byTestId('analysis-status')).getAttribute('data-status'), 'completed');
    }
  };
});

async function graphIds(s: BrowserSession, jobId: string): Promise<Set<string>> {
  const res = await s.page.request.get(new URL(`/api/analyses/${jobId}/graph`, s.page.url()).toString());
  assert.equal(res.status(), 200, await res.text());
  return new Set(((await res.json()).components as { id: string }[]).map((c) => c.id));
}

Then('each session shows only components of its own project', async function (this: DevArchWorld) {
  const [s1, s2] = sessions(this);
  const [j1, j2] = [await activeJob(s1), await activeJob(s2)];
  assert.notEqual(j1, j2);
  const own = [await graphIds(s1, j1), await graphIds(s2, j2)];
  for (const [i, s] of [s1, s2].entries()) {
    const shown = await s.page.locator(byTestId('component-node')).evaluateAll((els) => els.map((e) => e.getAttribute('data-component-id') ?? ''));
    assert.ok(shown.length >= 1);
    for (const id of shown) {
      assert.ok(own[i].has(id), `session ${i + 1} (${s.project}) shows ${id}, not a component of its project`);
      assert.ok(!own[1 - i].has(id), `session ${i + 1} shows ${id}, a component of the other project`);
    }
  }
});

// --- TS-019 ---------------------------------------------------------------------------------------------

When('the user reloads the page before the analysis completes', async function (this: DevArchWorld) {
  const s = first(this);
  await s.page.waitForFunction((k) => !!window.localStorage.getItem(k), ACTIVE_JOB, { timeout: 60_000 });
  this.data.jobBeforeReload = await activeJob(s);
  this.data.completedBeforeReload = (await s.page.locator(byTestId('analysis-status')).getAttribute('data-status')) === 'completed';
  this.data.reloadAt = Date.now();
  await s.page.reload({ waitUntil: 'domcontentloaded' });
});

Then('the page follows the same analysis identifier without a new upload', async function (this: DevArchWorld) {
  const s = first(this);
  const before = this.data.jobBeforeReload as string;
  await s.page.locator(byTestId('analysis-id')).waitFor({ state: 'visible', timeout: 120_000 });
  assert.equal((await s.page.locator(byTestId('analysis-id')).textContent())?.trim(), before);
  assert.equal(await activeJob(s), before);
  const after = s.requests.filter((r) => r.at >= (this.data.reloadAt as number));
  assert.ok(!after.some((r) => r.method === 'POST'), `new submissions after reload: ${JSON.stringify(after)}`);
  assert.ok(after.some((r) => r.method === 'GET' && r.path === `/api/analyses/${before}`), 'the page did not query the analysis');
});

Then('the page eventually shows at least one proposal', async function (this: DevArchWorld) {
  const s = first(this);
  await s.page.locator(byTestId('proposal-card')).first().waitFor({ state: 'visible', timeout: 10 * 60_000 });
  assert.ok((await s.page.locator(byTestId('proposal-card')).count()) >= 1);
});

// --- TS-039 ---------------------------------------------------------------------------------------------

When('the user opens the source code of a component', async function (this: DevArchWorld) {
  const s = first(this);
  const node = s.page.locator(`${byTestId('component-node')}[data-file$=".java"]`).first();
  this.data.openedFile = await node.getAttribute('data-file');
  assert.ok(this.data.openedFile, 'no component with a Java file');
  await node.locator(byTestId('component-open-source')).click();
});

Then("the viewer shows the content of that component's file", async function (this: DevArchWorld) {
  const s = first(this);
  const rel = this.data.openedFile as string;
  assert.ok(!path.isAbsolute(rel), `the page received an absolute path: ${rel}`);
  const expected = readFileSync(path.join(layout.engineRoot, 'test-for-demo', s.project ?? 'java-standar', rel), 'utf8');
  const viewer = s.page.locator(byTestId('code-viewer-content'));
  await viewer.waitFor({ state: 'visible', timeout: 60_000 });
  const shown = (await viewer.textContent()) ?? '';
  const lines = expected.split('\n').map((l) => l.trim()).filter(Boolean);
  assert.ok(lines.length > 0);
  for (const l of lines) assert.ok(shown.includes(l), `the viewer misses the line: ${l}`);
});

// --- TS-047 ---------------------------------------------------------------------------------------------

When('the user imports the outputs of the contract fixture {string}', async function (this: DevArchWorld, fixture: string) {
  const s = first(this);
  const dir = path.join(layout.schemaDir, 'fixtures', 'valid', fixture);
  const files = ['output.json', 'output_architecture.json', 'output_entrypoints.json'].map((f) => path.join(dir, f));
  await s.page.setInputFiles(byTestId('import-input'), files);
  await s.page.click(byTestId('import-submit'));
});

Then('the page shows at least one component and at least one proposal', async function (this: DevArchWorld) {
  await showsResults(first(this), 2 * 60_000);
});

// --- TS-063 ---------------------------------------------------------------------------------------------

When(
  'the user uploads a ZIP of the demo project {string} with an extra Java file that cannot be parsed',
  async function (this: DevArchWorld, project: string) {
    const zip = new AdmZip(demoProjectZip(project));
    const rel = 'src/main/java/broken/Broken.java';
    zip.addFile(`${project}/${rel}`, Buffer.from('package broken;\n\npublic class Broken {\n    void x( {\n'));
    this.data.brokenFile = 'Broken.java';
    await upload(this, first(this), project, zip.toBuffer());
  },
);

Then('the page shows the results together with a warning naming that file', async function (this: DevArchWorld) {
  const s = first(this);
  await showsResults(s, 10 * 60_000);
  const w = s.page.locator(byTestId('analysis-warnings'));
  await w.waitFor({ state: 'visible', timeout: 30_000 });
  const text = (await w.textContent()) ?? '';
  assert.ok(text.includes(this.data.brokenFile as string), `warnings: ${text}`);
});

// --- TS-075 ---------------------------------------------------------------------------------------------

Then('the page sent its upload to the asynchronous analyses interface', function (this: DevArchWorld) {
  const reqs = first(this).requests;
  assert.ok(reqs.some((r) => r.method === 'POST' && r.path === '/api/analyses'), JSON.stringify(reqs));
});

Then('the page made no request to the synchronous analysis interface', function (this: DevArchWorld) {
  const reqs = first(this).requests;
  assert.ok(reqs.length > 0);
  assert.ok(!reqs.some((r) => r.path === '/api/analyze'), JSON.stringify(reqs));
});

// --- TS-085 ---------------------------------------------------------------------------------------------

When(
  'the user enters the API token {string} and uploads the ZIP of the demo project {string}',
  async function (this: DevArchWorld, token: string, project: string) {
    const s = first(this);
    await upload(this, s, project);
    const input = s.page.locator(byTestId('api-token-input'));
    await input.waitFor({ state: 'visible', timeout: 60_000 });
    await input.fill(token);
    await s.page.click(byTestId('api-token-submit'));
    assert.ok(s.requests.some((r) => r.method === 'POST' && r.path === '/api/analyses'));
  },
);
