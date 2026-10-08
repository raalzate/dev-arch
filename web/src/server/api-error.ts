// Error with an HTTP status and a stable code, rendered as {"error": {"code", "message", ...extra}}
// (007-native-engine-runtime, contracts/analyses-api.md).
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function errorResponse(e: ApiError, headers: Record<string, string> = {}): Response {
  return Response.json({ error: { code: e.code, message: e.message, ...e.extra } }, { status: e.status, headers });
}

/** Write failures caused by a full disk or quota (FR-037). */
export function isStorageFull(e: unknown): boolean {
  const code = (e as { code?: string } | null)?.code;
  return code === 'ENOSPC' || code === 'EDQUOT';
}

export function storageError(e: unknown, while_: string): ApiError {
  return isStorageFull(e)
    ? new ApiError(507, 'STORAGE_FULL', `Insufficient disk space while ${while_}.`)
    : new ApiError(500, 'IO_ERROR', `Could not write to disk while ${while_}.`);
}
