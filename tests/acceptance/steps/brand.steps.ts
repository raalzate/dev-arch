// 013-agent-mcp-bridge US5 (TS-029..TS-032): header spacing, brand mark, tab icon and the analysis link.
import { Given, Then, When } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { byTestId, openSession, sessions, type BrowserSession } from '../support/browser.ts';
import { layout } from '../support/layout.ts';
import type { RemoteApi } from '../support/web-harness.ts';
import { demoZip } from '../support/web.ts';
import type { DevArchWorld } from '../support/world.ts';
import { startRealWeb } from './native-runtime-common.steps.ts';

const app = (...p: string[]) => path.join(layout.webDir, 'src', 'app', ...p);
const page = (w: DevArchWorld) => (sessions(w)[0] as BrowserSession).page;

Given('the web application sources', function () {
  /* the files are read by the following steps */
});

Then('the application declares an SVG tab icon', function () {
  const icon = app('icon.svg');
  assert.ok(existsSync(icon), 'web/src/app/icon.svg');
  assert.match(readFileSync(icon, 'utf8'), /^<svg[\s>]/);
});

Then('the generic favicon is no longer shipped', function () {
  assert.ok(!existsSync(app('favicon.ico')));
  assert.ok(!existsSync(path.join(layout.webDir, 'public', 'favicon.ico')));
});

Given('the application shell source', function (this: DevArchWorld) {
  const src = readFileSync(path.join(layout.webDir, 'src', 'components', 'app-shell.tsx'), 'utf8');
  const header = /<header[^>]*className="([^"]*)"/.exec(src);
  assert.ok(header, 'no <header> in app-shell.tsx');
  this.data.headerClass = header[1];
  this.data.shell = src;
});

Then('the header has top padding', function (this: DevArchWorld) {
  assert.match(this.data.headerClass as string, /(^|\s)(pt|py|p)-\d/);
});

Then('the header shows the brand mark before the product name', function (this: DevArchWorld) {
  const src = this.data.shell as string;
  const mark = src.indexOf('<BrandMark');
  const name = src.indexOf('>dev-arch<');
  assert.ok(mark > 0 && name > mark, 'BrandMark must precede the product name');
});

Then('the header is hidden when printing', function (this: DevArchWorld) {
  assert.match(this.data.headerClass as string, /print:hidden/);
});

// --- browser (@e2e) -------------------------------------------------------------------------------------------

Given('the web open in the browser with the theme {string} at a width of {int} pixels', async function (this: DevArchWorld, theme: string, width: number) {
  if (!this.data.url) await startRealWeb(this);
  const s = await openSession(this, this.data.url as string);
  await s.page.setViewportSize({ width, height: 800 });
  await s.page.emulateMedia({ colorScheme: theme as 'light' | 'dark' });
  await s.page.reload({ waitUntil: 'domcontentloaded' });
  await s.page.locator(byTestId('brand-mark')).waitFor({ state: 'visible', timeout: 60_000 });
  assert.equal(await s.page.evaluate(() => document.documentElement.classList.contains('dark')), theme === 'dark');
});

Then('the brand mark is visible in the header', async function (this: DevArchWorld) {
  assert.ok(await page(this).locator(`header ${byTestId('brand-mark')}`).isVisible());
});

Then('the top of the header content is at least {int} pixels below the top of the window', async function (this: DevArchWorld, px: number) {
  const box = await page(this).locator(byTestId('brand-mark')).boundingBox();
  assert.ok(box && box.y >= px, `brand mark top ${box?.y}`);
});

Then('the page has no horizontal scroll', async function (this: DevArchWorld) {
  assert.ok(await page(this).evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
});

Then('the document declares the dev-arch tab icon', async function (this: DevArchWorld) {
  const href = await page(this).locator('link[rel="icon"]').first().getAttribute('href');
  assert.match(href ?? '', /icon\.svg/);
});

Given('a completed analysis in the web', async function (this: DevArchWorld) {
  const remote = await startRealWeb(this);
  const res = await remote.call('POST', '/api/analyses', { body: demoZip(layout.engineRoot, 'java-standar'), headers: { 'content-type': 'application/zip' } });
  assert.equal(res.status, 202, res.text);
  const id = res.json.jobId as string;
  const deadline = Date.now() + 600_000;
  for (;;) {
    const s = await (this.data.api as RemoteApi).call('GET', `/api/analyses/${id}`);
    if (s.json.status === 'completed') break;
    assert.notEqual(s.json.status, 'failed', s.text);
    assert.ok(Date.now() < deadline, 'analysis did not finish');
    await new Promise((r) => setTimeout(r, 1000));
  }
  this.data.analysisId = id;
});

When('the browser opens the link {string} of that analysis', async function (this: DevArchWorld, link: string) {
  await openSession(this, `${this.data.url as string}${link.replace('<id>', this.data.analysisId as string)}`);
});

Then('the web shows the summary of that analysis', async function (this: DevArchWorld) {
  const p = page(this);
  await p.locator(byTestId('analysis-id')).waitFor({ state: 'attached', timeout: 120_000 });
  await p.waitForFunction((id) => document.querySelector('[data-testid="analysis-id"]')?.textContent === id, this.data.analysisId, { timeout: 120_000 });
  assert.ok(!(p.url()).includes('analysis='), 'the parameter stays in the address bar');
});
