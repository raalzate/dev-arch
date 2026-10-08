// Assertion integrity hash of iikit testify (same algorithm as testify-tdd.sh compute-hash): step lines
// (Given/When/Then/And/But) of every top-level .feature file sorted by name, trimmed and with collapsed
// whitespace, joined by "\n", SHA-256.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const STEP = /^\s*(Given|When|Then|And|But) /;

export function assertionHash(featuresDir: string): string {
  const files = readdirSync(featuresDir)
    .filter((f) => f.endsWith('.feature'))
    .map((f) => path.join(featuresDir, f))
    .sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
  const lines: string[] = [];
  for (const file of files) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (STEP.test(line)) lines.push(line.replace(/^\s+/, '').replace(/\s\s+/g, ' ').replace(/\s+$/, ''));
    }
  }
  if (lines.length === 0) return 'NO_ASSERTIONS';
  return createHash('sha256').update(lines.join('\n')).digest('hex');
}
