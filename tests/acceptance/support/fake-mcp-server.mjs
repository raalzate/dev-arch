// Stub engine for the 007 web scenarios: an MCP stdio server (TS SDK) with the engine's analyze_project tool.
// Launched by the web through a fake JDK (`<fake>/bin/java -jar <jar> --mcp` -> this script), so the real
// locator, client and runner are exercised. Its behaviour is read, on every call, from the JSON file named by
// FAKE_ENGINE_CONTROL (so a scenario can change it between calls without restarting the web):
//   delayMs        total time of an analysis (spread over the four phases)
//   phases         send progress notifications when the client asks for them (default true)
//   warnings       warning templates; "{projectPath}" is replaced by the analyzed path
//   stderr         lines written to stderr before answering
//   fail           error message template returned with isError (after stderr)
//   crash          exit the process when a call arrives
//   noSpace        answer "Analysis failed: No space left on device" (disk full while writing results)
//   launchCounter  file that gets one line per process start
//   intervalsLog   file that gets one JSON line {projectPath,start,end} per call
// Documents are the contract fixtures of java-standar with component files rebased under the analyzed path.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.resolve(here, '../../../schema/fixtures/valid');

function control() {
  const file = process.env.FAKE_ENGINE_CONTROL;
  if (!file || !existsSync(file)) return {};
  return JSON.parse(readFileSync(file, 'utf8'));
}

const startCtl = control();
if (startCtl.launchCounter) appendFileSync(startCtl.launchCounter, `${process.pid}\n`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fill = (t, projectPath) => String(t).split('{projectPath}').join(projectPath);

function documents(projectPath) {
  const read = (f) => JSON.parse(readFileSync(path.join(fixtures, 'java-standar', f), 'utf8'));
  const graph = read('output.json');
  for (const c of graph.components) {
    c.files = (c.files ?? []).map((f) => path.join(projectPath, f.replace(/^.*?java-standar\//, '')));
  }
  return { graph, architecture: read('output_architecture.json'), entrypoints: read('output_entrypoints.json') };
}

// CLI mode (`java -jar <jar> <projectPath> <outputFile>`, the deprecated synchronous route): write and exit.
const cliArgs = process.argv.slice(2).filter((a) => a !== '-jar' && !a.endsWith('.jar'));
if (!process.argv.includes('--mcp') && cliArgs.length >= 2) {
  const [projectPath, outputFile] = cliArgs;
  const docs = documents(projectPath);
  writeFileSync(outputFile, JSON.stringify(docs.graph, null, 2));
  writeFileSync(outputFile.replace('.json', '_architecture.json'), JSON.stringify(docs.architecture, null, 2));
  writeFileSync(outputFile.replace('.json', '_entrypoints.json'), JSON.stringify(docs.entrypoints, null, 2));
  process.exit(0);
}

const server = new McpServer({ name: 'static-inference', version: 'stub' });

server.registerTool(
  'analyze_project',
  {
    description: 'stub analyze_project',
    inputSchema: { projectPath: z.string(), outputDir: z.string().optional(), language: z.string().optional() },
  },
  async ({ projectPath, outputDir, language }, extra) => {
    const ctl = control();
    const start = Date.now();
    if (ctl.crash) process.exit(3);
    const token = extra?._meta?.progressToken;
    const phases = ['detection', 'extraction', 'inference', 'writing'];
    const delay = Number(ctl.delayMs ?? 0);
    for (let i = 0; i < phases.length; i++) {
      if (token !== undefined && ctl.phases !== false) {
        await extra.sendNotification({
          method: 'notifications/progress',
          params: { progressToken: token, progress: i + 1, total: 4, message: phases[i] },
        });
      }
      if (delay > 0) await sleep(delay / phases.length);
    }
    for (const line of ctl.stderr ?? []) process.stderr.write(`${fill(line, projectPath)}\n`);
    const end = Date.now();
    if (ctl.intervalsLog) appendFileSync(ctl.intervalsLog, `${JSON.stringify({ projectPath, start, end, language })}\n`);
    if (ctl.noSpace) {
      return { content: [{ type: 'text', text: 'Analysis failed: No space left on device' }], isError: true };
    }
    const failWarnings = (ctl.warnings ?? []).map((w) => fill(w, projectPath));
    if (ctl.fail) {
      return {
        content: [{ type: 'text', text: fill(ctl.fail, projectPath) }],
        isError: true,
        ...(failWarnings.length ? { _meta: { 'static-inference/warnings': failWarnings } } : {}),
      };
    }
    const out = outputDir || projectPath;
    mkdirSync(out, { recursive: true });
    const docs = documents(projectPath);
    const files = ['output.json', 'output_architecture.json', 'output_entrypoints.json'].map((f) => path.join(out, f));
    writeFileSync(files[0], JSON.stringify(docs.graph, null, 2));
    writeFileSync(files[1], JSON.stringify(docs.architecture, null, 2));
    writeFileSync(files[2], JSON.stringify(docs.entrypoints, null, 2));
    const response = {
      componentCount: docs.graph.components.length,
      edgeCount: docs.graph.edges.length,
      endpointCount: (docs.entrypoints.endpoints ?? []).length,
      filesGenerated: files,
      proposalCount: (docs.architecture.proposals ?? []).length,
      summary: 'stub analysis',
    };
    const warnings = (ctl.warnings ?? []).map((w) => fill(w, projectPath));
    return {
      content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
      ...(warnings.length ? { _meta: { 'static-inference/warnings': warnings } } : {}),
    };
  },
);

await server.connect(new StdioServerTransport());
