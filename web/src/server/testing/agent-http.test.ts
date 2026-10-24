// Shared set-up of the agent bridge tests (013-agent-mcp-bridge): a real HTTP server on a free port that dispatches
// to the web route handlers (as `next start` would), and a client that drives the bridge over stdio. This file only
// exports helpers (named *.test.ts to stay out of the production modules); it declares no tests.
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GET as listAnalyses, POST as postAnalyses } from '../../app/api/analyses/route.ts';
import { DELETE as mcpDelete, GET as mcpGet, POST as mcpPost } from '../../app/api/mcp/route.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
export const BRIDGE = path.resolve(here, '../../../public/dev-arch-mcp.mjs');

type Handler = (req: Request) => Promise<Response>;
const ROUTES: Record<string, Record<string, Handler>> = {
  '/api/analyses': { GET: listAnalyses, POST: postAnalyses },
  '/api/mcp': { GET: mcpGet, POST: mcpPost, DELETE: mcpDelete },
};

export interface WebServer {
  url: string;
  close(): Promise<void>;
}

export async function startWebServer(): Promise<WebServer> {
  const server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const host = req.headers.host ?? '127.0.0.1';
    const url = new URL(req.url ?? '/', `http://${host}`);
    const handler = ROUTES[url.pathname]?.[req.method ?? 'GET'];
    if (!handler) {
      res.writeHead(404).end();
      return;
    }
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
    const body = chunks.length && req.method !== 'GET' ? Buffer.concat(chunks) : undefined;
    const response = await handler(new Request(url, { method: req.method, headers, body }));
    res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    res.end(Buffer.from(await response.arrayBuffer()));
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}

export interface ToolCallResult {
  isError?: boolean;
  content: { type: string; text: string }[];
}

/** The bridge launched as an agent launches it: stdio JSON-RPC, one message per line. */
export class BridgeClient {
  private child: ChildProcessWithoutNullStreams;
  private buffer = '';
  private nextId = 1;
  private pending = new Map<number, (msg: any) => void>();
  readonly stderr: string[] = [];

  constructor(args: string[], env: Record<string, string | undefined> = {}, script = BRIDGE) {
    this.child = spawn(process.execPath, [script, ...args], { env: { ...process.env, NODE_OPTIONS: '', ...env } });
    this.child.stdout.on('data', (d: Buffer) => {
      this.buffer += d.toString();
      let nl: number;
      while ((nl = this.buffer.indexOf('\n')) >= 0) {
        const line = this.buffer.slice(0, nl).trim();
        this.buffer = this.buffer.slice(nl + 1);
        if (!line) continue;
        const msg = JSON.parse(line);
        this.pending.get(msg.id)?.(msg);
        this.pending.delete(msg.id);
      }
    });
    this.child.stderr.on('data', (d: Buffer) => this.stderr.push(d.toString()));
  }

  request(method: string, params: unknown = {}, timeoutMs = 60_000): Promise<any> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`bridge did not answer ${method}: ${this.stderr.join('')}`)), timeoutMs);
      this.pending.set(id, (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
      this.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    });
  }

  notify(method: string, params: unknown = {}): void {
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`);
  }

  async initialize(): Promise<any> {
    const res = await this.request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test-agent', version: '0' } });
    this.notify('notifications/initialized');
    return res;
  }

  async callTool(name: string, args: Record<string, unknown> = {}, timeoutMs?: number): Promise<ToolCallResult> {
    const res = await this.request('tools/call', { name, arguments: args }, timeoutMs);
    if (res.error) throw new Error(`JSON-RPC error: ${JSON.stringify(res.error)}`);
    return res.result as ToolCallResult;
  }

  async close(): Promise<void> {
    this.child.stdin.end();
    if (this.child.exitCode === null) {
      await new Promise<void>((r) => {
        const t = setTimeout(() => {
          this.child.kill();
          r();
        }, 2000);
        this.child.once('exit', () => {
          clearTimeout(t);
          r();
        });
      });
    }
  }
}
