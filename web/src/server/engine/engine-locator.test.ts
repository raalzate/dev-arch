// Engine launch command in MCP server mode (007, contracts/engine-client.md, TS-072). Run: npm test -w web
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { locateEngine } from './engine-locator.ts';

const always = () => true;

test('006 resolution rules are kept and the engine starts with --mcp', () => {
  const r = locateEngine({}, '/p/web', always);
  assert.equal(r.kind, 'resolved');
  if (r.kind !== 'resolved') return;
  assert.equal(r.command, 'java');
  assert.deepEqual(r.args, ['-jar', '/p/web/engine-dist/engine.jar', '--mcp']);
  const j = locateEngine({ JAVA_HOME: '/jdk17', ENGINE_JAR_PATH: '/opt/engine.jar' }, '/p/web', always);
  assert.equal(j.kind === 'resolved' && j.command, '/jdk17/bin/java');
  assert.deepEqual(j.kind === 'resolved' && j.args, ['-jar', '/opt/engine.jar', '--mcp']);
});

test('ENGINE_JAVA_OPTS go before -jar, split on whitespace', () => {
  const r = locateEngine({ ENGINE_JAVA_OPTS: '  -Xmx2g   -Dfoo=bar ' }, '/p/web', always);
  assert.deepEqual(r.kind === 'resolved' && r.args, ['-Xmx2g', '-Dfoo=bar', '-jar', '/p/web/engine-dist/engine.jar', '--mcp']);
});

test('the engine environment inherits the server one and propagates the .NET analyzer settings', () => {
  const r = locateEngine({ PATH: '/bin', DOTNET_ANALYZER_PATH: '/opt/dotnet-analyzer', DOTNET_ROOT: '/dn', JAVA_HOME: '/jdk' }, '/p/web', always);
  assert.equal(r.kind, 'resolved');
  if (r.kind !== 'resolved') return;
  assert.equal(r.env.PATH, '/bin');
  assert.equal(r.env.DOTNET_ANALYZER_PATH, '/opt/dotnet-analyzer');
  assert.equal(r.env.DOTNET_ROOT, '/dn');
  assert.equal(r.env.JAVA_HOME, '/jdk');
});

test('a missing engine keeps the 006 message', () => {
  const r = locateEngine({}, '/p/web', () => false);
  assert.equal(r.kind, 'not-built');
  assert.match(r.kind === 'not-built' ? r.message : '', /Engine not built: \/p\/web\/engine-dist\/engine\.jar .*make build/);
});
