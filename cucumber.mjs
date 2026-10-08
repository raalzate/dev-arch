// Cucumber-JS configuration for the 006-devarch-monorepo acceptance scenarios (research D9).
// Long scenarios (clean clone build/test, web + ZIP, MCP startup) are tagged @slow and only run
// with DEVARCH_E2E=true, mirroring SCHEMA_CHECK_E2E of 005.
const e2e = process.env.DEVARCH_E2E === 'true';

export default {
  paths: ['specs/006-devarch-monorepo/tests/features/**/*.feature'],
  import: ['tests/acceptance/support/**/*.ts', 'tests/acceptance/steps/**/*.ts'],
  tags: e2e ? '' : 'not @slow',
  format: ['progress', 'summary'],
  formatOptions: { snippetInterface: 'async-await' },
};
