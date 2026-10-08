// Product layout for the 006-devarch-monorepo acceptance scenarios (data-model.md, ProductLayout).
// DEVARCH_MONOREPO_ROOT points the scenarios at another checkout (e.g. the pre-feature commit for the RED run).
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const PRODUCT_REL = 'apps/dev-arch';

/** The six areas of the product (FR-001). */
export const AREAS = ['web', 'engine', 'schema', 'skills', 'docs', 'docker'] as const;

/**
 * Root entries allowed besides the areas (FR-001; plan "Project Structure"): governance, version source,
 * unified configuration, orchestration and the product acceptance tests.
 */
export const ALLOWED_ROOT_ENTRIES: Record<string, string> = {
  'CONSTITUTION.md': 'governance',
  'PREMISE.md': 'governance',
  'CHANGELOG.md': 'governance',
  specs: 'governance',
  'AGENTS.md': 'governance',
  'CLAUDE.md': 'governance',
  'tessl.json': 'governance',
  '.tessl': 'governance',
  '.specify': 'governance',
  VERSION: 'version',
  '.gitignore': 'configuration',
  '.editorconfig': 'configuration',
  '.mcp.json': 'configuration',
  'package.json': 'configuration',
  'package-lock.json': 'configuration',
  Makefile: 'orchestration',
  scripts: 'orchestration',
  'cucumber.mjs': 'acceptance-test',
  tests: 'acceptance-test',
};

export interface Layout {
  monorepoRoot: string;
  productRoot: string;
  engineRoot: string;
  schemaDir: string;
  webDir: string;
  engineDist: string;
}

export function layoutOf(monorepoRoot: string): Layout {
  const productRoot = path.join(monorepoRoot, PRODUCT_REL);
  return {
    monorepoRoot,
    productRoot,
    engineRoot: path.join(productRoot, 'engine'),
    schemaDir: path.join(productRoot, 'schema'),
    webDir: path.join(productRoot, 'web'),
    engineDist: path.join(productRoot, 'web', 'engine-dist'),
  };
}

function defaultMonorepoRoot(): string {
  if (process.env.DEVARCH_MONOREPO_ROOT) return path.resolve(process.env.DEVARCH_MONOREPO_ROOT);
  return path.resolve(here, '..', '..', '..', '..', '..');
}

/** Layout of the checkout under test. */
export const layout: Layout = layoutOf(defaultMonorepoRoot());

/**
 * Original Static Inference repository (engine origin), when available on this machine.
 * STATIC_INFERENCE_REPO overrides ("none" forces the CI behaviour: no origin on this machine); otherwise the
 * sibling working copy of the monorepo main checkout is tried.
 */
export function engineOriginRepo(): string | null {
  if (process.env.STATIC_INFERENCE_REPO === 'none') return null;
  const candidates = [
    process.env.STATIC_INFERENCE_REPO,
    path.resolve(layout.monorepoRoot, '..', 'maestria', 'project', 'static-inference'),
    path.resolve(layout.monorepoRoot, 'project', 'static-inference'),
  ].filter((c): c is string => !!c);
  return candidates.find((c) => existsSync(path.join(c, '.git'))) ?? null;
}
