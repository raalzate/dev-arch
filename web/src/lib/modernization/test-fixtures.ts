// Test helpers of the modernization modules: contract fixtures of the schema package and the VB synthetic output.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ConsolidatedArchitecture, DependencyGraph, EntrypointsDocument } from '@static-inference/schema';
import type { AnalysisView } from './sections';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const DIRS: Record<string, string> = {
  'java-standar': path.join(ROOT, 'schema', 'fixtures', 'valid', 'java-standar'),
  'dotnet-ecommerce': path.join(ROOT, 'schema', 'fixtures', 'valid', 'dotnet-ecommerce'),
  'vb-synthetic': path.join(ROOT, 'tests', 'acceptance', 'fixtures', 'vb-synthetic'),
};

export function fixture(name: 'java-standar' | 'dotnet-ecommerce' | 'vb-synthetic'): AnalysisView {
  const read = <T>(f: string): T => JSON.parse(readFileSync(path.join(DIRS[name], f), 'utf8')) as T;
  return {
    graph: read<DependencyGraph>('output.json'),
    architecture: read<ConsolidatedArchitecture>('output_architecture.json'),
    contracts: read<EntrypointsDocument>('output_entrypoints.json'),
    warnings: [],
  };
}
