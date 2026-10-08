// Minimal MCP stdio client: starts a server command, sends initialize (+ tools/list) and collects responses.
import { spawn } from 'node:child_process';
import { childEnv } from './process.ts';

export interface McpSession {
  initialize: Record<string, unknown>;
  tools: { name: string }[];
  stderr: string;
}

export async function mcpHandshake(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv, timeoutMs = 120_000): Promise<McpSession> {
  const child = spawn(command, args, { cwd, env: childEnv(env), stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  const responses = new Map<number, Record<string, unknown>>();
  const waiters = new Map<number, (r: Record<string, unknown>) => void>();
  child.stderr.on('data', (d) => (stderr += d.toString()));
  child.stdout.on('data', (d) => {
    stdout += d.toString();
    let nl: number;
    while ((nl = stdout.indexOf('\n')) >= 0) {
      const line = stdout.slice(0, nl).trim();
      stdout = stdout.slice(nl + 1);
      if (!line.startsWith('{')) continue;
      try {
        const msg = JSON.parse(line) as { id?: number };
        if (typeof msg.id === 'number') {
          responses.set(msg.id, msg as Record<string, unknown>);
          waiters.get(msg.id)?.(msg as Record<string, unknown>);
        }
      } catch {
        /* not a protocol line */
      }
    }
  });
  const send = (msg: unknown) => child.stdin.write(`${JSON.stringify(msg)}\n`);
  const request = (id: number, method: string, params: unknown) =>
    new Promise<Record<string, unknown>>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`no answer to ${method} within ${timeoutMs} ms; stderr:\n${stderr.slice(-3000)}`)), timeoutMs);
      waiters.set(id, (r) => {
        clearTimeout(timer);
        resolve(r);
      });
      if (responses.has(id)) waiters.get(id)!(responses.get(id)!);
      send({ jsonrpc: '2.0', id, method, params });
    });
  try {
    const init = await request(1, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'devarch-006-acceptance', version: '1.0.0' },
    });
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    const list = await request(2, 'tools/list', {});
    const tools = ((list.result as { tools?: { name: string }[] })?.tools ?? []).map((t) => ({ name: t.name }));
    return { initialize: init, tools, stderr };
  } finally {
    child.kill('SIGTERM');
  }
}
