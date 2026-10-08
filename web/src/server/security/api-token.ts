// Optional shared API token (007, decision A3, FR-035): Authorization: Bearer <DEVARCH_API_TOKEN>.
import { createHash, timingSafeEqual } from 'node:crypto';

const digest = (s: string) => createHash('sha256').update(s, 'utf8').digest();

/** Returns the 401 response to send, or null when the request may proceed. Same answer for every failure. */
export function checkApiToken(request: Request, token: string | null): Response | null {
  if (!token) return null;
  const header = request.headers.get('authorization') ?? '';
  const m = /^Bearer\s+(\S.*)$/i.exec(header.trim());
  if (m && timingSafeEqual(digest(m[1].trim()), digest(token))) return null;
  return Response.json(
    { error: { code: 'UNAUTHORIZED', message: 'A valid API token is required (Authorization: Bearer <token>).' } },
    { status: 401, headers: { 'WWW-Authenticate': 'Bearer realm="dev-arch"', 'Cache-Control': 'no-store' } },
  );
}
