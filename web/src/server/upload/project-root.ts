// Project root of an extracted ZIP, same rule as 006: the single top-level folder when there is exactly one.
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

export function findProjectRoot(sourceDir: string): string {
  const entries = readdirSync(sourceDir);
  if (entries.length === 1) {
    const only = path.join(sourceDir, entries[0]);
    if (statSync(only).isDirectory()) return only;
  }
  return sourceDir;
}
