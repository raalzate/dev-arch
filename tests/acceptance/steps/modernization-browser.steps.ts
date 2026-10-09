// Browser end-to-end steps of 010-modernization-ux (@e2e, Playwright, real engine). They reuse the 007 browser
// support (sessions, uploads, storage) and the DOM hooks of specs/010-modernization-ux/contracts/ui-sections.md.
import { Given, Then, When } from '@cucumber/cucumber';
import AdmZip from 'adm-zip';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from 'playwright';
import { byTestId, openSession, sessions, type BrowserSession } from '../support/browser.ts';
import { git } from '../support/git.ts';
import { layout } from '../support/layout.ts';
import { tempDir } from '../support/tools.ts';
import type { DevArchWorld } from '../support/world.ts';

const STEP_IDS = ['summary', 'map', 'proposals', 'findings', 'plan'];
const VB_FIXTURE = 'src/test/dotnet/DotNetAnalyzer.Tests/Fixtures/VbLegacy/SyntheticDesktop';
const ACTIVE_JOB = 'devarch.activeJobId';

const first = (w: DevArchWorld): BrowserSession => sessions(w)[0];
const page = (w: DevArchWorld): Page => first(w).page;

function url(world: DevArchWorld): string {
  const u = world.data.url as string | undefined;
  assert.ok(u, 'the web is not running');
  return u;
}

async function activeJob(p: Page): Promise<string> {
  const id = (await p.evaluate(`window.localStorage.getItem(${JSON.stringify(ACTIVE_JOB)})`)) as string | null;
  assert.ok(id, 'no active analysis');
  return id;
}

async function apiJson(p: Page, apiPath: string): Promise<any> {
  const res = await p.request.get(new URL(apiPath, p.url()).toString());
  assert.equal(res.status(), 200, await res.text());
  return res.json();
}

async function waitResults(s: BrowserSession, timeoutMs = 10 * 60_000): Promise<void> {
  await s.page.locator(`${byTestId('analysis-status')}[data-status="completed"]`).waitFor({ state: 'attached', timeout: timeoutMs });
  await s.page.locator(byTestId('step-nav')).waitFor({ state: 'visible', timeout: 60_000 });
}

async function openStep(p: Page, step: string): Promise<void> {
  await p.locator(`${byTestId('step-link')}[data-step="${step}"]`).click();
  await p.locator(`${byTestId('step-panel')}[data-step="${step}"]`).waitFor({ state: 'visible', timeout: 30_000 });
}

/** Section ids and counts of the visible step panel. */
async function sectionsShown(p: Page): Promise<{ id: string; count: number }[]> {
  return p.locator(`${byTestId('step-panel')} ${byTestId('section')}`).evaluateAll((els) =>
    els.map((e) => ({ id: e.getAttribute('data-section') ?? '', count: Number(e.getAttribute('data-count') ?? 'NaN') })),
  );
}

// --- uploads --------------------------------------------------------------------------------------------

function vbZip(): Buffer {
  const files = git(['ls-files', '-z', '--', VB_FIXTURE], layout.engineRoot).split('\0').filter(Boolean);
  assert.ok(files.length > 0, 'the VB synthetic fixture has no tracked files');
  const zip = new AdmZip();
  for (const f of files) zip.addFile(path.posix.join('SyntheticDesktop', path.posix.relative(VB_FIXTURE, f)), readFileSync(path.join(layout.engineRoot, f)));
  return zip.toBuffer();
}

When('the user uploads the ZIP of the VB synthetic desktop project and the analysis completes', async function (this: DevArchWorld) {
  const s = first(this);
  const dir = tempDir('devarch-010-vb');
  this.cleanup.push(dir);
  const file = path.join(dir, 'SyntheticDesktop.zip');
  writeFileSync(file, vbZip());
  await s.page.setInputFiles(byTestId('upload-input'), file);
  s.uploadAt = Date.now();
  s.project = 'SyntheticDesktop';
  await s.page.click(byTestId('analyze-button'));
  await waitResults(s);
});

When('the analysis completes', async function (this: DevArchWorld) {
  await waitResults(first(this));
});

// --- flow and sections ----------------------------------------------------------------------------------

