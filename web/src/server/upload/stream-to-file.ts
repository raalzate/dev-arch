// Streams a request body to disk counting bytes (research D8, FR-013, FR-037).
import { createWriteStream as fsCreateWriteStream, promises as fs } from 'node:fs';
import { Readable, Transform, type Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ApiError, storageError } from '../api-error';

export interface StreamIo {
  createWriteStream: (p: string) => Writable;
}

const defaultIo: StreamIo = { createWriteStream: (p) => fsCreateWriteStream(p) };

export function uploadTooLarge(limit: number): ApiError {
  return new ApiError(413, 'UPLOAD_TOO_LARGE', `The upload exceeds the limit of ${limit} bytes.`, { limitBytes: limit });
}

/**
 * Writes `body` to `dest`, failing with 413 UPLOAD_TOO_LARGE as soon as more than `limit` bytes arrive (or before
 * reading when the declared Content-Length is already above it). Any failure removes `dest`.
 */
export async function streamToFile(
  body: ReadableStream<Uint8Array> | null,
  dest: string,
  limit: number,
  contentLength?: number,
  io: Partial<StreamIo> = {},
): Promise<number> {
  if (contentLength !== undefined && contentLength > limit) throw uploadTooLarge(limit);
  const { createWriteStream } = { ...defaultIo, ...io };
  let count = 0;
  const counter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      count += chunk.length;
      if (count > limit) cb(uploadTooLarge(limit));
      else cb(null, chunk);
    },
  });
  try {
    const source = body ? Readable.fromWeb(body as never) : Readable.from([]);
    await pipeline(source, counter, createWriteStream(dest));
    return count;
  } catch (e) {
    await fs.rm(dest, { force: true });
    if (e instanceof ApiError) throw e;
    throw storageError(e, 'storing the upload');
  }
}
