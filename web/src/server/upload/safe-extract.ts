// ZIP validation and counted extraction (research D8; FR-014, FR-015, FR-016, FR-037).
import AdmZip from 'adm-zip';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { ApiError, storageError } from '../api-error';

export interface ZipLimits {
  maxUncompressedBytes: number;
  maxZipEntries: number;
}

export interface ExtractIo {
  writeFile: (p: string, data: Buffer) => Promise<void>;
  mkdir: (p: string) => Promise<void>;
}

const defaultIo: ExtractIo = {
  writeFile: (p, d) => fs.writeFile(p, d),
  mkdir: async (p) => {
    await fs.mkdir(p, { recursive: true });
  },
};

const S_IFMT = 0o170000;
const S_IFLNK = 0o120000;

function open(zipPath: string): AdmZip {
  try {
    return new AdmZip(zipPath);
  } catch {
    throw new ApiError(400, 'INVALID_ZIP', 'The upload is not a valid ZIP archive.');
  }
}

/** Normalized relative path of an entry, or null when it would land outside the extraction folder. */
export function safeEntryPath(name: string): string | null {
  if (name.includes('\0')) return null;
  const n = name.replace(/\\/g, '/');
  if (n.startsWith('/') || /^[A-Za-z]:/.test(n)) return null;
  const segments = n.split('/');
  if (segments.includes('..')) return null;
  const root = path.resolve('/x');
  const resolved = path.resolve(root, n);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return null;
  return n;
}

function outsideRoot(entry: string): ApiError {
  return new ApiError(400, 'ZIP_ENTRY_OUTSIDE_ROOT', `The ZIP entry '${entry}' escapes the extraction folder.`, { entry });
}

function tooBig(limit: number): ApiError {
  return new ApiError(413, 'UNCOMPRESSED_TOO_LARGE',
    `The ZIP expands beyond the limit of ${limit} bytes.`, { limitBytes: limit });
}

/** Validates the central directory without extracting anything; returns the number of entries. */
export function inspectZip(zipPath: string, limits: ZipLimits): number {
  const zip = open(zipPath);
  let entries;
  try {
    entries = zip.getEntries();
  } catch {
    throw new ApiError(400, 'INVALID_ZIP', 'The upload is not a valid ZIP archive.');
  }
  const seen = new Set<string>();
  let declared = 0;
  for (const e of entries) {
    const name = e.entryName;
    const rel = safeEntryPath(name);
    if (rel === null) throw outsideRoot(name);
    if (((e.attr >>> 16) & S_IFMT) === S_IFLNK) {
      throw new ApiError(400, 'ZIP_SYMLINK', `The ZIP entry '${name}' is a symbolic link.`, { entry: name });
    }
    const key = rel.replace(/\/+$/, '').toLowerCase();
    if (seen.has(key)) {
      throw new ApiError(400, 'ZIP_DUPLICATE_ENTRY', `The ZIP entry '${name}' is duplicated.`, { entry: name });
    }
    seen.add(key);
    declared += e.isDirectory ? 0 : e.header.size;
  }
  if (entries.length > limits.maxZipEntries) {
    throw new ApiError(400, 'ZIP_TOO_MANY_ENTRIES',
      `The ZIP has more than ${limits.maxZipEntries} entries.`, { limit: limits.maxZipEntries });
  }
  if (declared > limits.maxUncompressedBytes) throw tooBig(limits.maxUncompressedBytes);
  return entries.length;
}

/** Extracts entry by entry, inflating with a bound so that lying headers cannot exceed the limit. */
export async function extractZip(zipPath: string, dest: string, limits: ZipLimits, io: Partial<ExtractIo> = {}): Promise<void> {
  const { writeFile, mkdir } = { ...defaultIo, ...io };
  const zip = open(zipPath);
  let remaining = limits.maxUncompressedBytes;
  try {
    await mkdir(dest);
    for (const e of zip.getEntries()) {
      const rel = safeEntryPath(e.entryName);
      if (rel === null) throw outsideRoot(e.entryName);
      const target = path.join(dest, rel);
      if (e.isDirectory) {
        await mkdir(target);
        continue;
      }
      const raw = e.getCompressedData();
      let data: Buffer;
      if (e.header.method === 0) {
        data = raw;
      } else if (e.header.method === 8) {
        try {
          data = zlib.inflateRawSync(raw, { maxOutputLength: Math.max(1, remaining + 1) });
        } catch (err) {
          if ((err as { code?: string }).code === 'ERR_BUFFER_TOO_LARGE') throw tooBig(limits.maxUncompressedBytes);
          throw new ApiError(400, 'INVALID_ZIP', `The ZIP entry '${e.entryName}' cannot be decompressed.`);
        }
      } else {
        throw new ApiError(400, 'INVALID_ZIP', `The ZIP entry '${e.entryName}' uses an unsupported compression method.`);
      }
      remaining -= data.length;
      if (remaining < 0) throw tooBig(limits.maxUncompressedBytes);
      await mkdir(path.dirname(target));
      await writeFile(target, data);
    }
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw storageError(e, 'extracting the project');
  }
}
