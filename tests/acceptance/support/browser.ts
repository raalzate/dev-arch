// Browser support for the @e2e scenarios of 007 (research D11): Playwright (library) with Chromium, one isolated
// BrowserContext per session, element lookup by data-testid and recording of the requests each page sends.
import { After, AfterAll } from '@cucumber/cucumber';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import type { DevArchWorld } from './world.ts';

export interface RecordedRequest {
  method: string;
  path: string;
  at: number;
}

export interface BrowserSession {
  context: BrowserContext;
  page: Page;
  requests: RecordedRequest[];
  /** Time of the last upload done through this session. */
  uploadAt?: number;
  /** Demo project uploaded by this session. */
  project?: string;
}

let shared: Browser | null = null;

async function browser(): Promise<Browser> {
  if (!shared || !shared.isConnected()) {
    shared = await chromium.launch({ headless: process.env.DEVARCH_E2E_HEADED !== 'true' });
  }
  return shared;
}

export const byTestId = (id: string) => `[data-testid="${id}"]`;

/** Opens a new isolated session (own cookies and storage) on the web under test. */
export async function openSession(world: DevArchWorld, url: string): Promise<BrowserSession> {
  const context = await (await browser()).newContext();
  // Records every (status, phase) pair the page displays, so short phases are not missed between polls.
  // Scripts sent to the page are plain strings: functions compiled by tsx carry an esbuild `__name` helper that
  // does not exist in the browser.
  await context.addInitScript({
    content: `
      window.__statusLog = [];
      const record = () => {
        const st = document.querySelector('[data-testid="analysis-status"]')?.getAttribute('data-status') ?? '';
        const ph = document.querySelector('[data-testid="analysis-phase"]')?.getAttribute('data-phase') ?? '';
        const log = window.__statusLog;
        const last = log[log.length - 1];
        if (st && (!last || last.status !== st || last.phase !== ph)) log.push({ status: st, phase: ph });
      };
      new MutationObserver(record).observe(document, { subtree: true, childList: true, attributes: true });
    `,
  });
  const page = await context.newPage();
  const requests: RecordedRequest[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.pathname.startsWith('/api/')) requests.push({ method: r.method(), path: u.pathname, at: Date.now() });
  });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await page.locator(byTestId('upload-input')).waitFor({ state: 'attached', timeout: 180_000 });
  const session: BrowserSession = { context, page, requests };
  const sessions = ((world.data.sessions as BrowserSession[] | undefined) ??= []);
  sessions.push(session);
  world.data.sessions = sessions;
  return session;
}

export function sessions(world: DevArchWorld): BrowserSession[] {
  const s = world.data.sessions as BrowserSession[] | undefined;
  if (!s || s.length === 0) throw new Error('no browser session is open');
  return s;
}

/** Storage of the page origin (localStorage and sessionStorage) as key -> value. */
export async function statusLog(page: Page): Promise<{ status: string; phase: string }[]> {
  return page.evaluate('window.__statusLog ?? []') as Promise<{ status: string; phase: string }[]>;
}

export async function storage(page: Page): Promise<{ local: Record<string, string>; session: Record<string, string> }> {
  return page.evaluate(`(() => {
    const dump = (s) => {
      const out = {};
      for (let i = 0; i < s.length; i++) { const k = s.key(i); out[k] = s.getItem(k) ?? ''; }
      return out;
    };
    return { local: dump(window.localStorage), session: dump(window.sessionStorage) };
  })()`) as Promise<{ local: Record<string, string>; session: Record<string, string> }>;
}

After(async function (this: DevArchWorld) {
  for (const s of (this.data.sessions as BrowserSession[] | undefined) ?? []) {
    await s.context.close().catch(() => undefined);
  }
  this.data.sessions = [];
});

export async function closeBrowser(): Promise<void> {
  if (shared) await shared.close().catch(() => undefined);
  shared = null;
}

AfterAll(closeBrowser);
