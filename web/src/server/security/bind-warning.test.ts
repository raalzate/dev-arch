// API exposure warning at server start (007, decision A3, FR-036). Run: npm test -w web
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exposureWarning, listenHost } from './bind-warning.ts';

test('the listening host comes from HOSTNAME, then -H/--hostname, else all interfaces', () => {
  assert.equal(listenHost({ HOSTNAME: '127.0.0.1' }, ['next', 'start', '-H', '0.0.0.0']), '127.0.0.1');
  assert.equal(listenHost({}, ['next', 'dev', '-H', 'localhost']), 'localhost');
  assert.equal(listenHost({}, ['next', 'start', '--hostname', '10.0.0.5']), '10.0.0.5');
  assert.equal(listenHost({}, ['next', 'start', '--hostname=::1']), '::1');
  assert.equal(listenHost({}, ['next', 'dev']), null);
});

test('only a non-loopback host without a token produces the prominent warning', () => {
  for (const host of [null, '0.0.0.0', '::', '192.168.1.10', 'devarch.example.com']) {
    const w = exposureWarning(host, null);
    assert.ok(w, String(host));
    assert.match(w, /dev-arch API is NOT protected/);
    assert.match(w, /DEVARCH_API_TOKEN/);
    assert.match(w, /!!!/);
  }
  for (const host of ['localhost', '127.0.0.1', '127.1.2.3', '::1', '[::1]']) assert.equal(exposureWarning(host, null), null, host);
  assert.equal(exposureWarning('0.0.0.0', 's3cret'), null);
});
