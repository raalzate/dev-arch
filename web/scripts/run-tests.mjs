#!/usr/bin/env node
// Web unit tests (011-quality-delivery, research D4; contracts/coverage.md).
//   node scripts/run-tests.mjs              run every src/**/*.test.ts with node:test + tsx
//   node scripts/run-tests.mjs --coverage   same, plus coverage/lcov.info and coverage/summary.json; fails when a
//                                           target module is never loaded or the aggregate line coverage < 85 %
//   node scripts/run-tests.mjs --check F    evaluate an existing lcov file F against the same rules
// The test files are listed explicitly: Node 20 does not expand glob patterns given to --test.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const THRESHOLD = 85;
const EXCLUDED_TARGETS = new Set(['src/lib/modernization/test-fixtures.ts', 'src/lib/placeholder-images.ts']);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const rel = (p) => path.relative(WEB, p).split(path.sep).join('/');

export function testFiles() {
  return walk(path.join(WEB, 'src')).filter((f) => f.endsWith('.test.ts')).map(rel).sort();
}

/** Non-visual server, API route and utility modules whose line coverage is reported and enforced (FR-018). */
export function targetModules() {
  return [
    ...walk(path.join(WEB, 'src', 'server')).filter((f) => f.endsWith('.ts')),
    ...walk(path.join(WEB, 'src', 'app', 'api')).filter((f) => path.basename(f) === 'route.ts'),
    ...walk(path.join(WEB, 'src', 'lib')).filter((f) => f.endsWith('.ts')),
  ]
    .map(rel)
    .filter((f) => !f.endsWith('.test.ts') && !f.endsWith('.d.ts') && !EXCLUDED_TARGETS.has(f))
    .sort();
}

/** Line totals per source file of an lcov report (paths relative to web/). */
export function parseLcov(text) {
  const files = {};
  let current = null;
  for (const line of text.split('\n')) {
    if (line.startsWith('SF:')) {
      const sf = line.slice(3).trim();
      current = path.isAbsolute(sf) ? rel(sf) : sf.split(path.sep).join('/');
      files[current] ??= { covered: 0, total: 0, pct: 0 };
    } else if (current && line.startsWith('LF:')) files[current].total = Number(line.slice(3));
    else if (current && line.startsWith('LH:')) files[current].covered = Number(line.slice(3));
    else if (line.startsWith('end_of_record')) current = null;
  }
  for (const f of Object.values(files)) f.pct = f.total ? round((100 * f.covered) / f.total) : 100;
  return files;
}

const round = (n) => Math.round(n * 100) / 100;

/** Summary of the target modules and the problems that make the coverage check fail. */
export function evaluate(lcovText) {
  const all = parseLcov(lcovText);
  const targets = targetModules();
  const files = {};
  const missing = [];
  let covered = 0;
  let total = 0;
  for (const t of targets) {
    const f = all[t];
    if (!f) {
      missing.push(t);
      continue;
    }
    files[t] = f;
    covered += f.covered;
    total += f.total;
  }
  const pct = total ? round((100 * covered) / total) : 0;
  const problems = missing.map((m) => `missing module: ${m} (never loaded by the web unit tests)`);
  if (pct < THRESHOLD) problems.push(`line coverage ${pct.toFixed(2)}% is below the threshold of ${THRESHOLD}%`);
  return { summary: { lines: { covered, total, pct }, files, threshold: THRESHOLD, missing }, problems };
}

function report(result, lcovPath) {
  console.log(`[coverage] web: ${result.summary.lines.pct.toFixed(2)}% lines (${lcovPath}) — threshold ${THRESHOLD}%, ${Object.keys(result.summary.files).length} modules`);
  for (const p of result.problems) console.error(`[coverage] web: FAIL ${p}`);
  return result.problems.length ? 1 : 0;
}

function main(argv) {
  if (argv[0] === '--check') {
    if (!argv[1]) {
      console.error('usage: run-tests.mjs --check <lcov-file>');
      return 64;
    }
    return report(evaluate(readFileSync(argv[1], 'utf8')), argv[1]);
  }
  const coverage = argv.includes('--coverage');
  const args = ['--import', 'tsx', '--test'];
  if (coverage) {
    mkdirSync(path.join(WEB, 'coverage'), { recursive: true });
    args.push('--experimental-test-coverage', '--test-reporter=spec', '--test-reporter-destination=stdout',
      '--test-reporter=lcov', '--test-reporter-destination=coverage/lcov.info');
  }
  const res = spawnSync(process.execPath, [...args, ...testFiles()], { cwd: WEB, stdio: 'inherit' });
  if (res.status !== 0) return res.status ?? 1;
  if (!coverage) return 0;
  const lcovPath = 'coverage/lcov.info';
  const result = evaluate(readFileSync(path.join(WEB, lcovPath), 'utf8'));
  writeFileSync(path.join(WEB, 'coverage', 'summary.json'), `${JSON.stringify(result.summary, null, 2)}\n`);
  return report(result, lcovPath);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
