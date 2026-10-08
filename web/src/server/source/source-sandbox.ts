// Source viewer restricted to the project of one analysis (007, research D10; FR-017, FR-018).
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ApiError } from '../api-error';

export interface SourceLimits {
  maxSourceViewBytes: number;
  sourceExtensions: readonly string[];
}

const invalid = () => new ApiError(400, 'INVALID_PATH', 'The path must be relative to the project root of the analysis.');
const notFound = () => new ApiError(404, 'NOT_FOUND', 'The file does not exist in this analysis.');

function unsafe(p: string): boolean {
  if (!p || p.includes('\0') || p.includes('\\') || p.startsWith('/') || /^[A-Za-z]:/.test(p)) return true;
  return p.split('/').some((s) => s === '..' || s === '.');
}

/** Reads `relPath` below `root`; every failure outside the root is the same 404 (no existence leak). */
export async function readSource(root: string, relPath: string, limits: SourceLimits): Promise<{ path: string; content: string }> {
  let decoded: string;
  try {
    decoded = decodeURIComponent(relPath);
  } catch {
    throw invalid();
  }
  if (unsafe(relPath) || unsafe(decoded) || decoded.includes('%')) throw invalid();
  let realRoot: string;
  let real: string;
  try {
    realRoot = await fs.realpath(root);
    real = await fs.realpath(path.resolve(root, decoded));
  } catch {
    throw notFound();
  }
  if (!real.startsWith(realRoot + path.sep)) throw notFound();
  const st = await fs.lstat(real).catch(() => null);
  if (!st || !st.isFile()) throw notFound();
  const ext = path.extname(real).toLowerCase();
  if (!ext || !limits.sourceExtensions.includes(ext)) {
    throw new ApiError(400, 'EXTENSION_NOT_ALLOWED', `Files with extension '${ext || '(none)'}' cannot be viewed.`, { extension: ext });
  }
  if (st.size > limits.maxSourceViewBytes) {
    throw new ApiError(413, 'FILE_TOO_LARGE', `The file exceeds the viewing limit of ${limits.maxSourceViewBytes} bytes.`,
      { limitBytes: limits.maxSourceViewBytes });
  }
  return { path: decoded, content: await fs.readFile(real, 'utf8') };
}
