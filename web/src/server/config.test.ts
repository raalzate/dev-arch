// Web configuration (007-native-engine-runtime, research D13, D15). Run: npm test -w web
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { DEFAULT_SOURCE_EXTENSIONS, loadConfig } from './config.ts';

test('defaults follow research D13', () => {
  const c = loadConfig({}, '/w');
  assert.equal(c.dataDir, path.join('/w', '.archview'));
  assert.equal(c.maxUploadBytes, 209715200);
  assert.equal(c.maxUncompressedBytes, 1073741824);
  assert.equal(c.maxZipEntries, 100000);
  assert.equal(c.maxConcurrent, 2); // TS-064 green (decision A2)
  assert.equal(c.maxQueued, 10);
  assert.equal(c.jobTtlHours, 24);
  assert.equal(c.cleanupIntervalMs, 600000);
  assert.equal(c.analysisTimeoutMs, 1800000);
  assert.equal(c.maxSourceViewBytes, 2097152);
  assert.equal(c.allowLocalPath, false);
  assert.equal(c.apiToken, null);
  assert.deepEqual(c.sourceExtensions, DEFAULT_SOURCE_EXTENSIONS);
});

test('overrides are read from the environment and relative data dirs resolve against cwd', () => {
  const c = loadConfig({ ARCHVIEW_DATA_DIR: 'data', MAX_UPLOAD_BYTES: '1048576', MAX_CONCURRENT_ANALYSES: '1',
    MAX_QUEUED_ANALYSES: '1', ARCHVIEW_JOB_TTL_HOURS: '1', ANALYSIS_TIMEOUT_MS: '2000' }, '/w');
  assert.equal(c.dataDir, '/w/data');
  assert.equal(c.maxUploadBytes, 1048576);
  assert.equal(c.maxConcurrent, 1);
  assert.equal(c.maxQueued, 1);
  assert.equal(c.jobTtlHours, 1);
  assert.equal(c.analysisTimeoutMs, 2000);
});

test('invalid values name the variable', () => {
  for (const name of ['MAX_UPLOAD_BYTES', 'MAX_CONCURRENT_ANALYSES', 'ARCHVIEW_JOB_TTL_HOURS', 'MAX_SOURCE_VIEW_BYTES']) {
    for (const bad of ['abc', '0', '-3', '1.5']) {
      assert.throws(() => loadConfig({ [name]: bad }, '/w'), (e: Error) => e.message.includes(name), `${name}=${bad}`);
    }
  }
});

test('local folder analysis only in development or when explicitly enabled', () => {
  assert.equal(loadConfig({ NODE_ENV: 'development' }, '/w').allowLocalPath, true);
  assert.equal(loadConfig({ NODE_ENV: 'production' }, '/w').allowLocalPath, false);
  assert.equal(loadConfig({ NODE_ENV: 'production', DEVARCH_ALLOW_LOCAL_PATH: 'true' }, '/w').allowLocalPath, true);
  assert.equal(loadConfig({ NODE_ENV: 'development', DEVARCH_ALLOW_LOCAL_PATH: 'false' }, '/w').allowLocalPath, false);
  assert.throws(() => loadConfig({ DEVARCH_ALLOW_LOCAL_PATH: 'yes' }, '/w'), /DEVARCH_ALLOW_LOCAL_PATH/);
});

test('a blank API token means no token', () => {
  assert.equal(loadConfig({ DEVARCH_API_TOKEN: '' }, '/w').apiToken, null);
  assert.equal(loadConfig({ DEVARCH_API_TOKEN: '   ' }, '/w').apiToken, null);
  assert.equal(loadConfig({ DEVARCH_API_TOKEN: ' s3cret ' }, '/w').apiToken, 's3cret');
});
