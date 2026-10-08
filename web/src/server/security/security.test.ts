// API exposure (007, decision A3; FR-034, FR-035). Run: npm test -w web
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkApiToken } from './api-token.ts';
import { redactDocument, redactText } from './path-redaction.ts';

const req = (auth?: string) => new Request('http://x/api/analyses', { headers: auth ? { authorization: auth } : {} });

test('without a configured token every request passes', () => {
  assert.equal(checkApiToken(req(), null), null);
  assert.equal(checkApiToken(req('Bearer anything'), null), null);
});

test('with a token, missing, malformed or wrong credentials get the same 401', async () => {
  const bodies = new Set<string>();
  for (const auth of [undefined, 's3cret', 'Basic s3cret', 'Bearer wrong', 'Bearer s3cret2', 'Bearer ']) {
    const res = checkApiToken(req(auth), 's3cret');
    assert.ok(res, String(auth));
    assert.equal(res.status, 401);
    assert.equal(res.headers.get('www-authenticate'), 'Bearer realm="dev-arch"');
    const body = await res.json();
    assert.equal(body.error.code, 'UNAUTHORIZED');
    bodies.add(JSON.stringify(body));
  }
  assert.equal(bodies.size, 1);
  assert.equal(checkApiToken(req('Bearer s3cret'), 's3cret'), null);
  assert.equal(checkApiToken(req('bearer   s3cret'), 's3cret'), null);
});

test('documents lose the project root prefix and keep their bytes otherwise', () => {
  const root = '/data/jobs/1/source/demo';
  const doc = `{\n  "files" : [ "${root}/src/App.java", "${root}/pom.xml" ],\n  "root" : "${root}",\n  "other" : "${root}x/y"\n}`;
  const out = redactDocument(doc, [root]);
  assert.equal(out, `{\n  "files" : [ "src/App.java", "pom.xml" ],\n  "root" : ".",\n  "other" : "${root}x/y"\n}`);
  const quoted = '/data/my "odd" dir';
  assert.equal(redactDocument(JSON.stringify({ f: `${quoted}/a.java` }), [quoted]), '{"f":"a.java"}');
});

test('the realpath variant and the data directory are relativized in texts', () => {
  const t = 'Skipped /private/var/d/jobs/1/source/demo/src/Broken.java: parse error (see /var/d/jobs/1/engine.log)';
  assert.equal(redactText(t, ['/var/d/jobs/1/source/demo', '/private/var/d/jobs/1/source/demo'], ['/var/d', '/private/var/d']),
    'Skipped src/Broken.java: parse error (see <data>/jobs/1/engine.log)');
});
