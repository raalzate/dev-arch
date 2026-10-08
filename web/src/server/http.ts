// Small HTTP helpers shared by the analyses API routes (contracts/analyses-api.md).
import { ApiError, errorResponse } from './api-error';

export const NO_STORE = { 'Cache-Control': 'no-store' };

export function apiError(status: number, code: string, message: string, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}): Response {
  return errorResponse(new ApiError(status, code, message, extra), { ...NO_STORE, ...headers });
}

export function notFound(): Response {
  return apiError(404, 'NOT_FOUND', 'The analysis does not exist or has expired.');
}

/** Codes that are security rejections of an upload (FR-016: logged without file contents). */
export const SECURITY_CODES = new Set([
  'ZIP_ENTRY_OUTSIDE_ROOT', 'ZIP_SYMLINK', 'ZIP_DUPLICATE_ENTRY', 'ZIP_TOO_MANY_ENTRIES',
  'UNCOMPRESSED_TOO_LARGE', 'UPLOAD_TOO_LARGE', 'INVALID_ZIP',
]);

export function logRejection(e: ApiError, context: string): void {
  if (!SECURITY_CODES.has(e.code)) return;
  const entry = typeof e.extra.entry === 'string' ? ` entry=${JSON.stringify(e.extra.entry)}` : '';
  console.warn(`[security] ${context} rejected: ${e.code}${entry}`);
}
