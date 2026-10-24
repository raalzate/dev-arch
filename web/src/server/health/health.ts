// GET /api/health (012-install-doctor-docker): runtime health of the web, built from the same doctor module as
// `npm run doctor` (scripts/doctor) plus the live state of the engine process. Pure: the route injects the doctor
// runner, the environment and the engine process probe.
import { execFile } from 'node:child_process';
import path from 'node:path';
import { AGENT_MCP_BRIDGE, AGENT_MCP_ENDPOINT, AGENT_TOOL_NAMES } from '../agent-mcp/catalog';
import type { Env } from '../config';

export type DoctorStatus = 'OK' | 'WARN' | 'FAIL';

export interface DoctorCheck {
  id: string;
  name: string;
  status: DoctorStatus;
  detected: string;
  required: string;
  requiredFor: string;
  detail: string;
  fix: string[];
}

export interface DoctorReport {
  tool: string;
  version: string;
  mode: string;
  platform: string;
  status: DoctorStatus;
  checks: DoctorCheck[];
  engine: { version?: string; schema_version?: string; dotnet_analyzer?: { found: boolean; path: string | null } } | null;
}

export interface HealthBody {
  service: 'dev-arch';
  status: DoctorStatus;
  version: string;
  engine: {
    jar: { found: boolean; version: string | null; detail: string };
    dotnetAnalyzer: { found: boolean; detail: string };
    mcpProcess: 'running' | 'idle';
  };
  checks: DoctorCheck[];
  /** Agent MCP endpoint (013 FR-020). */
  agentMcp: { endpoint: string; bridge: string; tools: number };
}

/** Doctor checks that describe the running web (no build tools, no Docker, no port: the server holds it). */
export const HEALTH_CHECKS = ['jdk', 'dotnet-runtime', 'engine-jar', 'dotnet-analyzer', 'env', 'resources'] as const;

/** Cache lifetime of a doctor run: a healthcheck every few seconds must not start a JVM each time. */
export const HEALTH_TTL_MS = 30_000;

export type DoctorRunner = (cli: string, args: string[]) => Promise<{ code: number; stdout: string; stderr: string }>;

export interface HealthDeps {
  env: Env;
  cwd: string;
  runDoctor: DoctorRunner;
  enginePid: () => number | null;
  now: () => number;
}

/** scripts/doctor/cli.mjs of the product (DEVARCH_DOCTOR_CLI overrides; the web runs from web/ of the product). */
export function doctorCliPath(env: Env, cwd: string): string {
  const override = env.DEVARCH_DOCTOR_CLI?.trim();
  return override ? path.resolve(cwd, override) : path.resolve(cwd, '..', 'scripts', 'doctor', 'cli.mjs');
}

/** Runs the doctor CLI with the current Node binary. */
export const nodeDoctorRunner: DoctorRunner = (cli, args) =>
  new Promise((resolve) => {
    execFile(process.execPath, [cli, ...args], { timeout: 120_000, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
      const code = err ? (typeof err.code === 'number' ? err.code : 2) : 0;
      resolve({ code, stdout: String(stdout ?? ''), stderr: String(stderr ?? err?.message ?? '') });
    });
  });

function failedDoctor(message: string): DoctorReport {
  return {
    tool: 'dev-arch doctor',
    version: 'unknown',
    mode: 'local',
    platform: process.platform,
    status: 'FAIL',
    checks: [{ id: 'doctor', name: 'doctor', status: 'FAIL', detected: 'unavailable', required: 'scripts/doctor', requiredFor: 'health', detail: message, fix: [] }],
    engine: null,
  };
}

/** Runs the doctor in JSON mode on the health checks; a missing or broken doctor is a FAIL report. */
export async function runHealthDoctor(deps: Pick<HealthDeps, 'env' | 'cwd' | 'runDoctor'>): Promise<DoctorReport> {
  const cli = doctorCliPath(deps.env, deps.cwd);
  const r = await deps.runDoctor(cli, ['--json', '--mode', 'local', '--only', HEALTH_CHECKS.join(',')]);
  try {
    const report = JSON.parse(r.stdout) as DoctorReport;
    if (!Array.isArray(report.checks)) throw new Error('no checks');
    return report;
  } catch {
    return failedDoctor(`doctor ${cli} did not produce a report (exit ${r.code}): ${r.stderr.trim().slice(0, 300)}`);
  }
}

/** Health body and HTTP status (200 unless a check FAILs: 503). */
export function toHealth(report: DoctorReport, pid: number | null): { status: number; body: HealthBody } {
  const jar = report.checks.find((c) => c.id === 'engine-jar');
  const analyzer = report.checks.find((c) => c.id === 'dotnet-analyzer');
  const found = (c: DoctorCheck | undefined) => !!c && c.detected !== 'not found';
  const body: HealthBody = {
    service: 'dev-arch',
    status: report.status,
    version: report.version,
    engine: {
      jar: { found: found(jar), version: report.engine?.version ?? null, detail: jar?.detail ?? '' },
      dotnetAnalyzer: { found: found(analyzer), detail: analyzer?.detail ?? '' },
      mcpProcess: pid ? 'running' : 'idle',
    },
    checks: report.checks,
    agentMcp: { endpoint: AGENT_MCP_ENDPOINT, bridge: AGENT_MCP_BRIDGE, tools: AGENT_TOOL_NAMES.length },
  };
  return { status: report.status === 'FAIL' ? 503 : 200, body };
}

type Cache = { at: number; report: DoctorReport } | null;
let cache: Cache = null;

/** Test seam: forget the cached doctor run. */
export function resetHealthCache(): void {
  cache = null;
}

/** Health of the running web; the doctor result is reused for HEALTH_TTL_MS, the engine process state is live. */
export async function health(deps: HealthDeps): Promise<{ status: number; body: HealthBody }> {
  const now = deps.now();
  if (!cache || now - cache.at >= HEALTH_TTL_MS) cache = { at: now, report: await runHealthDoctor(deps) };
  return toHealth(cache.report, deps.enginePid());
}
