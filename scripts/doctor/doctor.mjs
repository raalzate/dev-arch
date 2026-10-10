// dev-arch doctor command (012-install-doctor-docker): argument parsing and output, without process access.
// Exit code 0 when no check FAILs, 1 when one does, 64 on a usage error.
import { FAIL, MODES, runDoctor } from './checks.mjs';
import { formatFix, formatHuman } from './format.mjs';
import { REQUIREMENTS, requirementsTable } from './requirements.mjs';
import { realSystem } from './system.mjs';

export const USAGE = `Usage: dev-arch doctor [--mode local|docker] [--json] [--fix] [--only <id,...>]
       dev-arch doctor --requirements-table

  --mode local|docker  checks of the chosen installation route (default: local)
  --json               machine-readable report (CI, healthchecks)
  --fix                show the install commands of the missing requirements (never runs them)
  --only <ids>         run only these checks (${REQUIREMENTS.map((r) => r.id).join(', ')})
  --requirements-table print the requirements table of docs/INSTALL.md`;

/** Parses the arguments; throws an Error with a usage message on invalid input. */
export function parseArgs(argv) {
  const args = [...argv];
  if (args[0] === 'doctor') args.shift();
  const opts = { mode: 'local', json: false, fix: false, only: null, table: false, help: false };
  while (args.length) {
    const a = args.shift();
    if (a === '--json') opts.json = true;
    else if (a === '--fix') opts.fix = true;
    else if (a === '--requirements-table') opts.table = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--mode' || a.startsWith('--mode=')) opts.mode = a.includes('=') ? a.slice(7) : args.shift();
    else if (a === '--only' || a.startsWith('--only=')) opts.only = (a.includes('=') ? a.slice(7) : args.shift() ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    else throw new Error(`unknown argument: ${a}`);
  }
  if (!MODES.includes(opts.mode)) throw new Error(`invalid --mode: ${opts.mode} (expected ${MODES.join(' or ')})`);
  const known = REQUIREMENTS.map((r) => r.id);
  const unknown = (opts.only ?? []).filter((id) => !known.includes(id));
  if (unknown.length) throw new Error(`unknown check: ${unknown.join(', ')}`);
  return opts;
}

/** Runs the doctor and returns { code, stdout } (no direct process access, for tests). */
export async function main(argv, sys = realSystem(), color = false) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (e) {
    return { code: 64, stdout: '', stderr: `${e.message}\n${USAGE}\n` };
  }
  if (opts.help) return { code: 0, stdout: `${USAGE}\n`, stderr: '' };
  if (opts.table) return { code: 0, stdout: `${requirementsTable()}\n`, stderr: '' };
  const report = await runDoctor(sys, { mode: opts.mode, only: opts.only });
  const code = report.status === FAIL ? 1 : 0;
  if (opts.json) return { code, stdout: `${JSON.stringify(report, null, 2)}\n`, stderr: '' };
  let text = formatHuman(report, color);
  if (opts.fix) text += `\n${formatFix(report)}`;
  else if (report.checks.some((c) => c.fix.length)) text += '\nRun with --fix to see the install commands for this system.\n';
  return { code, stdout: text, stderr: '' };
}
