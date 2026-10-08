// POST /api/analyze with the local engine (006-devarch-monorepo, TS-015, TS-018). Run: npm test -w web
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { POST } from '../../app/api/analyze/route.ts';

function zipRequest(rootDir: string): Request {
  const zip = new AdmZip();
  zip.addFile(`${rootDir}/pom.xml`, Buffer.from('<project/>'));
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(zip.toBuffer())]), 'project.zip');
  return new Request('http://localhost/api/analyze', { method: 'POST', body: form });
}

async function withWebDir<T>(env: Record<string, string | undefined>, fn: (dir: string) => Promise<T>): Promise<T> {
  // realpath: process.cwd() reports the resolved directory after chdir (macOS /var -> /private/var).
  const dir = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'devarch-web-')));
  const previousCwd = process.cwd();
  const previousEnv = { ...process.env };
  try {
    process.chdir(dir);
    for (const [k, v] of Object.entries(env)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    return await fn(dir);
  } finally {
    process.chdir(previousCwd);
    process.env = previousEnv;
  }
}

test('without a built engine the route answers 500 explaining how to build it', async () => {
  await withWebDir({ ENGINE_JAR_PATH: undefined }, async (dir) => {
    const res = await POST(zipRequest('demo') as never);
    assert.equal(res.status, 500);
    const body = await res.json();
    assert.match(body.error, /Engine not built/);
    assert.ok(body.error.includes(path.join(dir, 'engine-dist', 'engine.jar')), body.error);
    assert.match(body.error, /make build/);
  });
});

test('the project path with spaces reaches the engine as one argument, without a shell', async () => {
  const jdk = mkdtempSync(path.join(os.tmpdir(), 'devarch-fake-jdk-'));
  const argsFile = path.join(jdk, 'args.json');
  const java = path.join(jdk, 'bin', 'java');
  mkdirSync(path.dirname(java));
  writeFileSync(
    java,
    `#!/usr/bin/env node\nconst fs = require('fs');\nfs.writeFileSync(${JSON.stringify(argsFile)}, JSON.stringify(process.argv.slice(2)));\n` +
      `fs.writeFileSync('output.json', JSON.stringify({ components: [], edges: [], meta: { schema_version: '1.0.0' } }));\n` +
      `fs.writeFileSync('output_architecture.json', JSON.stringify({ proposals: [] }));\n`,
  );
  chmodSync(java, 0o755);
  await withWebDir({ JAVA_HOME: jdk, ENGINE_JAR_PATH: undefined }, async (dir) => {
    mkdirSync(path.join(dir, 'engine-dist'));
    writeFileSync(path.join(dir, 'engine-dist', 'engine.jar'), 'fake');
    const res = await POST(zipRequest('my demo project') as never);
    assert.equal(res.status, 200, JSON.stringify(await res.clone().json()));
    const args = JSON.parse(readFileSync(argsFile, 'utf8')) as string[];
    assert.equal(args.length, 4, JSON.stringify(args));
    assert.equal(args[0], '-jar');
    assert.equal(args[1], path.join(dir, 'engine-dist', 'engine.jar'));
    assert.equal(path.basename(args[2]), 'my demo project');
    assert.equal(args[3], 'output.json');
    const body = await res.json();
    assert.equal(body.componentsData.meta.schema_version, '1.0.0');
  });
});