When('the user visits every step of the flow', async function (this: DevArchWorld) {
  const p = page(this);
  const visited: Record<string, { sections: { id: string; count: number }[]; text: string }> = {};
  for (const step of STEP_IDS) {
    await openStep(p, step);
    // Findings tabs are sections too: open each one so its content is rendered.
    const sections = await sectionsShown(p);
    let text = (await p.locator(byTestId('step-panel')).innerText()) ?? '';
    if (step === 'findings') {
      for (const tab of await p.locator(byTestId('findings-tab')).all()) {
        await tab.click();
        text += '\n' + (await p.locator(byTestId('step-panel')).innerText());
        for (const s of await sectionsShown(p)) if (!sections.some((x) => x.id === s.id)) sections.push(s);
      }
    }
    visited[step] = { sections, text };
  }
  this.data.visited = visited;
});

const visited = (w: DevArchWorld) => w.data.visited as Record<string, { sections: { id: string; count: number }[]; text: string }>;

Then('the technology badge reads {string}', async function (this: DevArchWorld, label: string) {
  const badge = page(this).locator(byTestId('technology-badge')).first();
  await badge.waitFor({ state: 'visible', timeout: 30_000 });
  assert.equal((await badge.innerText()).trim(), label);
});

Then('no step shows a section whose identifier starts with {string}', function (this: DevArchWorld, prefix: string) {
  for (const [step, v] of Object.entries(visited(this))) {
    const bad = v.sections.filter((s) => s.id.startsWith(prefix));
    assert.deepEqual(bad, [], `step ${step}`);
  }
});

Then('no step shows a section whose identifier starts with {string}, {string} or {string}', function (this: DevArchWorld, a: string, b: string, c: string) {
  for (const [step, v] of Object.entries(visited(this))) {
    const bad = v.sections.filter((s) => [a, b, c].some((x) => s.id.startsWith(x)));
    assert.deepEqual(bad, [], `step ${step}`);
  }
});

Then('no step shows the text {string} or {string}', function (this: DevArchWorld, a: string, b: string) {
  for (const [step, v] of Object.entries(visited(this))) {
    assert.ok(!v.text.includes(a) && !v.text.includes(b), `step ${step} shows "${a}" or "${b}"`);
  }
});

Then('every section shown in any step declares at least one item', function (this: DevArchWorld) {
  let total = 0;
  for (const [step, v] of Object.entries(visited(this))) {
    for (const s of v.sections) {
      total++;
      assert.ok(s.count >= 1, `step ${step} shows section ${s.id} with ${s.count} items`);
    }
  }
  assert.ok(total > 0, 'no section was shown at all');
});

Then('the summary shows the reduced fidelity warning', async function (this: DevArchWorld) {
  const p = page(this);
  await openStep(p, 'summary');
  await p.locator(byTestId('reduced-fidelity-warning')).waitFor({ state: 'visible', timeout: 30_000 });
});

Then('the findings step shows the sections {string} and {string}', function (this: DevArchWorld, a: string, b: string) {
  const ids = visited(this).findings.sections.map((s) => s.id);
  for (const id of [a, b]) assert.ok(ids.includes(id), `${id} not shown: ${ids.join(', ')}`);
});

Then(
  'the step navigation lists {string}, {string}, {string}, {string} and {string} in this order',
  async function (this: DevArchWorld, s1: string, s2: string, s3: string, s4: string, s5: string) {
    const p = page(this);
    const shown = await p.locator(`${byTestId('step-nav')} ${byTestId('step-link')}`).evaluateAll((els) => els.map((e) => e.getAttribute('data-step')));
    assert.deepEqual(shown, [s1, s2, s3, s4, s5]);
  },
);

Then('the step {string} is marked as the current step', async function (this: DevArchWorld, step: string) {
  const p = page(this);
  assert.equal(await p.locator(`${byTestId('step-link')}[data-step="${step}"]`).getAttribute('aria-current'), 'step');
  await p.locator(`${byTestId('step-panel')}[data-step="${step}"]`).waitFor({ state: 'visible', timeout: 10_000 });
});

Then(
  'the user can activate each step using only the keyboard, and each activated step is shown and marked as current',
  async function (this: DevArchWorld) {
    const p = page(this);
    for (const step of [...STEP_IDS.slice(1), 'summary']) {
      await p.locator(`${byTestId('step-link')}[data-step="${step}"]`).focus();
      await p.keyboard.press('Enter');
      await p.locator(`${byTestId('step-panel')}[data-step="${step}"]`).waitFor({ state: 'visible', timeout: 30_000 });
      assert.equal(await p.locator(`${byTestId('step-link')}[data-step="${step}"]`).getAttribute('aria-current'), 'step');
      const others = await p.locator(`${byTestId('step-link')}[aria-current="step"]`).count();
      assert.equal(others, 1);
    }
    // Arrow keys move the focus along the step list (roving focus of the navigation).
    await p.locator(`${byTestId('step-link')}[data-step="summary"]`).focus();
    await p.keyboard.press('ArrowDown');
    const focused = await p.evaluate(`document.activeElement?.getAttribute('data-step')`);
    assert.equal(focused, 'map');
  },
);

