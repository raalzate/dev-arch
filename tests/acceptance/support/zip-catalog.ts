// ZIP archives built in memory for the 007 scenarios (benign and malicious catalogue, SC-005).
// A minimal writer is used instead of adm-zip so that entry names, unix modes, duplicates and declared sizes are
// written exactly as given (adm-zip normalizes names and replaces duplicates). No binary fixture is versioned.
import { randomBytes } from 'node:crypto';
import zlib from 'node:zlib';

export interface ZipEntrySpec {
  name: string;
  data: Buffer | string;
  /** Unix mode stored in the external attributes (e.g. 0o120777 for a symbolic link). */
  mode?: number;
  /** Store compressed with deflate (default true when the data is larger than 1 KB). */
  deflate?: boolean;
  /** Uncompressed size written in the headers instead of the real one (lying archives). */
  declaredSize?: number;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function buildZip(entries: ZipEntrySpec[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const data = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data, 'utf8');
    const deflate = e.deflate ?? data.length > 1024;
    const body = deflate ? zlib.deflateRawSync(data) : data;
    const name = Buffer.from(e.name, 'utf8');
    const crc = crc32(data);
    const size = e.declaredSize ?? data.length;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(deflate ? 8 : 0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(size, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, body);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE((3 << 8) | 20, 4); // made by unix
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(deflate ? 8 : 0, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(size, 24);
    central.writeUInt16LE(name.length, 28);
    const mode = e.mode ?? (e.name.endsWith('/') ? 0o040755 : 0o100644);
    central.writeUInt32LE(((mode & 0xffff) << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + body.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

const JAVA = (cls: string) => `package demo;\n\npublic class ${cls} {\n    public String name() {\n        return "${cls}";\n    }\n}\n`;

/** ZIP with the given entry names (benign Java content), as written in the scenarios. */
export function zipWithEntries(names: string[]): Buffer {
  return buildZip(names.map((name) => entryFor(name)));
}

function entryFor(label: string): ZipEntrySpec {
  const symlink = /^(.*) \(symlink\)$/.exec(label);
  if (symlink) return { name: symlink[1], data: '/etc', mode: 0o120777 };
  if (label.endsWith('pom.xml')) return { name: label, data: '<project><modelVersion>4.0.0</modelVersion></project>\n' };
  const cls = /([A-Za-z0-9_]+)\.java$/.exec(label)?.[1];
  return { name: label, data: cls ? JAVA(cls) : 'evil\n' };
}

/** `entries` entries whose total uncompressed size is `mb` MB (zeros, deflated). */
export function zipWithSize(entries: number, mb: number): Buffer {
  const per = Math.floor((mb * 1024 * 1024) / entries);
  return buildZip(
    Array.from({ length: entries }, (_, i) => ({ name: `demo/src/F${i}.txt`, data: Buffer.alloc(per, 0x30), deflate: true })),
  );
}

/** A ZIP that declares `declaredMb` MB but expands to `realMb` MB (decompression bomb with lying headers). */
export function lyingZip(declaredMb: number, realMb: number): Buffer {
  return buildZip([
    { name: 'demo/pom.xml', data: '<project/>' },
    { name: 'demo/src/Big.txt', data: Buffer.alloc(realMb * 1024 * 1024, 0x30), deflate: true, declaredSize: declaredMb * 1024 * 1024 },
  ]);
}

/** An incompressible ZIP of about `mb` MB. */
export function zipOfBytes(mb: number): Buffer {
  return buildZip([
    { name: 'demo/pom.xml', data: '<project/>' },
    { name: 'demo/blob.bin', data: randomBytes(Math.ceil(mb * 1024 * 1024)), deflate: false },
  ]);
}
