// Playwright captures of the modernization flow (010-modernization-ux T030): every step for a Java, a .NET C# and a
// VB.NET analysis in the light theme, the dark theme for each technology, plus landing, progress, history and
// comparison. Needs a running web with the built engine:
//   WEB_URL=http://127.0.0.1:9030 node --import tsx scripts/screenshots-010.ts specs/010-modernization-ux/screenshots
import AdmZip from 'adm-zip';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { chromium, type Page } from 'playwright';

const ROOT = path.resolve(import.meta.dirname, '..');
const ENGINE = path.join(ROOT, 'engine');
const URL_BASE = process.env.WEB_URL ?? 'http://127.0.0.1:9030';
const OUT = path.resolve(process.argv[2] ?? path.join(ROOT, 'specs/010-modernization-ux/screenshots'));
const STEPS = ['summary', 'map', 'proposals', 'findings', 'plan'] as const;
const tid = (id: string) => `[data-testid="${id}"]`;

function zipOf(dir: string, rootName: string): Buffer {
  const files = execFileSync('git', ['ls-files', '-z', '--', dir], { cwd: ENGINE, encoding: 'utf8' }).split('\0').filter(Boolean);
  if (files.length === 0) throw new Error(`no tracked files under ${dir}`);
  const zip = new AdmZip();
  for (const f of files) zip.addFile(path.posix.join(rootName, path.posix.relative(dir, f)), readFileSync(path.join(ENGINE, f)));
  return zip.toBuffer();
}

const PROJECTS = [
  { key: 'java', name: 'java-standar', zip: () => zipOf('test-for-demo/java-standar', 'java-standar') },
  { key: 'csharp', name: 'dotnet-ecommerce', zip: () => zipOf('test-for-demo/dotnet-ecommerce', 'dotnet-ecommerce') },
  { key: 'vb', name: 'SyntheticDesktop', zip: () => zipOf('src/test/dotnet/DotNetAnalyzer.Tests/Fixtures/VbLegacy/SyntheticDesktop', 'SyntheticDesktop') },
];

async function shot(page: Page, name: string, fullPage = true): Promise<void> {
  await page.evaluate('window.scrollTo(0, 0)');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage });
  console.log(`captured ${name}.png`);
}

async function openStep(page: Page, step: string): Promise<void> {
  await page.click(`${tid('step-link')}[data-step="${step}"]`);
  await page.locator(`${tid('step-panel')}[data-step="${step}"]`).waitFor({ state: 'visible' });
}

async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  const dark = await page.evaluate(`document.documentElement.classList.contains('dark')`);
  if ((theme === 'dark') !== dark) await page.click(tid('theme-toggle'));
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(URL_BASE, { waitUntil: 'domcontentloaded' });
  await page.locator(tid('upload-input')).waitFor({ state: 'attached', timeout: 180_000 });
  await shot(page, '00-landing-light', false);
  await setTheme(page, 'dark');
  await shot(page, '00-landing-dark', false);
  await setTheme(page, 'light');

  for (const [i, p] of PROJECTS.entries()) {
    await page.setInputFiles(tid('upload-input'), { name: `${p.name}.zip`, mimeType: 'application/zip', buffer: p.zip() });
    await page.click(tid('analyze-button'));
    if (i === 0) {
      await page.locator(`${tid('run-phase-step')}[data-state="current"]`).waitFor({ state: 'attached', timeout: 120_000 }).catch(() => undefined);
      if (await page.locator(tid('run-progress')).isVisible()) await shot(page, '01-java-running-light', false);
    }
    await page.locator(`${tid('analysis-status')}[data-status="completed"]`).waitFor({ state: 'attached', timeout: 600_000 });
    await page.locator(tid('step-nav')).waitFor({ state: 'visible', timeout: 60_000 });
    for (const [n, step] of STEPS.entries()) {
      await openStep(page, step);
      if (step === 'map') {
        const link = page.locator(tid('map-component-link')).first();
        await link.click();
      }
      if (step === 'proposals') await page.locator(tid('inference-param')).first().waitFor({ state: 'attached', timeout: 60_000 }).catch(() => undefined);
      await shot(page, `${p.key}-${n + 1}-${step}-light`);
    }
    await setTheme(page, 'dark');
    for (const step of ['summary', 'map'] as const) {
      await openStep(page, step);
      await shot(page, `${p.key}-${STEPS.indexOf(step) + 1}-${step}-dark`);
    }
    if (p.key === 'java') {
      for (const step of ['proposals', 'findings', 'plan'] as const) {
        await openStep(page, step);
        await shot(page, `${p.key}-${STEPS.indexOf(step) + 1}-${step}-dark`);
      }
    }
    await setTheme(page, 'light');
  }

  // History and comparison of the Java and the C# analyses.
  await page.click(tid('history-open'));
  await page.locator(tid('history-row')).first().waitFor({ state: 'visible', timeout: 30_000 });
  await shot(page, 'history-light', false);
  const java = page.locator(`${tid('history-row')}[data-project="java-standar"]`).first();
  const cs = page.locator(`${tid('history-row')}[data-project="dotnet-ecommerce"]`).first();
  await java.locator(tid('history-select-compare')).check();
  await cs.locator(tid('history-select-compare')).check();
  await page.click(tid('history-compare'));
  await page.locator(tid('comparison-view')).waitFor({ state: 'visible', timeout: 60_000 });
  await shot(page, 'comparison-light');

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