Then(
  'the summary shows the technology badge, the component count, the lines of code and the dependency count of the analysis',
  async function (this: DevArchWorld) {
    const p = page(this);
    const graph = await apiJson(p, `/api/analyses/${await activeJob(p)}/graph`);
    this.data.graph = graph;
    const panel = p.locator(`${byTestId('step-panel')}[data-step="summary"]`);
    await panel.locator(byTestId('technology-badge')).waitFor({ state: 'visible' });
    const metric = async (k: string) => Number(((await panel.locator(`${byTestId('summary-metric')}[data-metric="${k}"]`).getAttribute('data-value')) ?? 'NaN'));
    assert.equal(await metric('components'), graph.components.length);
    assert.equal(await metric('loc'), graph.components.reduce((n: number, c: { loc: number }) => n + c.loc, 0));
    assert.equal(await metric('edges'), graph.edges.length);
  },
);

Then('the summary shows the number of code issues of each severity present in the analysis', async function (this: DevArchWorld) {
  const p = page(this);
  const graph = this.data.graph as { components: { code_issues: { severity: string }[] }[] };
  const counts: Record<string, number> = {};
  for (const i of graph.components.flatMap((c) => c.code_issues)) counts[i.severity] = (counts[i.severity] ?? 0) + 1;
  assert.ok(Object.keys(counts).length > 0);
  for (const [sev, n] of Object.entries(counts)) {
    const v = await p.locator(`${byTestId('summary-severity')}[data-severity="${sev}"]`).getAttribute('data-value');
    assert.equal(Number(v), n, sev);
  }
});

Then(
  'the summary shows between {int} and {int} candidate proposals and between {int} and {int} risky components',
  async function (this: DevArchWorld, a: number, b: number, c: number, d: number) {
    const panel = page(this).locator(`${byTestId('step-panel')}[data-step="summary"]`);
    const proposals = await panel.locator(byTestId('proposal-card')).count();
    const risky = await panel.locator(byTestId('component-node')).count();
    assert.ok(proposals >= a && proposals <= b, `${proposals} candidates`);
    assert.ok(risky >= c && risky <= d, `${risky} risky components`);
  },
);

Then('the summary shows the analysis warnings', async function (this: DevArchWorld) {
  const w = page(this).locator(`${byTestId('step-panel')}[data-step="summary"] ${byTestId('analysis-warnings')}`);
  await w.waitFor({ state: 'visible', timeout: 30_000 });
  assert.ok((await w.innerText()).includes('Broken.java'));
});

Then(
  'while the analysis is running the page shows the current phase marked within the four phases and an elapsed time',
  async function (this: DevArchWorld) {
    const p = page(this);
    await p.evaluate(`(() => {
      window.__earlyResults = false;
      const check = () => {
        const st = document.querySelector('[data-testid="analysis-status"]')?.getAttribute('data-status');
        if (st !== 'completed' && document.querySelector('[data-testid="step-panel"]')) window.__earlyResults = true;
      };
      check();
      new MutationObserver(check).observe(document, { subtree: true, childList: true, attributes: true });
    })()`);
    const deadline = Date.now() + 10 * 60_000;
    for (;;) {
      const st = await p.locator(byTestId('analysis-status')).getAttribute('data-status').catch(() => null);
      if (st === 'running') {
        const current = p.locator(`${byTestId('run-phase-step')}[data-state="current"]`);
        if ((await current.count()) === 1) {
          assert.equal(await p.locator(byTestId('run-phase-step')).count(), 4);
          const elapsed = (await p.locator(byTestId('run-elapsed')).innerText()).trim();
          assert.match(elapsed, /\d/);
          return;
        }
      }
      assert.ok(st !== 'completed' && st !== 'failed', `the analysis ended (${st}) before a running phase was observed`);
      assert.ok(Date.now() < deadline, 'no running phase observed');
      await p.waitForTimeout(50);
    }
  },
);

Then('no step of the results is shown before the analysis completes', async function (this: DevArchWorld) {
  const p = page(this);
  await waitResults(first(this));
  assert.equal(await p.evaluate('window.__earlyResults'), false);
});

// --- theme ----------------------------------------------------------------------------------------------

