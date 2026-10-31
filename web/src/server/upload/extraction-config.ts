// 026-web-extraction-options: shape check of the extraction configuration sent with a submission (FR-001).

/** Maximum size of a submitted extraction configuration (026, FR-001). */
export const MAX_CONFIG_CHARS = 8192;

/**
 * 026: the extraction configuration of a submission. Accepts a JSON text (query parameter) or an already parsed
 * value (JSON body); null/empty = none. Only the shape is checked here (object, size); the engine validates values.
 */
export function parseExtractionConfig(raw: unknown): Record<string, unknown> | null {
  if (raw === null || raw === undefined) return null;
  let value: unknown = raw;
  if (typeof raw === 'string') {
    if (raw.trim() === '') return null;
    if (raw.length > MAX_CONFIG_CHARS) throw new Error(`The configuration exceeds ${MAX_CONFIG_CHARS} characters.`);
    try {
      value = JSON.parse(raw);
    } catch {
      throw new Error('The configuration is not valid JSON.');
    }
  } else if (JSON.stringify(raw).length > MAX_CONFIG_CHARS) {
    throw new Error(`The configuration exceeds ${MAX_CONFIG_CHARS} characters.`);
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('The configuration must be a JSON object.');
  }
  return value as Record<string, unknown>;
}
