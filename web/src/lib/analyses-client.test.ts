// Browser client of the analyses API (007 FR-007, FR-035; 010 contracts/web-api.md) against a stubbed fetch and
// stubbed browser storages.
import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVE_JOB_KEY, API_TOKEN_KEY, ApiAuthError, ApiRequestError, getActiveJobId, getApiToken, getContracts, getDocuments,
  getInferenceDefaults, getSource, getStatus, importResults, isTerminal, listAnalyses, PHASE_LABELS, pollAnalysis,
  reinfer, scoreProposal, setActiveJobId, setApiToken, STATUS_LABELS, submitAnalysis, type AnalysisStatus,
} from './analyses-client.ts';

class MemoryStorage {
  readonly map = new Map<string, string>();
  getItem(k: string) {
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, String(v));
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

type Call = { url: string; init: RequestInit };
let calls: Call[];
let replies: (Response | ((url: string) => Response))[];
let local: MemoryStorage;
let session: MemoryStorage;
const realFetch = globalThis.fetch;

function installWindow(value: unknown) {
  Object.defineProperty(globalThis, 'window', { value, configurable: true, writable: true });
}

beforeEach(() => {
  calls = [];
  replies = [];
  local = new MemoryStorage();
  session = new MemoryStorage();
  installWindow({ localStorage: local, sessionStorage: session });
  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init });
    const next = replies.shift();
    if (!next) throw new Error(`unexpected fetch ${url}`);
    return typeof next === 'function' ? next(url) : next;
  }) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
  delete (globalThis as { window?: unknown }).window;
  mock.timers.reset();
});

const json = (body: unknown, status = 200) => Response.json(body, { status });
const headersOf = (c: Call) => c.init.headers as Record<string, string>;
const status = (s: AnalysisStatus['status']): AnalysisStatus => ({
  jobId: 'j1', origin: 'zip', language: 'auto', status: s, phase: null, createdAt: '2030-01-01T00:00:00Z', startedAt: null,
  finishedAt: null, error: null, warnings: [], summary: null, projectRoot: '.', hasSources: true,
});

test('the API token lives in sessionStorage (trimmed) and the active analysis in localStorage', () => {
  assert.equal(getApiToken(), null);
  setApiToken('  abc  ');
  assert.equal(session.getItem(API_TOKEN_KEY), 'abc');
  assert.equal(getApiToken(), 'abc');
  assert.equal(getActiveJobId(), null);
  setActiveJobId('j1');
  assert.equal(local.getItem(ACTIVE_JOB_KEY), 'j1');
  assert.equal(getActiveJobId(), 'j1');
  setActiveJobId(null);
  assert.equal(local.map.has(ACTIVE_JOB_KEY), false);
});

test('without browser storage (server rendering, blocked storage) the helpers degrade to null and no-ops', () => {
  delete (globalThis as { window?: unknown }).window;
  assert.equal(getApiToken(), null);
  assert.equal(getActiveJobId(), null);
  assert.doesNotThrow(() => setApiToken('x'));
  assert.doesNotThrow(() => setActiveJobId('j'));
  installWindow({
    get localStorage(): Storage {
      throw new Error('SecurityError');
    },
    get sessionStorage(): Storage {
      throw new Error('SecurityError');
    },
  });
  assert.equal(getApiToken(), null);
  setActiveJobId('j');
  assert.equal(getActiveJobId(), null);
});

test('submitAnalysis posts the ZIP as the body with its language, no-store and the bearer token (success)', async () => {
  setApiToken('tok');
  replies.push(json({ jobId: 'j1', status: 'queued' }, 202));
  const zip = new Blob(['PK']);
  assert.deepEqual(await submitAnalysis(zip, 'dotnet'), { jobId: 'j1', status: 'queued' });
  assert.equal(calls[0].url, '/api/analyses?language=dotnet');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.body, zip);
  assert.equal(calls[0].init.cache, 'no-store');
  assert.deepEqual(headersOf(calls[0]), { 'Content-Type': 'application/zip', Authorization: 'Bearer tok' });
});

test('without a token no Authorization header is sent', async () => {
  replies.push(json(status('running')));
  const s = await getStatus('a/b');
  assert.equal(s.status, 'running');
  assert.equal(calls[0].url, '/api/analyses/a%2Fb');
  assert.deepEqual(headersOf(calls[0]), {});
});

test('a 401 answer raises ApiAuthError', async () => {
  replies.push(json({ error: { code: 'UNAUTHORIZED', message: 'x' } }, 401));
  await assert.rejects(getStatus('j1'), (e: unknown) => e instanceof ApiAuthError && e.message === 'Se requiere un token de acceso a la API.');
});

test('other API errors raise ApiRequestError with the status, code, message and extra fields', async () => {
  replies.push(json({ error: { code: 'NOT_READY', message: 'Not yet', status: 'running', phase: 'inference' } }, 409));
  await assert.rejects(getStatus('j1'), (e: unknown) => {
    assert.ok(e instanceof ApiRequestError);
    assert.equal(e.status, 409);
    assert.equal(e.code, 'NOT_READY');
    assert.equal(e.message, 'Not yet');
    assert.deepEqual(e.details, { status: 'running', phase: 'inference' });
    return true;
  });
});

test('an error answer that is not JSON uses HTTP_<status> and the status text', async () => {
  replies.push(new Response('<html>bad gateway</html>', { status: 502, statusText: 'Bad Gateway' }));
  await assert.rejects(getStatus('j1'), (e: unknown) => e instanceof ApiRequestError && e.code === 'HTTP_502' && e.message === 'Bad Gateway');
});

