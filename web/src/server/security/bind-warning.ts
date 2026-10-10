// Prominent warning when the web listens beyond the local machine without an API token (007, decision A3, FR-036).
// Next.js listens on every interface unless HOSTNAME or -H/--hostname says otherwise.
import type { Env } from '../config';

export function listenHost(env: Env, argv: string[]): string | null {
  const fromEnv = env.HOSTNAME?.trim();
  if (fromEnv) return fromEnv;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if ((a === '-H' || a === '--hostname') && argv[i + 1]) return argv[i + 1];
    if (a.startsWith('--hostname=')) return a.slice('--hostname='.length);
  }
  return null;
}

function isLoopback(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase();
  return h === 'localhost' || h === '::1' || /^127\.\d+\.\d+\.\d+$/.test(h);
}

export function exposureWarning(host: string | null, token: string | null): string | null {
  if (token) return null;
  if (host && isLoopback(host)) return null;
  const where = host ?? 'all network interfaces';
  const bar = '!'.repeat(100);
  return [
    bar,
    `!!! dev-arch API is NOT protected: listening on ${where} without DEVARCH_API_TOKEN.`,
    '!!! Anyone who reaches this server can submit analyses, read results and view analyzed sources.',
    '!!! Set DEVARCH_API_TOKEN=<secret> (clients send Authorization: Bearer <secret>) or bind to 127.0.0.1 (HOSTNAME / -H).',
    bar,
  ].join('\n');
}
