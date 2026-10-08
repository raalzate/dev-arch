// Import of existing results validated against the contract (007, research D10; FR-020, FR-021, SC-010).
// Run: npm test -w web
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApiError } from '../api-error.ts';
import { validateImport } from './import-validator.ts';

const fixtures = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../schema/fixtures');
const read = (...p: string[]) => JSON.parse(readFileSync(path.join(fixtures, ...p), 'utf8'));
const valid = (name: string) => ({
  graph: read('valid', name, 'output.json'),
  architecture: read('valid', name, 'output_architecture.json'),
  entrypoints: read('valid', name, 'output_entrypoints.json'),
});

function fails(body: unknown, status: number, code: string): ApiError {
  try {
    validateImport(body);
  } catch (e) {
    assert.ok(e instanceof ApiError, String(e));
    assert.equal(e.status, status, JSON.stringify(e.extra));
    assert.equal(e.code, code);
    return e;
  }
  assert.fail('the import was accepted');
}

test('valid contract outputs are accepted with and without entrypoints', () => {
  for (const name of ['java-standar', 'dotnet-ecommerce']) {
    const body = valid(name);
    assert.deepEqual(validateImport(body), body);
    const { entrypoints: _e, ...noEntrypoints } = body;
    assert.deepEqual(validateImport(noEntrypoints), { ...noEntrypoints, entrypoints: undefined });
  }
});

test('every invalid fixture is rejected naming its document, field pointer and reason', () => {
  for (const file of readdirSync(path.join(fixtures, 'invalid'))) {
    const slot = file.startsWith('graph-') ? 'graph' : 'architecture';
    const body = { ...valid('java-standar'), [slot]: read('invalid', file) };
    const e = fails(body, 422, 'SCHEMA_VIOLATION');
    const violations = e.extra.violations as { document: string; pointer: string; message: string }[];
    assert.ok(violations.length >= 1, file);
    for (const v of violations) {
      assert.equal(v.document, slot, file);
      assert.match(v.pointer, /^\//, file);
      assert.ok(v.message.length > 0, file);
    }
  }
});

test('a different contract version reports found and supported; a missing one is a violation', () => {
  const body = valid('java-standar');
  body.graph.meta.schema_version = '2.0.0';
  const e = fails(body, 422, 'UNSUPPORTED_SCHEMA_VERSION');
  assert.deepEqual([e.extra.document, e.extra.found, e.extra.supported], ['graph', '2.0.0', '1.0.0']);
  const missing = valid('java-standar');
  delete missing.graph.meta.schema_version;
  fails(missing, 422, 'SCHEMA_VIOLATION');
});

test('graph and architecture are mandatory', () => {
  for (const doc of ['graph', 'architecture'] as const) {
    const body: Record<string, unknown> = valid('java-standar');
    delete body[doc];
    assert.equal(fails(body, 400, 'MISSING_DOCUMENT').extra.document, doc);
  }
  fails([], 400, 'INVALID_REQUEST');
});
