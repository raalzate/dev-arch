// GET/POST /api/analyses — history and asynchronous submissions, with the stub engine (007 contracts/analyses-api.md;
// 010 FR-036). Run: node scripts/run-tests.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { GET, POST } from './route.ts';
import { jsonRequest, setupRouteEnv, waitTerminal, type RouteEnv } from '../../../server/testing/route-harness.test.ts';

let env: RouteEnv;
before(async () => {
  env = await setupRouteEnv();
});
after(async () => {
  await env.restore();
});

function projectZip(): Buffer {
  const zip = new AdmZip();
  zip.addFile('demo/pom.xml', Buffer.from('<project/>'));
  zip.addFile('demo/src/main/java/a/A.java', Buffer.from('package a; class A {}'));
  return zip.toBuffer();
}

const zipRequest = (body: BodyInit, query = '', headers: Record<string, string> = {}) =>
  new Request(`http://localhost/api/analyses${query}`, { method: 'POST', headers: { 'content-type': 'application/zip', ...headers }, body });
const jobDirs = () => (existsSync(path.join(env.dataDir, 'jobs')) ? readdirSync(path.join(env.dataDir, 'jobs')) : []);

test('a ZIP body is registered (202 with Location) and analyzed in the background until completed', async () => {
  const res = await POST(zipRequest(new Uint8Array(projectZip()), '?language=java'));
  assert.equal(res.status, 202, await res.clone().text());
  const { jobId, status } = await res.json();
  assert.ok(['queued', 'running'].includes(status));
  assert.equal(res.headers.get('location'), `/api/analyses/${jobId}`);
  const job = await waitTerminal(env.rt(), jobId);
  assert.equal(job.status, 'completed', JSON.stringify(job.error));
  assert.equal(job.language, 'java');
  assert.equal(job.origin, 'zip');
  assert.equal(job.summary?.componentCount, 27);
  assert.ok(job.uploadBytes && job.uploadBytes > 0);
});

test('a multipart form with the ZIP in "file" is accepted with 202', async () => {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(projectZip())]), 'project.zip');
  const res = await POST(new Request('http://localhost/api/analyses', { method: 'POST', body: form }));
  assert.equal(res.status, 202, await res.clone().text());
  const job = await waitTerminal(env.rt(), (await res.json()).jobId);
  assert.equal(job.status, 'completed', JSON.stringify(job.error));
});

test('a multipart form without "file" answers 400 INVALID_ZIP and leaves no analysis behind', async () => {
  const before = jobDirs().length;
  const form = new FormData();
  form.append('other', 'x');
  const res = await POST(new Request('http://localhost/api/analyses', { method: 'POST', body: form }));
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, 'INVALID_ZIP');
  assert.equal(jobDirs().length, before);
});

test('a body that is not a ZIP answers 400 INVALID_ZIP and is logged as a security rejection', async () => {
  const before = jobDirs().length;
  const res = await POST(zipRequest('definitely not a zip'));
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, 'INVALID_ZIP');
  assert.equal(jobDirs().length, before);
  assert.ok(env.logs.some((l) => l.startsWith('[security] upload rejected: INVALID_ZIP')), env.logs.join('\n'));
});

test('an upload above MAX_UPLOAD_BYTES answers 413 UPLOAD_TOO_LARGE', async () => {
  const rt = env.rt();
  const saved = rt.config.maxUploadBytes;
  rt.config.maxUploadBytes = 10;
  try {
    const res = await POST(zipRequest(new Uint8Array(projectZip())));
    assert.equal(res.status, 413);
    const body = await res.json();
    assert.equal(body.error.code, 'UPLOAD_TOO_LARGE');
    assert.equal(body.error.limitBytes, 10);
  } finally {
    rt.config.maxUploadBytes = saved;
  }
});

test('an unknown language answers 400 INVALID_LANGUAGE', async () => {
  const res = await POST(zipRequest(new Uint8Array(projectZip()), '?language=cobol'));
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, 'INVALID_LANGUAGE');
  assert.equal(body.error.message, "Invalid language 'cobol'. Allowed: java, dotnet, auto");
});

test('JSON submissions: invalid JSON and a missing localPath answer 400', async () => {
  const bad = await POST(jsonRequest('http://localhost/api/analyses', '{oops'));
  assert.equal(bad.status, 400);
  assert.equal((await bad.json()).error.message, 'The JSON body is not valid.');
  const missing = await POST(jsonRequest('http://localhost/api/analyses', { language: 'java' }));
  assert.equal(missing.status, 400);
  assert.equal((await missing.json()).error.message, 'A JSON submission must contain "localPath".');
});

test('a local folder is refused with 403 LOCAL_PATH_DISABLED unless enabled', async () => {
  const res = await POST(jsonRequest('http://localhost/api/analyses', { localPath: env.dir }));
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error.code, 'LOCAL_PATH_DISABLED');
});

test('with local folders enabled, a non-directory answers 400 and a folder is analyzed (202)', async () => {
  const rt = env.rt();
  rt.config.allowLocalPath = true;
  try {
    for (const localPath of ['relative/dir', path.join(env.dir, 'missing'), env.controlFile]) {
      const res = await POST(jsonRequest('http://localhost/api/analyses', { localPath }));
      assert.equal(res.status, 400, localPath);
      assert.equal((await res.json()).error.code, 'LOCAL_PATH_NOT_DIRECTORY');
    }
    const project = path.join(env.dir, 'local-project');
    mkdirSync(project);
    const res = await POST(jsonRequest('http://localhost/api/analyses', { localPath: project, language: 'dotnet' }));
    assert.equal(res.status, 202, await res.clone().text());
    const job = await waitTerminal(rt, (await res.json()).jobId);
    assert.equal(job.origin, 'localPath');
    assert.equal(job.language, 'dotnet');
    assert.equal(job.projectRoot, project);
    assert.equal(job.status, 'completed', JSON.stringify(job.error));
  } finally {
    rt.config.allowLocalPath = false;
  }
});

test('when the quota of running and queued analyses is full the submission answers 429 with Retry-After', async () => {
  const rt = env.rt();
  let taken = 0;
  while (rt.runner.reserve()) taken++;
  try {
    const res = await POST(zipRequest(new Uint8Array(projectZip())));
    assert.equal(res.status, 429);
    assert.equal(res.headers.get('retry-after'), '30');
    assert.equal((await res.json()).error.code, 'TOO_MANY_ANALYSES');
  } finally {
    for (let i = 0; i < taken; i++) rt.runner.release();
  }
});

test('GET lists the analyses newest first with their detected technology (200)', async () => {
  const { job } = await env.completedJob();
  const res = await GET(new Request('http://localhost/api/analyses'));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const { analyses } = await res.json();
  assert.ok(analyses.length >= 4);
  assert.equal(analyses[0].jobId, job.id);
  assert.equal(analyses[0].technology, 'java');
  const times = analyses.map((a: { createdAt: string }) => a.createdAt);
  assert.deepEqual(times, [...times].sort().reverse());
});

test('with an API token configured GET and POST answer 401 without it', async () => {
  const rt = env.rt();
  rt.config.apiToken = 'tok';
  try {
    const get = await GET(new Request('http://localhost/api/analyses'));
    assert.equal(get.status, 401);
    const post = await POST(zipRequest(new Uint8Array(projectZip())));
    assert.equal(post.status, 401);
    const ok = await GET(new Request('http://localhost/api/analyses', { headers: { authorization: 'Bearer tok' } }));
    assert.equal(ok.status, 200);
  } finally {
    rt.config.apiToken = null;
  }
});
