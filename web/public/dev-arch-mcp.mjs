#!/usr/bin/env node
// dev-arch MCP bridge (013-agent-mcp-bridge, contracts/bridge-cli.md). A coding agent (for example Claude Code)
// launches this file over stdio; it forwards every MCP request to the dev-arch agent endpoint (<url>/api/mcp) and
// resolves `analyze_project` locally: the project folder is packaged as a ZIP (without dependency, build and
// version-control directories, without following symbolic links) and uploaded with POST <url>/api/analyses, so it
// works with a dev-arch running in a container or on another machine. Single file, Node >= 20, no dependencies.
//
//   node dev-arch-mcp.mjs [--url http://127.0.0.1:9002] [--token <DEVARCH_API_TOKEN>]
import { lstat, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

export const VERSION = '1.2.0';
const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const DEFAULT_URL = 'http://127.0.0.1:9002';
const START_HINT = 'Start dev-arch (`make dev` in apps/dev-arch, or `docker compose -f docker/compose.yaml up -d`) or fix --url.';

/** Directories never sent: version control, dependencies and build outputs of Java, .NET and Node, IDE state. */
export const EXCLUDED_DIRS = new Set([
  '.git', '.svn', '.hg', 'node_modules', 'target', 'build', 'out', 'bin', 'obj', '.gradle', '.idea', '.vs',
  '.vscode', '.next', 'dist', 'packages', 'TestResults',
]);
const EXCLUDED_FILES = new Set(['.DS_Store', 'Thumbs.db']);

// --- packaging -----------------------------------------------------------------------------------------------

/** Relative POSIX paths of the files to send, sorted; symbolic links and excluded directories are skipped. */
export async function collectFiles(root) {
  const out = [];
  async function walk(rel) {
    const entries = await readdir(path.join(root, rel), { withFileTypes: true });
    for (const e of entries) {
      const child = rel ? `${rel}/${e.name}` : e.name;
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) {
        if (!EXCLUDED_DIRS.has(e.name)) await walk(child);
      } else if (e.isFile() && !EXCLUDED_FILES.has(e.name)) {
        out.push(child);
      }
    }
  }
  await walk('');
  return out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
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

function crc32(buf) {
  if (typeof zlib.crc32 === 'function') return zlib.crc32(buf) >>> 0;
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const DOS_DATE = (0 << 9) | (1 << 5) | 1; // 1980-01-01: fixed so the same folder gives the same bytes
const UTF8_FLAG = 0x0800;

/** ZIP of the folder with entries under `<folder name>/`, deterministic (sorted entries, fixed date). */
export async function packFolder(root) {
  const base = path.basename(path.resolve(root));
  const files = await collectFiles(root);
  if (files.length >= 0xffff) throw new BridgeError('TOO_LARGE', `The folder has ${files.length} files to send.`, 'Analyze a smaller folder.');
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const rel of files) {
    const data = await readFile(path.join(root, rel));
    const name = Buffer.from(`${base}/${rel}`, 'utf8');
    const deflated = zlib.deflateRawSync(data);
    const stored = deflated.length >= data.length;
    const body = stored ? data : deflated;
    const crc = crc32(data);
    if (offset + body.length > 0xfffffff0) throw new BridgeError('TOO_LARGE', 'The folder is larger than 4 GB.', 'Analyze a smaller folder.');
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(UTF8_FLAG, 6);
    local.writeUInt16LE(stored ? 0 : 8, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(UTF8_FLAG, 8);
    central.writeUInt16LE(stored ? 0 : 8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, name, body);
    centrals.push(central, name);
    offset += local.length + name.length + body.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

// --- MCP proxy -----------------------------------------------------------------------------------------------

export class BridgeError extends Error {
  constructor(code, message, action, extra = {}) {
    super(message);
    this.code = code;
    this.action = action;
    this.extra = extra;
  }
}

function errorResult(e) {
  return { content: [{ type: 'text', text: JSON.stringify({ error: { code: e.code, message: e.message, action: e.action, ...e.extra } }) }], isError: true };
}

export function parseArgs(argv, env = process.env) {
  const opts = { url: env.DEVARCH_URL || DEFAULT_URL, token: env.DEVARCH_API_TOKEN || null, help: false, version: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url') opts.url = argv[++i];
    else if (a === '--token') opts.token = argv[++i];
    else if (a === '--version') opts.version = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else throw new Error(`Unknown option '${a}'. Use --url <url>, --token <token>, --version or --help.`);
  }
  opts.url = String(opts.url || DEFAULT_URL).replace(/\/+$/, '');
  return opts;
}

export function createBridge(opts, fetchImpl = fetch) {
  const headers = (extra = {}) => ({ ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}), ...extra });

  async function http(pathname, init) {
    try {
      return await fetchImpl(`${opts.url}${pathname}`, init);
    } catch (e) {
      throw new BridgeError('UNREACHABLE', `dev-arch is not reachable at ${opts.url} (${e?.cause?.code ?? e?.message ?? e}).`, START_HINT, { url: opts.url });
    }
  }

  async function serverError(res) {
    let error = null;
    try {
      error = (await res.json()).error ?? null;
    } catch {
      /* not JSON */
    }
    const message = error?.message ?? `dev-arch answered HTTP ${res.status}.`;
    if (res.status === 401) return new BridgeError('UNAUTHORIZED', message, 'Set DEVARCH_API_TOKEN (or --token) to the token of the dev-arch server.');
    if (res.status === 413) return new BridgeError('TOO_LARGE', message, 'Analyze a smaller folder or raise MAX_UPLOAD_BYTES on the dev-arch server.');
    return new BridgeError('INVALID_INPUT', message, 'Check the folder and the language.', { server_code: error?.code ?? null });
  }

  /** Forwards one JSON-RPC message to the agent endpoint; returns its response or null for notifications. */
  async function forward(message) {
    const res = await http('/api/mcp', {
      method: 'POST',
      headers: headers({ 'content-type': 'application/json', accept: 'application/json, text/event-stream' }),
      body: JSON.stringify(message),
    });
    if (res.status === 202) return null;
    if (!res.ok) throw await serverError(res);
    return res.json();
  }

  async function analyzeProject(args) {
    const folder = typeof args?.path === 'string' ? path.resolve(args.path) : '';
    let info = null;
    try {
      info = folder ? await lstat(folder) : null;
    } catch {
      info = null;
    }
    if (!info || !info.isDirectory()) {
      throw new BridgeError('INVALID_INPUT', `'${args?.path ?? ''}' is not a folder of this machine.`, 'Pass the absolute path of the project folder.');
    }
    const language = ['java', 'dotnet', 'auto'].includes(args.language) ? args.language : 'auto';
    const zip = await packFolder(folder);
    const res = await http(`/api/analyses?language=${language}`, {
      method: 'POST',
      headers: headers({ 'content-type': 'application/zip', 'x-file-name': `${path.basename(folder)}.zip` }),
      body: zip,
    });
    if (res.status !== 202 && res.status !== 200 && res.status !== 201) throw await serverError(res);
    const { jobId } = await res.json();
    const wait = Number.isInteger(args.wait_seconds) ? args.wait_seconds : 300;
    const reply = await forward({ jsonrpc: '2.0', id: 'analyze', method: 'tools/call', params: { name: 'get_analysis', arguments: { analysis_id: jobId, wait_seconds: wait } } });
    return reply.result;
  }

  /** Handles one message from the agent; resolves to the response to write, or null. */
  return async function handle(message) {
    const { id, method, params } = message;
    const isRequest = id !== undefined && id !== null;
    try {
      if (method === 'initialize') {
        const requested = params?.protocolVersion;
        return {
          jsonrpc: '2.0', id,
          result: {
            protocolVersion: PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS[0],
            capabilities: { tools: {} },
            serverInfo: { name: 'dev-arch', version: VERSION },
            instructions: 'dev-arch analyzes Java and .NET projects for modernization. Call analyze_project with the ' +
              'project folder, then get_summary, get_proposals, get_findings or get_plan with the analysis_id.',
          },
        };
      }
      if (!isRequest) return null; // notifications (initialized, cancelled) need no answer from a stateless server
      if (method === 'ping') return { jsonrpc: '2.0', id, result: {} };
      if (method === 'tools/call' && params?.name === 'analyze_project') {
        return { jsonrpc: '2.0', id, result: await analyzeProject(params.arguments ?? {}) };
      }
      const reply = await forward(message);
      return reply ?? { jsonrpc: '2.0', id, result: {} };
    } catch (e) {
      const err = e instanceof BridgeError ? e : new BridgeError('INVALID_INPUT', e?.message ?? String(e), 'Retry or check the dev-arch logs.');
      if (method === 'tools/call') return { jsonrpc: '2.0', id, result: errorResult(err) };
      return { jsonrpc: '2.0', id, error: { code: -32000, message: `${err.code}: ${err.message} ${err.action}`.trim() } };
    }
  };
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    process.stderr.write(`${e.message}\n`);
    process.exit(2);
  }
  if (opts.version) {
    process.stdout.write(`${VERSION}\n`);
    return;
  }
  if (opts.help) {
    process.stdout.write('Usage: node dev-arch-mcp.mjs [--url <dev-arch url>] [--token <API token>]\n' +
      `  --url    dev-arch base URL (default DEVARCH_URL or ${DEFAULT_URL})\n` +
      '  --token  API token of the server (default DEVARCH_API_TOKEN)\n');
    return;
  }
  const handle = createBridge(opts);
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  const inflight = new Set();
  for await (const line of rl) {
    if (!line.trim()) continue;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })}\n`);
      continue;
    }
    const p = handle(message).then((reply) => {
      if (reply) process.stdout.write(`${JSON.stringify(reply)}\n`);
    });
    inflight.add(p);
    p.finally(() => inflight.delete(p));
  }
  await Promise.all(inflight);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    process.stderr.write(`dev-arch bridge: ${e?.stack ?? e}\n`);
    process.exit(1);
  });
}
