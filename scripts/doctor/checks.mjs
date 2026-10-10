// dev-arch doctor checks (012-install-doctor-docker). Pure with respect to the system: every probe goes through
// the injected `sys` object (see system.mjs for the real one), so the unit tests mock each OS and tool.
import path from 'node:path';
import { PLATFORM_HINTS, REQUIREMENTS, requirement } from './requirements.mjs';

export const OK = 'OK';
export const WARN = 'WARN';
export const FAIL = 'FAIL';
export const MODES = ['local', 'docker'];
export const PORT = 9002;
const GIB = 1024 ** 3;
export const MIN_RAM_BYTES = 4 * GIB;
export const MIN_DISK_BYTES = 2 * GIB;

/**
 * @typedef {{ code: number, stdout: string, stderr: string }} ExecResult
 * @typedef {{
 *   platform: string, env: Record<string, string | undefined>, productRoot: string, nodeVersion: string,
 *   exec: (file: string, args: string[]) => Promise<ExecResult | null>,
 *   exists: (p: string) => boolean, readFile: (p: string) => string | null,
 *   totalmem: () => number, freeDisk: (dir: string) => number | null, tmpdir: string,
 *   portFree: (port: number) => Promise<boolean>, fetchHealth: (port: number) => Promise<any>
 * }} Sys
 * @typedef {{ id: string, name: string, status: string, detected: string, required: string, requiredFor: string,
 *   detail: string, fix: string[] }} Check
 */

/** Parses "17.0.9", "1.8.0_392", "21" into [major, minor, patch]; null when no version is present. */
export function parseVersion(text) {
  const m = /(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(String(text ?? ''));
  if (!m) return null;
  return [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)];
}

/** a >= b for [major, minor, patch] tuples. */
export function atLeast(a, b) {
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return true;
}

/** Java major version from `java -version` output ("1.8" means 8). */
export function javaMajor(output) {
  const m = /version "([^"]+)"/.exec(output) ?? /openjdk (\d[\w.]*)/i.exec(output);
  if (!m) return null;
  const v = parseVersion(m[1]);
  if (!v) return null;
  return { major: v[0] === 1 ? v[1] : v[0], text: m[1] };
}