When('the user switches the theme to dark', async function (this: DevArchWorld) {
  const p = page(this);
  if (!(await p.evaluate(`document.documentElement.classList.contains('dark')`))) await p.click(byTestId('theme-toggle'));
  assert.equal(await p.evaluate(`document.documentElement.classList.contains('dark')`), true);
});

When('the user reloads the page', async function (this: DevArchWorld) {
  await page(this).reload({ waitUntil: 'domcontentloaded' });
  await waitResults(first(this));
});

Then('the page is displayed in dark mode', async function (this: DevArchWorld) {
  const p = page(this);
  await p.waitForFunction(`document.documentElement.classList.contains('dark')`, undefined, { timeout: 30_000 });
  const bg = (await p.evaluate(`getComputedStyle(document.body).backgroundColor`)) as string;
  const [r, g, b] = (bg.match(/\d+/g) ?? []).map(Number);
  assert.ok(0.2126 * r + 0.7152 * g + 0.0722 * b < 80, `background ${bg} is not dark`);
});

Given('a browser session that prefers a dark color scheme is open on the web', async function (this: DevArchWorld) {
  const s = await openSession(this, url(this));
  await s.page.emulateMedia({ colorScheme: 'dark' });
  await s.page.reload({ waitUntil: 'domcontentloaded' });
  await s.page.locator(byTestId('upload-input')).waitFor({ state: 'attached', timeout: 180_000 });
});

// --- map ------------------------------------------------------------------------------------------------

When('the user opens the step {string}', async function (this: DevArchWorld, step: string) {
  const p = page(this);
  const id = await activeJob(p);
  this.data.analysisId = id;
  if (this.data.storedArchitecture === undefined) {
    const res = await p.request.get(new URL(`/api/analyses/${id}/architecture`, p.url()).toString());
    this.data.storedArchitecture = await res.text();
  }
  await openStep(p, step);
  if (step === 'proposals') this.data.originalViabilities = await viabilities(p);
});

const edgeTypesOf = (t: string) => t.split(',').map((x) => x.trim()).filter(Boolean);

Then('the map legend lists every dependency type of the analysis with its count', async function (this: DevArchWorld) {
  const p = page(this);
  const graph = await apiJson(p, `/api/analyses/${await activeJob(p)}/graph`);
  this.data.graph = graph;
  const expected: Record<string, number> = {};
  for (const e of graph.edges) for (const t of edgeTypesOf(e.type)) expected[t] = (expected[t] ?? 0) + 1;
  const shown = await p.locator(byTestId('map-legend-type')).evaluateAll((els) =>
    Object.fromEntries(els.map((e) => [e.getAttribute('data-type'), Number(e.getAttribute('data-count'))])),
  );
  assert.deepEqual(shown, expected);
});

async function drawnEdges(p: Page): Promise<string[]> {
  await p.waitForTimeout(300);
  return (await p.locator(byTestId('map-edge')).evaluateAll((els) => els.map((e) => `${e.getAttribute('data-from')}->${e.getAttribute('data-to')}`))).sort();
}

Then('the map draws one line per dependency of the analysis', async function (this: DevArchWorld) {
  const graph = this.data.graph as { edges: { from: string; to: string }[] };
  assert.deepEqual(await drawnEdges(page(this)), graph.edges.map((e) => `${e.from}->${e.to}`).sort());
});

When('the user disables the dependency type {string} in the legend', async function (this: DevArchWorld, t: string) {
  await page(this).locator(`${byTestId('map-legend-type')}[data-type="${t}"]`).click();
});

Then('the map draws exactly the dependencies having a type other than {string}', async function (this: DevArchWorld, t: string) {
  const graph = this.data.graph as { edges: { from: string; to: string; type: string }[] };
  const expected = graph.edges.filter((e) => edgeTypesOf(e.type).some((x) => x !== t)).map((e) => `${e.from}->${e.to}`).sort();
  assert.ok(expected.length < graph.edges.length, `no dependency is only of type ${t}`);
  assert.deepEqual(await drawnEdges(page(this)), expected);
  this.data.expectedDrawn = expected;
});

Then('the textual dependency table lists exactly the drawn dependencies', async function (this: DevArchWorld) {
  const rows = await page(this).locator(byTestId('map-edge-row')).evaluateAll((els) =>
    els.map((e) => `${e.getAttribute('data-from')}->${e.getAttribute('data-to')}`),
  );
  assert.deepEqual(rows.sort(), this.data.expectedDrawn);
});

When('the user groups the map by proposal', async function (this: DevArchWorld) {
  await page(this).locator(`${byTestId('map-group-mode')} [data-mode="proposal"]`).click();
});

