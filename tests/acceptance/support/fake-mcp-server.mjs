// Stub engine for the 007 web scenarios: an MCP stdio server (TS SDK) with the engine's analyze_project tool.
// Launched by the web through a fake JDK (`<fake>/bin/java -jar <jar> --mcp` -> this script), so the real
// locator, client and runner are exercised. Its behaviour is read, on every call, from the JSON file named by
// FAKE_ENGINE_CONTROL (so a scenario can change it between calls without restarting the web):
//   delayMs        total time of an analysis (spread over the four phases)
//   phases         send progress notifications when the client asks for them (default true)
//   burst          send the four progress notifications back to back, right before the answer (014 BUG-010)
//   warnings       warning templates; "{projectPath}" is replaced by the analyzed path
//   stderr         lines written to stderr before answering
//   fail           error message template returned with isError (after stderr)
//   crash          exit the process when a call arrives
//   noSpace        answer "Analysis failed: No space left on device" (disk full while writing results)
//   launchCounter  file that gets one line per process start
//   intervalsLog   file that gets one JSON line {projectPath,start,end} per call
//   callsLog       file that gets one JSON line {name,args} per reinfer_architecture / score_proposal call (010)
//   reinferFail    error message returned by reinfer_architecture (010)
//   scoreFail      error message returned by score_proposal (010)
//   scoreInvalid   score_proposal answers a body that violates the contract (010)
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
    inputSchema: { projectPath: z.string(), outputDir: z.string().optional(), language: z.string().optional(), config: z.record(z.any()).optional() },
  },
  async ({ projectPath, outputDir, language, config }, extra) => {
    // 026: the call (with its extraction config, when any) is recorded like the inference tools.
    const ctl = recordCall('analyze_project', config === undefined ? { projectPath, language } : { projectPath, language, config });
    if (config !== undefined && ctl.rejectConfig) {
      return { content: [{ type: 'text', text: String(ctl.rejectConfig) }], isError: true };
    }
    const start = Date.now();
    if (ctl.crash) process.exit(3);
    const token = extra?._meta?.progressToken;
    const phases = ['detection', 'extraction', 'inference', 'writing'];
    const delay = Number(ctl.delayMs ?? 0);
    for (let i = 0; i < phases.length; i++) {
      if (token !== undefined && ctl.phases !== false && ctl.burst) {
        void extra.sendNotification({
          method: 'notifications/progress',
          params: { progressToken: token, progress: i + 1, total: 4, message: phases[i] },
        });
        continue;
      }
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

// --- 010-modernization-ux: inference tools and the configuration defaults resource ----------------------

function recordCall(name, args) {
  const ctl = control();
  if (ctl.callsLog) appendFileSync(ctl.callsLog, `${JSON.stringify({ name, args })}\n`);
  return ctl;
}

const configShape = { config: z.record(z.any()).optional(), configPath: z.string().optional() };

server.registerTool(
  'reinfer_architecture',
  {
    description: 'stub reinfer_architecture',
    inputSchema: { graphPath: z.string().optional(), jobId: z.string().optional(), minViability: z.string().optional(), ...configShape },
  },
  async (args) => {
    const ctl = recordCall('reinfer_architecture', args);
    if (ctl.reinferFail) return { content: [{ type: 'text', text: ctl.reinferFail }], isError: true };
    const architecture = JSON.parse(readFileSync(path.join(fixtures, 'java-standar', 'output_architecture.json'), 'utf8'));
    return { content: [{ type: 'text', text: JSON.stringify(architecture, null, 2) }] };
  },
);

server.registerTool(
  'score_proposal',
  {
    description: 'stub score_proposal',
    inputSchema: { components: z.array(z.string()), graphPath: z.string().optional(), jobId: z.string().optional(), ...configShape },
  },
  async (args) => {
    const ctl = recordCall('score_proposal', args);
    if (ctl.scoreFail) return { content: [{ type: 'text', text: ctl.scoreFail }], isError: true };
    const score = ctl.scoreInvalid
      ? { name: 'broken', viability: 'Excelente' }
      : {
          meta: { schema_version: '1.0.0' },
          name: 'Propuesta editada',
          viability: 'Media',
          score: 0.61,
          metrics: { cohesion_adjusted: 0.7, external_coupling: 0.2, data_cohesion: 0.5, internal_edge_density: 0.4, size: args.components.length, cluster_count: 1 },
          components: args.components,
          clusters: [1],
          rationale: ['stub rationale'],
          recommended_actions: ['stub action'],
        };
    return { content: [{ type: 'text', text: JSON.stringify(score, null, 2) }] };
  },
);

server.registerResource(
  'configuration-defaults',
  'static-inference://configuration/defaults',
  { mimeType: 'application/json' },
  async (uri) => ({
    contents: [{ uri: uri.href, mimeType: 'application/json', text: readFileSync(path.resolve(here, '..', 'fixtures', 'inference-defaults.json'), 'utf8') }],
  }),
);

await server.connect(new StdioServerTransport());
