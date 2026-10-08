// Engine resolution of the web (006-devarch-monorepo, contracts/engine-resolution.md). Run: npm test -w web
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngineCommand, resolveEngine } from './engine-path.ts';

const always = () => true;
const never = () => false;

test('default: <cwd>/engine-dist/engine.jar with java from the PATH', () => {
  const r = resolveEngine({}, '/p/web', always);
  assert.deepEqual(r, { kind: 'resolved', javaBin: 'java', jarPath: '/p/web/engine-dist/engine.jar' });
});

test('JAVA_HOME selects its bin/java', () => {
  const r = resolveEngine({ JAVA_HOME: '/jdk17' }, '/p/web', always);
  assert.equal(r.kind, 'resolved');
  assert.equal(r.kind === 'resolved' && r.javaBin, '/jdk17/bin/java');
});

test('ENGINE_JAR_PATH overrides the default (absolute)', () => {
  const r = resolveEngine({ ENGINE_JAR_PATH: '/x/e.jar' }, '/p/web', always);
  assert.equal(r.jarPath, '/x/e.jar');
});

test('ENGINE_JAR_PATH relative to the web working directory', () => {
  const r = resolveEngine({ ENGINE_JAR_PATH: '../engine/target/java-dependency-extractor.jar' }, '/p/web', always);
  assert.equal(r.jarPath, '/p/engine/target/java-dependency-extractor.jar');
});

test('an empty ENGINE_JAR_PATH falls back to the default', () => {
  const r = resolveEngine({ ENGINE_JAR_PATH: '' }, '/p/web', always);
  assert.equal(r.jarPath, '/p/web/engine-dist/engine.jar');
});

test('missing archive: not-built with the tried path and the command to run', () => {
  const r = resolveEngine({}, '/p/web', never);
  assert.equal(r.kind, 'not-built');
  assert.equal(r.jarPath, '/p/web/engine-dist/engine.jar');
  assert.ok(r.kind === 'not-built' && r.message.includes('Engine not built'));
  assert.ok(r.kind === 'not-built' && r.message.includes('/p/web/engine-dist/engine.jar'));
  assert.ok(r.kind === 'not-built' && r.message.includes('make build'));
});

test('the existence check receives the resolved archive path', () => {
  const seen: string[] = [];
  resolveEngine({ ENGINE_JAR_PATH: 'e.jar' }, '/p/web', (p) => (seen.push(p), true));
  assert.deepEqual(seen, ['/p/web/e.jar']);
});

test('command: java -jar <jar> <project> output.json without a shell, paths with spaces kept intact', () => {
  const cmd = buildEngineCommand({ javaBin: '/jdk 17/bin/java', jarPath: '/my engine/e.jar' }, '/tmp/x/my project');
  assert.deepEqual(cmd, { file: '/jdk 17/bin/java', args: ['-jar', '/my engine/e.jar', '/tmp/x/my project', 'output.json'] });
});

test('command: custom output file', () => {
  const cmd = buildEngineCommand({ javaBin: 'java', jarPath: 'e.jar' }, '/p', 'graph.json');
  assert.deepEqual(cmd.args, ['-jar', 'e.jar', '/p', 'graph.json']);
});