/** Versions listed by `dotnet --list-sdks` ("10.0.105 [/path]"). */
export function parseSdks(output) {
  return String(output).split(/\r?\n/).map((l) => /^(\d+\.\d+\.\d+\S*)\s+\[/.exec(l.trim())?.[1]).filter(Boolean);
}

/** Microsoft.NETCore.App versions listed by `dotnet --list-runtimes`. */
export function parseRuntimes(output) {
  return String(output).split(/\r?\n/).map((l) => /^Microsoft\.NETCore\.App\s+(\d+\.\d+\.\d+\S*)/.exec(l.trim())?.[1]).filter(Boolean);
}

const exe = (sys, name) => (sys.platform === 'win32' ? `${name}.exe` : name);
const cmd = (sys, name) => (sys.platform === 'win32' ? `${name}.cmd` : name);
const out = (r) => `${r?.stdout ?? ''}\n${r?.stderr ?? ''}`;

/** Install hints of the platform for a requirement (empty commands are left out). */
export function hintsFor(id, platform) {
  const keys = PLATFORM_HINTS[platform] ?? PLATFORM_HINTS.linux;
  const r = requirement(id);
  return keys.filter((k) => r.hints[k]).map((k) => `${k}: ${r.hints[k]}`);
}

function result(sys, id, status, detected, detail = '') {
  const r = requirement(id);
  return {
    id,
    name: r.name,
    status,
    detected: detected || 'not found',
    required: r.minimum,
    requiredFor: r.requiredFor,
    detail,
    fix: status === OK ? [] : hintsFor(id, sys.platform),
  };
}

/** Product version (VERSION at the product root). */
export function productVersion(sys) {
  return (sys.readFile(path.join(sys.productRoot, 'VERSION')) ?? '').trim() || 'unknown';
}

export function javaBin(sys) {
  const home = sys.env.JAVA_HOME?.trim();
  return home ? path.join(home, 'bin', exe(sys, 'java')) : 'java';
}

export function dotnetBin(sys) {
  const root = sys.env.DOTNET_ROOT?.trim();
  if (root) {
    const candidate = path.join(root, exe(sys, 'dotnet'));
    if (sys.exists(candidate)) return candidate;
  }
  return 'dotnet';
}

// --- individual checks ------------------------------------------------------------------------------------------

export async function checkJdk(sys, ctx) {
  const bin = javaBin(sys);
  if (sys.env.JAVA_HOME?.trim() && !sys.exists(bin)) {
    return result(sys, 'jdk', FAIL, '', `JAVA_HOME=${sys.env.JAVA_HOME} has no bin/${exe(sys, 'java')}`);
  }
  const r = await sys.exec(bin, ['-version']);
  const v = r && r.code === 0 ? javaMajor(out(r)) : null;
  if (!v) return result(sys, 'jdk', FAIL, '', 'java was not found on PATH or JAVA_HOME');
  ctx.java = v.major >= 17 ? bin : null;
  return v.major >= 17
    ? result(sys, 'jdk', OK, v.text, sys.env.JAVA_HOME ? `JAVA_HOME=${sys.env.JAVA_HOME}` : 'java on PATH')
    : result(sys, 'jdk', FAIL, v.text, 'JDK 17 or newer is required');
}

export async function checkMaven(sys) {
  const r = await sys.exec(cmd(sys, 'mvn'), ['-v']);
  const m = r && r.code === 0 ? /Apache Maven (\d+\.\d+(?:\.\d+)?)/.exec(out(r)) : null;
  if (m) {
    return atLeast(parseVersion(m[1]), [3, 6, 0])
      ? result(sys, 'maven', OK, m[1])
      : result(sys, 'maven', FAIL, m[1], 'Maven 3.6 or newer is required');
  }
  const wrapper = path.join(sys.productRoot, 'engine', sys.platform === 'win32' ? 'mvnw.cmd' : 'mvnw');
  if (sys.exists(wrapper)) return result(sys, 'maven', OK, 'Maven wrapper', 'engine/mvnw is used when mvn is not installed');
  return result(sys, 'maven', FAIL, '', 'mvn was not found on PATH and there is no engine/mvnw');
}

export async function checkDotnetSdk(sys) {
  const r = await sys.exec(dotnetBin(sys), ['--list-sdks']);
  if (!r || r.code !== 0) return result(sys, 'dotnet-sdk', FAIL, '', 'dotnet was not found (PATH or DOTNET_ROOT)');
  const sdks = parseSdks(r.stdout);
  const ok = sdks.filter((v) => parseVersion(v)[0] >= 8);
  return ok.length
    ? result(sys, 'dotnet-sdk', OK, sdks.join(', '))
    : result(sys, 'dotnet-sdk', FAIL, sdks.join(', '), 'a .NET SDK 8.0 or newer is required');
}

export async function checkDotnetRuntime(sys) {
  const r = await sys.exec(dotnetBin(sys), ['--list-runtimes']);
  if (!r || r.code !== 0) return result(sys, 'dotnet-runtime', FAIL, '', 'dotnet was not found (PATH or DOTNET_ROOT)');
  const runtimes = parseRuntimes(r.stdout);
  const eight = runtimes.filter((v) => parseVersion(v)[0] === 8);
  return eight.length
    ? result(sys, 'dotnet-runtime', OK, runtimes.join(', '), `runtime 8 found (${eight.join(', ')})`)
    : result(sys, 'dotnet-runtime', FAIL, runtimes.join(', '), 'the analyzer targets .NET 8: install a .NET 8 runtime');
}

export async function checkNode(sys) {
  const node = parseVersion(sys.nodeVersion);
  const r = await sys.exec(cmd(sys, 'npm'), ['-v']);
  const npm = r && r.code === 0 ? parseVersion(r.stdout) : null;
  const detected = `node ${sys.nodeVersion.replace(/^v/, '')} / npm ${npm ? npm.join('.') : 'not found'}`;
  if (!node || node[0] < 20) return result(sys, 'node', FAIL, detected, 'Node 20 or newer is required');
  if (!npm || npm[0] < 10) return result(sys, 'node', FAIL, detected, 'npm 10 or newer is required');
  return result(sys, 'node', OK, detected);
}

/** Engine archive used by the web: ENGINE_JAR_PATH (relative to web/) or web/engine-dist/engine.jar. */
export function engineJarPath(sys) {
  const web = path.join(sys.productRoot, 'web');
  const override = sys.env.ENGINE_JAR_PATH?.trim();
  return override ? path.resolve(web, override) : path.join(web, 'engine-dist', 'engine.jar');
}

/** Runs `java -jar engine.jar --doctor` and parses its JSON line; null when unavailable. */
export async function queryEngine(sys, java, jar) {
  const r = await sys.exec(java, ['-jar', jar, '--doctor']);
  if (!r || r.code !== 0) return null;
  const line = r.stdout.split(/\r?\n/).map((l) => l.trim()).find((l) => l.startsWith('{'));
  try {
    return line ? JSON.parse(line) : null;
  } catch {
    return null;
  }
}

export async function checkEngineJar(sys, ctx) {
  const jar = engineJarPath(sys);
  ctx.jar = null;
  if (!sys.exists(jar)) {
    const status = sys.env.ENGINE_JAR_PATH?.trim() ? FAIL : WARN;
    return result(sys, 'engine-jar', status, '', `${jar} not found: run \`make build\`` + (status === FAIL ? ' or fix ENGINE_JAR_PATH' : ''));
  }
  ctx.jar = jar;
  // Without a JDK 17 the version cannot be read; the JDK check already fails, the archive itself is not the problem.
  if (!ctx.java) return result(sys, 'engine-jar', OK, 'present', `${jar} found; version not checked without a JDK 17`);
  const info = await queryEngine(sys, ctx.java, jar);
  ctx.engine = info;
  if (!info) return result(sys, 'engine-jar', WARN, 'present', `${jar} does not answer --doctor: rebuild it with \`make build\``);
  const want = productVersion(sys);
  return info.version === want
    ? result(sys, 'engine-jar', OK, info.version, `${jar} (schema ${info.schema_version})`)
    : result(sys, 'engine-jar', WARN, info.version, `${jar} is version ${info.version}, VERSION is ${want}: run \`make build\``);
}

/** Locates dotnet-analyzer like the engine (DotNetToolLocator): next to the jar, DOTNET_ANALYZER_PATH, PATH. */
export function locateAnalyzer(sys, jar) {
  const names = sys.platform === 'win32' ? ['dotnet-analyzer.exe', 'dotnet-analyzer'] : ['dotnet-analyzer'];
  const inDir = (dir) => names.map((n) => path.join(dir, n)).find((p) => sys.exists(p)) ?? null;
  if (jar) {
    const sibling = inDir(path.dirname(jar));
    if (sibling) return sibling;
  }
  const override = sys.env.DOTNET_ANALYZER_PATH?.trim();
  if (override) {
    const hit = inDir(override) ?? (sys.exists(override) && path.basename(override).includes('dotnet-analyzer') ? override : null);
    if (hit) return hit;
  }
  const sep = sys.platform === 'win32' ? ';' : ':';
  for (const dir of (sys.env.PATH ?? sys.env.Path ?? '').split(sep).filter(Boolean)) {
    const hit = inDir(dir);
    if (hit) return hit;
  }
  return null;
}

/** Analyzer version from its publish manifest (dotnet-analyzer.deps.json next to it or in dotnet-analyzer-publish/). */
export function analyzerVersion(sys, analyzer) {
  const dir = path.dirname(analyzer);
  for (const deps of [path.join(dir, 'dotnet-analyzer.deps.json'), path.join(dir, 'dotnet-analyzer-publish', 'dotnet-analyzer.deps.json')]) {
    const text = sys.readFile(deps);
    const m = text ? /"(?:dotnet-analyzer|DotNetAnalyzer)\/(\d+\.\d+\.\d+[^"]*)"/.exec(text) : null;
    if (m) return m[1];
  }
  return null;
}