Then('the map legend names the group of every proposal of the analysis', async function (this: DevArchWorld) {
  const p = page(this);
  const arch = await apiJson(p, `/api/analyses/${await activeJob(p)}/architecture`);
  await p.waitForTimeout(300);
  const groups = await p.locator(byTestId('map-legend-group')).evaluateAll((els) => els.map((e) => e.getAttribute('data-group')));
  for (const prop of arch.proposals as { name: string }[]) assert.ok(groups.includes(prop.name), `${prop.name} not in ${groups.join(', ')}`);
});

// --- inference ------------------------------------------------------------------------------------------

async function viabilities(p: Page): Promise<Record<string, string>> {
  return p.locator(`${byTestId('step-panel')}[data-step="proposals"] ${byTestId('proposal-card')}`).evaluateAll((els) =>
    Object.fromEntries(els.map((e) => [e.getAttribute('data-proposal-id') ?? '', e.getAttribute('data-viability') ?? ''])),
  );
}

Then('the inference panel shows every parameter with its engine default', async function (this: DevArchWorld) {
  const p = page(this);
  const d = await apiJson(p, '/api/inference/defaults');
  await p.locator(byTestId('inference-panel')).waitFor({ state: 'visible', timeout: 60_000 });
  for (const param of d.parameters as { path: string; default: number; min: number; max: number }[]) {
    const el = p.locator(`${byTestId('inference-param')}[data-path="${param.path}"]`);
    await el.waitFor({ state: 'attached', timeout: 30_000 });
    assert.equal(Number(await el.getAttribute('aria-valuenow')), param.default, param.path);
    assert.equal(Number(await el.getAttribute('aria-valuemin')), param.min, param.path);
    assert.equal(Number(await el.getAttribute('aria-valuemax')), param.max, param.path);
  }
});

async function setParam(w: DevArchWorld, p: Page, param: string, value: number): Promise<void> {
  const before = Number((await p.locator(byTestId('inference-status')).getAttribute('data-revision')) ?? '0');
  const input = p.locator(`${byTestId('inference-input')}[data-path="${param}"]`);
  await input.fill(String(value));
  await input.press('Enter');
  const started = Date.now();
  await p.waitForFunction(
    `(() => { const s = document.querySelector('[data-testid="inference-status"]');
      return s && Number(s.getAttribute('data-revision')) > ${before} && s.getAttribute('data-state') !== 'pending'; })()`,
    undefined,
    { timeout: 30_000 },
  );
  const times = ((w.data.recalcMs as number[] | undefined) ??= []);
  times.push(Date.now() - started);
}

When('the user sets {string} to {float} and {string} to {float}', async function (this: DevArchWorld, a: string, va: number, b: string, vb: number) {
  const p = page(this);
  this.data.postsBefore = first(this).requests.filter((r) => r.method === 'POST' && r.path === '/api/analyses').length;
  await setParam(this, p, a, va);
  await setParam(this, p, b, vb);
});

When('the user sets {string} to {float}', async function (this: DevArchWorld, a: string, va: number) {
  const p = page(this);
  this.data.previousViabilities = await viabilities(p);
  await setParam(this, p, a, va);
});

Then('within {int} seconds of each change the page shows recalculated proposals', async function (this: DevArchWorld, s: number) {
  const p = page(this);
  assert.equal(await p.locator(byTestId('inference-status')).getAttribute('data-state'), 'recalculated');
  for (const ms of this.data.recalcMs as number[]) assert.ok(ms < s * 1000, `recalculation took ${ms} ms`);
});

Then('after the last change every proposal has viability {string}', async function (this: DevArchWorld, v: string) {
  const all = Object.values(await viabilities(page(this)));
  assert.ok(all.length > 0);
  for (const x of all) assert.equal(x, v);
});

Then('the page sent no new analysis after the upload', function (this: DevArchWorld) {
  const posts = first(this).requests.filter((r) => r.method === 'POST' && r.path === '/api/analyses').length;
  assert.equal(posts, this.data.postsBefore);
  assert.equal(posts, 1);
});

When('the user resets the inference parameters', async function (this: DevArchWorld) {
  const p = page(this);
  await p.click(byTestId('inference-reset'));
  await p.locator(`${byTestId('inference-status')}[data-state="original"]`).waitFor({ state: 'attached', timeout: 30_000 });
});

Then('the proposals show again their original viabilities', async function (this: DevArchWorld) {
  assert.deepEqual(await viabilities(page(this)), this.data.originalViabilities);
});

