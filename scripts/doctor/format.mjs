// Human output of the doctor (012-install-doctor-docker): one table row per check, colored on a terminal.
const COLORS = { OK: '\u001b[32m', WARN: '\u001b[33m', FAIL: '\u001b[31m' };
const RESET = '\u001b[0m';

function pad(text, width) {
  return text.length >= width ? text : text + ' '.repeat(width - text.length);
}

/** Table with STATUS, CHECK, DETECTED, REQUIRED and DETAIL columns plus a summary line. */
export function formatHuman(report, color = false) {
  const header = ['STATUS', 'CHECK', 'DETECTED', 'REQUIRED', 'DETAIL'];
  const rows = report.checks.map((c) => [c.status, c.name, c.detected, c.required, c.detail]);
  const widths = header.slice(0, 4).map((h, i) => Math.min(48, Math.max(h.length, ...rows.map((r) => r[i].length))));
  const line = (cells, paint) => cells.map((cell, i) => {
    const text = i < 4 ? pad(cell, widths[i]) : cell;
    return i === 0 && paint && COLORS[cell] ? `${COLORS[cell]}${text}${RESET}` : text;
  }).join('  ').trimEnd();
  const counts = ['OK', 'WARN', 'FAIL'].map((s) => `${report.checks.filter((c) => c.status === s).length} ${s}`).join(', ');
  return [
    `dev-arch doctor ${report.version} — mode ${report.mode} (${report.platform})`,
    '',
    line(header, false),
    ...rows.map((r) => line(r, color)),
    '',
    `Result: ${report.status} (${counts})`,
    '',
  ].join('\n');
}

/** Install commands of every check that is not OK (shown, never executed). */
export function formatFix(report) {
  const pending = report.checks.filter((c) => c.status !== 'OK');
  if (!pending.length) return 'Nothing to fix.\n';
  const lines = ['Suggested commands (not executed):'];
  for (const c of pending) {
    lines.push(`  ${c.name} [${c.status}]`);
    for (const f of c.fix.length ? c.fix : ['see docs/INSTALL.md']) lines.push(`    ${f}`);
  }
  return `${lines.join('\n')}\n`;
}
