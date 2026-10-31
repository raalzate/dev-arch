// Cucumber-JS configuration for the acceptance scenarios of 006-devarch-monorepo (research D9) and
// 007-native-engine-runtime (research D12), 010-modernization-ux, 011-quality-delivery, 012-install-doctor-docker, 013-agent-mcp-bridge and 014-standalone-repo.
// - @slow (built product, running web, real engine) only with DEVARCH_E2E=true, mirroring SCHEMA_CHECK_E2E of 005.
// - @e2e (Playwright browser) only with DEVARCH_E2E_BROWSER=true (`make test-e2e-browser`).
// - @engine scenarios of 007 run on Cucumber-JVM (engine RunNativeEngineRuntimeFeaturesTest), never here.
// - ACCEPTANCE_FEATURES (e.g. "006,007") keeps only the features of those numbers: the CI shards the acceptance job
//   with it so every shard fits the 20-minute area-job limit (014 BUG-011).
const e2e = process.env.DEVARCH_E2E === 'true';
const browser = process.env.DEVARCH_E2E_BROWSER === 'true';

const tags = ['not @engine'];
if (!e2e) tags.push('not @slow');
if (!browser) tags.push('not @e2e');

const PATHS = [
  'specs/006-devarch-monorepo/tests/features/**/*.feature',
  'specs/007-native-engine-runtime/tests/features/**/*.feature',
  'specs/010-modernization-ux/tests/features/**/*.feature',
  'specs/011-quality-delivery/tests/features/**/*.feature',
  'specs/012-install-doctor-docker/tests/features/**/*.feature',
  'specs/013-agent-mcp-bridge/tests/features/**/*.feature',
  'specs/014-standalone-repo/tests/features/**/*.feature',
  'specs/026-web-extraction-options/tests/features/**/*.feature',
  'specs/027-large-project-ux/tests/features/**/*.feature',
];
const only = (process.env.ACCEPTANCE_FEATURES ?? '').split(',').map((n) => n.trim()).filter(Boolean);
const paths = only.length ? PATHS.filter((p) => only.some((n) => p.startsWith(`specs/${n}-`))) : PATHS;
if (only.length && paths.length !== only.length) throw new Error(`ACCEPTANCE_FEATURES ${only.join(',')}: unknown feature`);

export default {
  paths,
  import: ['tests/acceptance/support/**/*.ts', 'tests/acceptance/steps/**/*.ts'],
  tags: tags.join(' and '),
  format: ['progress', 'summary'],
  formatOptions: { snippetInterface: 'async-await' },
};