Then('the inference panel shows an error containing {string}', async function (this: DevArchWorld, text: string) {
  const p = page(this);
  const err = p.locator(byTestId('inference-error'));
  await err.waitFor({ state: 'visible', timeout: 30_000 });
  assert.ok((await err.innerText()).includes(text), await err.innerText());
});

Then('the proposals keep their previous viabilities', async function (this: DevArchWorld) {
  assert.deepEqual(await viabilities(page(this)), this.data.previousViabilities);
});

When('the user moves a component of the first proposal to the second proposal', async function (this: DevArchWorld) {
  const p = page(this);
  const cards = p.locator(`${byTestId('step-panel')}[data-step="proposals"] ${byTestId('proposal-card')}`);
  assert.ok((await cards.count()) >= 2, 'fewer than two proposals');
  const a = cards.nth(0);
  const b = cards.nth(1);
  this.data.movedBetween = [await a.getAttribute('data-proposal-id'), await b.getAttribute('data-proposal-id')];
  await a.locator(byTestId('proposal-edit')).click();
  const select = a.locator(byTestId('proposal-move-select')).first();
  await select.waitFor({ state: 'visible', timeout: 10_000 });
  await select.selectOption(String(this.data.movedBetween[1]));
});

Then('both proposals are marked as edited and show a viability and a score returned by the engine', async function (this: DevArchWorld) {
  const p = page(this);
  for (const id of this.data.movedBetween as string[]) {
    const card = p.locator(`${byTestId('proposal-card')}[data-proposal-id="${id}"]`);
    await card.locator(byTestId('proposal-score')).waitFor({ state: 'visible', timeout: 60_000 });
    assert.equal(await card.getAttribute('data-edited'), 'true');
    const score = card.locator(byTestId('proposal-score'));
    assert.match((await score.getAttribute('data-viability')) ?? '', /^(Alta|Media|Baja)$/);
    assert.ok(Number.isFinite(Number(await score.getAttribute('data-score'))));
  }
});

When('the analysis is re-inferred twice with the configuration {}', async function (this: DevArchWorld, json: string) {
  const p = page(this);
  const id = await activeJob(p);
  const out: string[] = [];
  for (let i = 0; i < 2; i++) {
    const res = await p.request.post(new URL(`/api/analyses/${id}/reinfer`, p.url()).toString(), {
      data: { config: JSON.parse(json) },
    });
    assert.equal(res.status(), 200, await res.text());
    out.push(await res.text());
  }
  this.data.reinferred = out;
});

Then('both re-inferred architectures are byte-identical', function (this: DevArchWorld) {
  const [a, b] = this.data.reinferred as string[];
  assert.equal(a, b);
});

// --- findings and details -------------------------------------------------------------------------------

When('the user opens the step {string} and the tab {string}', async function (this: DevArchWorld, step: string, tab: string) {
  const p = page(this);
  await openStep(p, step);
  await p.locator(`${byTestId('findings-tab')}[data-tab="${tab}"]`).click();
});

Then(
  'the contracts tab shows one row per endpoint of the analysis contracts with its method, path and owner component',
  async function (this: DevArchWorld) {
    const p = page(this);
    const graph = await apiJson(p, `/api/analyses/${await activeJob(p)}/graph`);
    const endpoints = graph.api_contracts.endpoints as { method: string; path: string; component_id: string }[];
    assert.ok(endpoints.length > 0);
    const rows = await p.locator(byTestId('contract-row')).evaluateAll((els) =>
      els.map((e) => [e.getAttribute('data-method'), e.getAttribute('data-path'), e.getAttribute('data-component')].join(' ')),
    );
    assert.deepEqual(rows.sort(), endpoints.map((e) => [e.method, e.path, e.component_id].join(' ')).sort());
  },
);

When('the user opens the step {string} and the details of the first proposal', async function (this: DevArchWorld, step: string) {
  const p = page(this);
  await openStep(p, step);
  const card = p.locator(`${byTestId('step-panel')}[data-step="${step}"] ${byTestId('proposal-card')}`).first();
  this.data.proposalId = await card.getAttribute('data-proposal-id');
  await card.locator(byTestId('proposal-details-toggle')).click();
  await card.locator(byTestId('proposal-details')).waitFor({ state: 'visible', timeout: 10_000 });
});

