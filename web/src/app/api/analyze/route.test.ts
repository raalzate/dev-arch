// POST /api/analyze — deprecated synchronous analysis (006/007 FR-033): success with the stub engine in CLI mode,
// validation, engine failures and the API token. See also src/server/engine/analyze-route.test.ts.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { POST } from './route.ts';
import { setupRouteEnv, type RouteEnv } from '../../../server/testing/route-harness.test.ts';

let env: RouteEnv;
before(async () => {
  env = await setupRouteEnv();
});
after(async () => {
  await env.restore();
});

function zipForm(entries: Record<string, string> = { 'demo/pom.xml': '<project/>' }): FormData {
  const zip = new AdmZip();
  for (const [name, content] of Object.entries(entries)) zip.addFile(name, Buffer.from(content));
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(zip.toBuffer())]), 'project.zip');
  return form;
}
const post = (form: FormData, headers: Record<string, string> = {}) =>
  POST(new Request('http://localhost/api/analyze', { method: 'POST', body: form, headers }));

/** A JDK whose java runs `script` (sh) instead of the engine. */
function jdkRunning(name: string, script: string): string {
  const jdk = path.join(env.dir, name);
  mkdirSync(path.join(jdk, 'bin'), { recursive: true });
  writeFileSync(path.join(jdk, 'bin', 'java'), `#!/bin/sh\n${script}\n`);
  chmodSync(path.join(jdk, 'bin', 'java'), 0o755);
  return jdk;
}

async function withJavaHome<T>(jdk: string, fn: () => Promise<T>): Promise<T> {
  const saved = process.env.JAVA_HOME;
  process.env.JAVA_HOME = jdk;
  try {
    return await fn();
  } finally {
    process.env.JAVA_HOME = saved;
  }
}

const statuses = async () => {
  const store = env.rt().store;
  return (await store.list()).map((j) => j.status);
};

test('a valid ZIP is analyzed synchronously: 200 with both documents and the deprecation headers', async () => {
  const res = await post(zipForm({ 'demo/pom.xml': '<project/>', 'demo/src/main/java/a/A.java': 'class A {}' }));
  assert.equal(res.status, 200, await res.clone().text());
  assert.equal(res.headers.get('deprecation'), 'true');
  assert.equal(res.headers.get('link'), '</api/analyses>; rel="successor-version"');
  const body = await res.json();
  assert.equal(body.componentsData.components.length, 27);
  assert.ok(Array.isArray(body.archData.proposals));
  const jobs = await env.rt().store.list();
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].origin, 'sync');
  assert.equal(jobs[0].status, 'completed');
  assert.equal(path.basename(jobs[0].projectRoot ?? ''), 'demo');
});

test('a form without a file answers 400 "No file provided"', async () => {
  const form = new FormData();
  form.append('other', 'x');
  const res = await post(form);
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: 'No file provided' });
});

test('an upload that is not a ZIP is rejected with 400 and its analysis area is removed', async () => {
  const before = readdirSync(path.join(env.dataDir, 'jobs')).length;
  const form = new FormData();
  form.append('file', new Blob(['this is not a zip archive']), 'project.zip');
  const res = await post(form);
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: 'The upload is not a valid ZIP archive.' });
  assert.equal(readdirSync(path.join(env.dataDir, 'jobs')).length, before);
  assert.ok(env.logs.some((l) => l.includes('[security] synchronous upload rejected: INVALID_ZIP')), env.logs.join('\n'));
});

test('an engine that exits with an error answers 500 and the analysis is recorded as failed', async () => {
  const jdk = jdkRunning('failing-jdk', 'echo boom >&2\nexit 7');
  const res = await withJavaHome(jdk, () => post(zipForm()));
  assert.equal(res.status, 500);
  assert.match((await res.json()).error, /^Failed to analyze the project with the Java tool\.\n\nDetails:\n/);
  assert.ok((await statuses()).includes('failed'));
});

test('an engine that writes no result files answers 500 explaining the results could not be read', async () => {
  const jdk = jdkRunning('silent-jdk', 'exit 0');
  const res = await withJavaHome(jdk, () => post(zipForm()));
  assert.equal(res.status, 500);
  assert.equal((await res.json()).error, 'Analysis completed, but failed to read result files. Check server logs for output file path.');
});

test('with an API token configured the request needs it (401)', async () => {
  process.env.DEVARCH_API_TOKEN = 'tok';
  try {
    const res = await post(zipForm());
    assert.equal(res.status, 401);
  } finally {
    delete process.env.DEVARCH_API_TOKEN;
  }
});
