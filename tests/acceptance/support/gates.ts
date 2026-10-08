// Scenario gates: @slow scenarios only run with DEVARCH_E2E=true and never from inside a nested product
// command started by the suite itself (DEVARCH_TEST_RUNNING=1), mirroring SCHEMA_CHECK_E2E of 005.
import { Before, setDefaultTimeout } from '@cucumber/cucumber';

setDefaultTimeout(5 * 60 * 1000);

export const E2E = process.env.DEVARCH_E2E === 'true';
export const NESTED = process.env.DEVARCH_TEST_RUNNING === '1';

Before({ tags: '@slow' }, function () {
  if (!E2E) return 'skipped';
  if (NESTED) return 'skipped';
  return undefined;
});