Then('the details show the legacy entrypoint type and the signals cluster count of that proposal', async function (this: DevArchWorld) {
  const p = page(this);
  const arch = await apiJson(p, `/api/analyses/${await activeJob(p)}/architecture`);
  const prop = (arch.proposals as { id: number; legacy_entrypoint?: { type: string } | null; signals: { cluster_count: number } }[])
    .find((x) => String(x.id) === this.data.proposalId);
  assert.ok(prop);
  const details = p.locator(`${byTestId('proposal-card')}[data-proposal-id="${this.data.proposalId}"] ${byTestId('proposal-details')}`);
  if (prop.legacy_entrypoint) {
    assert.equal(await details.locator(byTestId('proposal-entrypoint')).getAttribute('data-type'), prop.legacy_entrypoint.type);
  }
  assert.equal(Number(await details.locator(byTestId('proposal-signals')).getAttribute('data-cluster-count')), prop.signals.cluster_count);
});

When('the user opens the details of a component that has incoming calls', async function (this: DevArchWorld) {
  const p = page(this);
  const graph = await apiJson(p, `/api/analyses/${await activeJob(p)}/graph`);
  const comp = (graph.components as { id: string; calls_in: string[] }[]).find((c) => c.calls_in.length > 0);
  assert.ok(comp, 'no component with incoming calls');
  this.data.component = comp;
  this.data.graph = graph;
  await openStep(p, 'map');
  await p.locator(`${byTestId('map-component-link')}[data-component-id="${comp.id}"]`).first().click();
  await p.locator(byTestId('component-details')).waitFor({ state: 'visible', timeout: 10_000 });
});

Then('the details list its incoming calls', async function (this: DevArchWorld) {
  const comp = this.data.component as { calls_in: string[] };
  const shown = await page(this).locator(`${byTestId('component-details')} ${byTestId('calls-in-item')}`).allInnerTexts();
  assert.deepEqual(shown.map((s) => s.trim()).sort(), [...comp.calls_in].sort());
});

Then('the details show no attribute label whose value is empty for that component', async function (this: DevArchWorld) {
  const attrs = await page(this).locator(`${byTestId('component-details')} ${byTestId('detail-attr')}`).evaluateAll((els) =>
    els.map((e) => ({ attr: e.getAttribute('data-attr'), value: (e.querySelector('[data-testid="detail-value"]')?.textContent ?? '').trim() })),
  );
  assert.ok(attrs.length > 0);
  for (const a of attrs) assert.ok(a.value.length > 0 && a.value !== 'N/A' && a.value !== 'null', `attribute ${a.attr} is empty`);
  const comp = this.data.component as Record<string, unknown>;
  for (const key of ['domain', 'ejb_type', 'messaging_type', 'web_type', 'extends']) {
    if (comp[key] === null || comp[key] === undefined) assert.ok(!attrs.some((a) => a.attr === key), `${key} shown without value`);
  }
});

// --- plan and exports -----------------------------------------------------------------------------------

Then('the plan shows its stages ordered by viability', async function (this: DevArchWorld) {
  const order = ['Alta', 'Media', 'Baja'];
  const stages = await page(this).locator(byTestId('plan-stage')).evaluateAll((els) => els.map((e) => e.getAttribute('data-viability') ?? ''));
  assert.ok(stages.length > 0);
  for (let i = 1; i < stages.length; i++) assert.ok(order.indexOf(stages[i - 1]) < order.indexOf(stages[i]), stages.join(','));
});

When('the user exports the plan as Markdown', async function (this: DevArchWorld) {
  const p = page(this);
  const [download] = await Promise.all([p.waitForEvent('download', { timeout: 30_000 }), p.click(byTestId('export-markdown'))]);
  const dir = tempDir('devarch-010-md');
  this.cleanup.push(dir);
  const file = path.join(dir, download.suggestedFilename());
  await download.saveAs(file);
  this.data.markdownFile = file;
});

Then('a Markdown file is downloaded containing {string} and the name of every proposal of the analysis', async function (this: DevArchWorld, text: string) {
  const file = this.data.markdownFile as string;
  assert.ok(file.endsWith('.md'), file);
  const md = readFileSync(file, 'utf8');
  assert.ok(md.includes(text));
  const p = page(this);
  const arch = await apiJson(p, `/api/analyses/${await activeJob(p)}/architecture`);
  for (const prop of arch.proposals as { name: string }[]) assert.ok(md.includes(prop.name), prop.name);
});

When('the user exports the plan as PDF', async function (this: DevArchWorld) {
  const p = page(this);
  await p.evaluate(`window.__printCalls = 0; window.print = () => { window.__printCalls++; };`);
  await p.click(byTestId('export-pdf'));
});

