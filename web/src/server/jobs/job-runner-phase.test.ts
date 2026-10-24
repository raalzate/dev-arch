// BUG-014 (014-standalone-repo): a running analysis is in its first phase as soon as the engine process is up. The page polls every
// 500 ms; with a fast engine the first progress notification can arrive after the analysis ends, so the page
// never showed a running phase (007 browser scenario, flaky on fast runners).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import AdmZip from 'adm-zip';
import { POST } from '../../app/api/analyses/route.ts';
import { setupRouteEnv, waitTerminal } from '../testing/route-harness.test.ts';

function projectZip(): Buffer {
  const zip = new AdmZip();
  zip.addFile('demo/pom.xml', Buffer.from('<project/>'));
  zip.addFile('demo/src/main/java/a/A.java', Buffer.from('package a; class A {}'));
  return zip.toBuffer();
}

test('a running analysis reports the detection phase before any engine progress', async () => {
  const env = await setupRouteEnv({ control: { phases: false, delayMs: 1500 } });
  try {
    const res = await POST(new Request('http://127.0.0.1:9002/api/analyses', {
      method: 'POST', headers: { 'content-type': 'application/zip' }, body: new Uint8Array(projectZip()),
    }));
    assert.equal(res.status, 202);
    const { jobId } = (await res.json()) as { jobId: string };
    const deadline = Date.now() + 10_000;
    let seen: string | null = null;
    while (Date.now() < deadline && !seen) {
      const job = await env.rt().store.get(jobId);
      if (job?.status === 'running' && job.phase) seen = job.phase;
      if (job?.status === 'completed' || job?.status === 'failed') break;
      await new Promise((r) => setTimeout(r, 50));
    }
    assert.equal(seen, 'detection');
    await waitTerminal(env.rt(), jobId);
  } finally {
    await env.restore();
  }
});