test('getDocuments fetches the graph and the architecture of the analysis', async () => {
  replies.push((url) => json({ doc: url.endsWith('/graph') ? 'graph' : 'architecture' }));
  replies.push((url) => json({ doc: url.endsWith('/graph') ? 'graph' : 'architecture' }));
  const docs = await getDocuments('j 1');
  assert.deepEqual(docs, { graph: { doc: 'graph' }, architecture: { doc: 'architecture' } });
  assert.deepEqual(calls.map((c) => c.url).sort(), ['/api/analyses/j%201/architecture', '/api/analyses/j%201/graph']);
});

test('getContracts returns the endpoints document, null on 404 and rethrows other errors', async () => {
  replies.push(json({ endpoints: [{ path: '/x' }] }));
  assert.deepEqual(await getContracts('j1'), { endpoints: [{ path: '/x' }] });
  assert.equal(calls[0].url, '/api/analyses/j1/contracts');
  replies.push(json({ error: { code: 'NOT_FOUND', message: 'gone' } }, 404));
  assert.equal(await getContracts('j1'), null);
  replies.push(json({ error: { code: 'NOT_READY', message: 'wait' } }, 409));
  await assert.rejects(getContracts('j1'), (e: unknown) => e instanceof ApiRequestError && e.status === 409);
});

test('listAnalyses unwraps the history and getInferenceDefaults returns the panel parameters', async () => {
  replies.push(json({ analyses: [{ jobId: 'a' }, { jobId: 'b' }] }));
  assert.deepEqual((await listAnalyses()).map((a) => a.jobId), ['a', 'b']);
  replies.push(json({ parameters: [{ path: 'p' }], defaults: { k: 1 } }));
  const d = await getInferenceDefaults();
  assert.deepEqual(d.defaults, { k: 1 });
  assert.deepEqual(calls.map((c) => c.url), ['/api/analyses', '/api/inference/defaults']);
});

test('reinfer and scoreProposal post JSON bodies (reinfer forwards the abort signal)', async () => {
  const controller = new AbortController();
  replies.push(json({ proposals: [] }));
  assert.deepEqual(await reinfer('j1', { minViability: 'Alta' }, controller.signal), { proposals: [] });
  assert.equal(calls[0].url, '/api/analyses/j1/reinfer');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.body, '{"minViability":"Alta"}');
  assert.equal(calls[0].init.signal, controller.signal);
  assert.deepEqual(headersOf(calls[0]), { 'Content-Type': 'application/json' });
  replies.push(json({ name: 'p', score: 0.5 }));
  assert.equal((await scoreProposal('j1', { components: ['a.A'] })).score, 0.5);
  assert.equal(calls[1].url, '/api/analyses/j1/score');
  assert.equal(calls[1].init.body, '{"components":["a.A"]}');
});

test('getSource encodes the analysis and the path, importResults posts the documents', async () => {
  replies.push(json({ path: 'src/a b.java', content: 'x' }));
  assert.equal((await getSource('j1', 'src/a b.java')).content, 'x');
  assert.equal(calls[0].url, '/api/source?jobId=j1&path=src%2Fa%20b.java');
  replies.push(json({ jobId: 'imp', status: 'completed' }, 201));
  assert.deepEqual(await importResults({ graph: { g: 1 }, architecture: { a: 1 } }), { jobId: 'imp', status: 'completed' });
  assert.equal(calls[1].url, '/api/analyses/import');
  assert.equal(calls[1].init.body, '{"graph":{"g":1},"architecture":{"a":1}}');
});

test('isTerminal and the Spanish labels', () => {
  assert.equal(isTerminal('completed'), true);
  assert.equal(isTerminal('failed'), true);
  assert.equal(isTerminal('queued'), false);
  assert.equal(isTerminal('running'), false);
  assert.equal(PHASE_LABELS.inference, 'inferencia');
  assert.equal(STATUS_LABELS.failed, 'fallido');
});

const flush = async () => {
  for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));
};

test('pollAnalysis reports every status until the analysis ends (success)', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  replies.push(json(status('queued')), json(status('running')), json(status('completed')));
  const seen: string[] = [];
  const done = pollAnalysis('j1', (s) => seen.push(s.status), new AbortController().signal);
  await flush();
  mock.timers.tick(500);
  await flush();
  mock.timers.tick(500);
  const final = await done;
  assert.equal(final?.status, 'completed');
  assert.deepEqual(seen, ['queued', 'running', 'completed']);
  assert.equal(calls.length, 3);
});

test('pollAnalysis retries after a transient error with a 2 s pause', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  replies.push(json({ error: { code: 'IO_ERROR', message: 'x' } }, 500), json(status('failed')));
  const done = pollAnalysis('j1', () => undefined, new AbortController().signal);
  await flush();
  assert.equal(calls.length, 1);
  mock.timers.tick(1999);
  await flush();
  assert.equal(calls.length, 1, 'still waiting');
  mock.timers.tick(1);
  assert.equal((await done)?.status, 'failed');
});

test('pollAnalysis stops on 401 and 404 and returns null when aborted', async () => {
  replies.push(json({}, 401));
  await assert.rejects(pollAnalysis('j1', () => undefined, new AbortController().signal), ApiAuthError);
  replies.push(json({ error: { code: 'NOT_FOUND', message: 'gone' } }, 404));
  await assert.rejects(pollAnalysis('j1', () => undefined, new AbortController().signal), (e: unknown) => e instanceof ApiRequestError && e.status === 404);
  const aborted = new AbortController();
  aborted.abort();
  assert.equal(await pollAnalysis('j1', () => undefined, aborted.signal), null);
  const late = new AbortController();
  const seen: unknown[] = [];
  replies.push(() => {
    late.abort();
    return json(status('running'));
  });
  assert.equal(await pollAnalysis('j1', (s) => seen.push(s), late.signal), null);
  assert.deepEqual(seen, [], 'no update after the abort');
});