Then('the browser print is requested and the printable report contains the name of every proposal of the analysis', async function (this: DevArchWorld) {
  const p = page(this);
  await p.waitForFunction('window.__printCalls > 0', undefined, { timeout: 10_000 });
  await p.emulateMedia({ media: 'print' });
  const report = p.locator(byTestId('print-report'));
  await report.waitFor({ state: 'visible', timeout: 10_000 });
  const text = await report.innerText();
  const arch = await apiJson(p, `/api/analyses/${await activeJob(p)}/architecture`);
  for (const prop of arch.proposals as { name: string }[]) assert.ok(text.includes(prop.name), prop.name);
  assert.equal(await p.locator(byTestId('step-nav')).isVisible(), false, 'the interface controls are printed');
  await p.emulateMedia({ media: 'screen' });
});

// --- history and comparison -----------------------------------------------------------------------------

When('the user opens the history', async function (this: DevArchWorld) {
  const p = page(this);
  this.data.jobsSeen = this.data.jobsSeen ?? [];
  await p.click(byTestId('history-open'));
  await p.locator(byTestId('history-row')).first().waitFor({ state: 'visible', timeout: 30_000 });
});

Then('the history lists both analyses, the most recent first, each with its technology', async function (this: DevArchWorld) {
  const p = page(this);
  const list = await apiJson(p, '/api/analyses');
  const rows = await p.locator(byTestId('history-row')).evaluateAll((els) =>
    els.map((e) => ({ id: e.getAttribute('data-job-id'), tech: e.getAttribute('data-technology'), project: e.getAttribute('data-project') })),
  );
  assert.ok(rows.length >= 2);
  assert.deepEqual(rows.map((r) => r.id), (list.analyses as { jobId: string }[]).map((a) => a.jobId));
  assert.equal(rows[0].tech, 'csharp');
  assert.equal(rows[1].tech, 'java');
  this.data.historyRows = rows;
});

When('the user opens the {string} analysis from the history', async function (this: DevArchWorld, project: string) {
  const p = page(this);
  const row = p.locator(`${byTestId('history-row')}[data-project="${project}"]`).first();
  this.data.openedJob = await row.getAttribute('data-job-id');
  await row.locator(byTestId('history-open-analysis')).click();
});

Then('the page shows the results of that analysis and keeps it as the active analysis', async function (this: DevArchWorld) {
  const p = page(this);
  const id = this.data.openedJob as string;
  await p.waitForFunction(`document.querySelector('[data-testid="analysis-id"]')?.textContent?.trim() === ${JSON.stringify(id)}`, undefined, { timeout: 60_000 });
  await waitResults(first(this));
  assert.equal(await activeJob(p), id);
  await p.locator(`${byTestId('technology-badge')}[data-technology="java"]`).first().waitFor({ state: 'visible', timeout: 30_000 });
});

When('the user compares the two analyses from the history', async function (this: DevArchWorld) {
  const p = page(this);
  await p.click(byTestId('history-open'));
  const rows = p.locator(byTestId('history-row'));
  await rows.first().waitFor({ state: 'visible', timeout: 30_000 });
  for (let i = 0; i < 2; i++) await rows.nth(i).locator(byTestId('history-select-compare')).check();
  await p.click(byTestId('history-compare'));
  await p.locator(byTestId('comparison-view')).waitFor({ state: 'visible', timeout: 60_000 });
});

Then('the comparison shows the totals of both analyses and the components present only in each one', async function (this: DevArchWorld) {
  const p = page(this);
  const view = p.locator(byTestId('comparison-view'));
  const totals = await view.locator(byTestId('comparison-total')).evaluateAll((els) =>
    els.map((e) => ({ metric: e.getAttribute('data-metric'), a: Number(e.getAttribute('data-a')), b: Number(e.getAttribute('data-b')) })),
  );
  const comp = totals.find((t) => t.metric === 'components');
  assert.ok(comp, 'no components total');
  const counts = [comp.a, comp.b].sort();
  const java = await apiJson(p, `/api/analyses/${(this.data.historyRows as { id: string }[])[1].id}/graph`);
  const net = await apiJson(p, `/api/analyses/${(this.data.historyRows as { id: string }[])[0].id}/graph`);
  assert.deepEqual(counts, [java.components.length, net.components.length].sort());
  assert.ok((await view.locator(`${byTestId('comparison-only-a')} li`).count()) > 0);
  assert.ok((await view.locator(`${byTestId('comparison-only-b')} li`).count()) > 0);
});