export async function checkDotnetAnalyzer(sys, ctx) {
  const reported = ctx.engine?.dotnet_analyzer;
  const analyzer = reported?.found ? reported.path : locateAnalyzer(sys, ctx.jar);
  if (!analyzer) return result(sys, 'dotnet-analyzer', WARN, '', '.NET / VB analysis is unavailable until `make build` publishes dotnet-analyzer');
  const version = analyzerVersion(sys, analyzer);
  const want = productVersion(sys);
  if (version === want) return result(sys, 'dotnet-analyzer', OK, version, analyzer);
  return result(sys, 'dotnet-analyzer', WARN, version ?? 'present', version
    ? `${analyzer} is version ${version}, VERSION is ${want}: run \`make build\``
    : `${analyzer}: version unknown (no dotnet-analyzer.deps.json)`);
}

export async function checkVsBuildTools(sys) {
  if (sys.platform !== 'win32') return result(sys, 'vs-build-tools', OK, 'not applicable', `only required on Windows (this is ${sys.platform})`);
  const base = sys.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)';
  const vswhere = path.win32.join(base, 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  const r = sys.exists(vswhere)
    ? await sys.exec(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.Component.MSBuild', '-property', 'installationVersion'])
    : null;
  const v = r && r.code === 0 ? parseVersion(r.stdout) : null;
  if (v && v[0] >= 17) return result(sys, 'vs-build-tools', OK, v.join('.'));
  return result(sys, 'vs-build-tools', WARN, v ? v.join('.') : '', 'full VB legacy analysis needs Visual Studio Build Tools 17 (MSBuild)');
}

export async function checkDocker(sys, ctx) {
  const missing = ctx.mode === 'docker' ? FAIL : WARN;
  const server = await sys.exec(exe(sys, 'docker'), ['version', '--format', '{{.Server.Version}}']);
  const client = server && server.code === 0 ? null : await sys.exec(exe(sys, 'docker'), ['--version']);
  if (!server && !client) return result(sys, 'docker', missing, '', 'docker was not found' + (ctx.mode === 'local' ? ' (only needed for the container mode)' : ''));
  const daemon = server && server.code === 0 ? parseVersion(server.stdout) : null;
  const dockerV = daemon ?? (client && client.code === 0 ? parseVersion(/version ([\d.]+)/i.exec(client.stdout)?.[1]) : null);
  const compose = await sys.exec(exe(sys, 'docker'), ['compose', 'version', '--short']);
  const composeV = compose && compose.code === 0 ? parseVersion(compose.stdout.replace(/^v/, '')) : null;
  const detected = `docker ${dockerV ? dockerV.join('.') : 'unknown'} / compose ${composeV ? composeV.join('.') : 'not found'}`;
  if (!dockerV || dockerV[0] < 24) return result(sys, 'docker', missing, detected, 'Docker 24 or newer is required for the container mode');
  if (!composeV || composeV[0] < 2) return result(sys, 'docker', missing, detected, 'the Compose v2 plugin (`docker compose`) is required');
  if (!daemon) return result(sys, 'docker', missing, detected, 'the Docker daemon is not reachable (start Docker)');
  return result(sys, 'docker', OK, detected);
}

export async function checkEnv(sys, ctx) {
  const env = sys.env;
  const dotEnv = ctx.mode === 'docker' ? sys.readFile(path.join(sys.productRoot, 'docker', '.env')) ?? '' : '';
  const key = ['GEMINI_API_KEY', 'GOOGLE_GENAI_API_KEY'].find((k) => env[k]?.trim() || new RegExp(`^${k}=\\S+`, 'm').test(dotEnv));
  const notes = [];
  notes.push(env.LLM_MODEL?.trim() ? `LLM_MODEL=${env.LLM_MODEL}` : 'LLM_MODEL unset (default model)');
  if (ctx.mode === 'local' && env.ENGINE_JAR_PATH?.trim()) {
    const jar = engineJarPath(sys);
    if (!sys.exists(jar)) return result(sys, 'env', FAIL, `ENGINE_JAR_PATH=${env.ENGINE_JAR_PATH}`, `ENGINE_JAR_PATH points to a missing file (${jar})`);
    notes.push(`ENGINE_JAR_PATH=${env.ENGINE_JAR_PATH}`);
  }
  if (!key) return result(sys, 'env', WARN, notes.join('; '), 'GEMINI_API_KEY / GOOGLE_GENAI_API_KEY unset: AI features are disabled; static analysis works');
  return result(sys, 'env', OK, `${key} set`, notes.join('; '));
}

export async function checkPort(sys) {
  if (await sys.portFree(PORT)) return result(sys, 'port', OK, `${PORT} free`);
  const health = await sys.fetchHealth(PORT);
  if (health && health.service === 'dev-arch') {
    return result(sys, 'port', OK, `${PORT} served by dev-arch`, `dev-arch ${health.version ?? ''} health ${health.status ?? ''}`.trim());
  }
  return result(sys, 'port', WARN, `${PORT} in use`, `port ${PORT} is used by another process: free it before starting the web`);
}

export async function checkResources(sys) {
  const ram = sys.totalmem();
  const disk = sys.freeDisk(sys.tmpdir);
  const gb = (b) => `${(b / GIB).toFixed(1)} GB`;
  const detected = `RAM ${gb(ram)}, temporary disk ${disk === null ? 'unknown' : gb(disk)}`;
  const problems = [];
  if (ram < MIN_RAM_BYTES) problems.push('less than 4 GB of RAM: large analyses may fail');
  if (disk !== null && disk < MIN_DISK_BYTES) problems.push(`less than 2 GB free in ${sys.tmpdir}`);
  return problems.length ? result(sys, 'resources', WARN, detected, problems.join('; ')) : result(sys, 'resources', OK, detected);
}

const CHECKS = {
  jdk: checkJdk,
  maven: checkMaven,
  'dotnet-sdk': checkDotnetSdk,
  'dotnet-runtime': checkDotnetRuntime,
  node: checkNode,
  'engine-jar': checkEngineJar,
  'dotnet-analyzer': checkDotnetAnalyzer,
  'vs-build-tools': checkVsBuildTools,
  docker: checkDocker,
  env: checkEnv,
  port: checkPort,
  resources: checkResources,
};

/** Overall status: FAIL if any check fails, WARN if any warns, OK otherwise. */
export function overall(checks) {
  if (checks.some((c) => c.status === FAIL)) return FAIL;
  if (checks.some((c) => c.status === WARN)) return WARN;
  return OK;
}

/**
 * Runs the checks of a mode (in the order of REQUIREMENTS); `only` narrows them to some ids.
 * The JDK check always runs before the engine checks that need it.
 */
export async function runDoctor(sys, { mode = 'local', only = null } = {}) {
  if (!MODES.includes(mode)) throw new Error(`unknown mode ${mode} (expected ${MODES.join(' or ')})`);
  const ids = REQUIREMENTS.filter((r) => r.modes.includes(mode)).map((r) => r.id).filter((id) => !only || only.includes(id));
  const ctx = { mode, java: null, jar: null, engine: null };
  if (!ids.includes('jdk') && (ids.includes('engine-jar') || ids.includes('dotnet-analyzer'))) await checkJdk(sys, ctx);
  if (!ids.includes('engine-jar') && ids.includes('dotnet-analyzer')) await checkEngineJar(sys, ctx);
  const checks = [];
  for (const id of ids) checks.push(await CHECKS[id](sys, ctx));
  return {
    tool: 'dev-arch doctor',
    version: productVersion(sys),
    mode,
    platform: sys.platform,
    status: overall(checks),
    checks,
    engine: ctx.engine,
  };
}
