// Simulated systems for the doctor unit tests (012-install-doctor-docker): every requirement satisfied by
// default; tests flip one field per scenario. Not used at runtime.
import path from 'node:path';

export const ROOT = '/sim/dev-arch';
export const JAR = path.join(ROOT, 'web', 'engine-dist', 'engine.jar');
export const ANALYZER = '/opt/analyzer/dotnet-analyzer';
export const VSWHERE = path.win32.join('C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
const GIB = 1024 ** 3;

export function state(platform = 'linux') {
  return {
    platform,
    env: { PATH: '/usr/bin', GEMINI_API_KEY: 'k', DOTNET_ANALYZER_PATH: '/opt/analyzer' },
    java: '17.0.9',
    mvn: '3.9.6',
    sdks: ['8.0.100'],
    runtimes: ['8.0.10'],
    node: 'v20.11.0',
    npm: '10.8.2',
    jar: 'ok',
    engineAnalyzer: ANALYZER,
    analyzerVersion: '1.2.0',
    vswhere: true,
    vsVersion: '17.9.34607.119',
    docker: 'ok',
    dockerVersion: '27.1.1',
    compose: '2.29.1',
    portFree: true,
    health: null,
    ram: 16 * GIB,
    disk: 50 * GIB,
    files: [],
    dotEnv: null,
    calls: [],
  };
}

const bare = (file) => path.basename(file.replace(/\\/g, '/')).replace(/\.(exe|cmd)$/i, '');

export function system(s) {
  const files = new Set(s.files);
  if (s.jar !== 'absent') files.add(JAR);
  if (s.engineAnalyzer) files.add(s.engineAnalyzer);
  if (s.env.DOTNET_ANALYZER_PATH && !s.env.DOTNET_ANALYZER_PATH.endsWith('dotnet-analyzer')) files.add(path.join(s.env.DOTNET_ANALYZER_PATH, 'dotnet-analyzer'));
  if (s.vswhere) files.add(VSWHERE);
  const ok = (stdout, stderr = '') => ({ code: 0, stdout, stderr });
  return {
    platform: s.platform,
    env: s.env,
    productRoot: ROOT,
    nodeVersion: s.node,
    async exec(file, args) {
      s.calls.push([file, ...args]);
      const name = bare(file);
      if (name === 'java' && args[0] === '-jar') {
        if (s.jar === 'silent') return { code: 1, stdout: '', stderr: 'usage' };
        if (s.jar === 'garbage') return ok('not json\n');
        const version = s.jar === 'other-version' ? '1.1.0' : '1.2.0';
        const analyzer = s.engineAnalyzer ? { found: true, path: s.engineAnalyzer } : { found: false, path: null };
        return ok(`log line\n${JSON.stringify({ engine: 'static-inference', version, schema_version: '1.0.0', dotnet_analyzer: analyzer })}\n`);
      }
      if (name === 'java') return s.java ? ok('', `openjdk version "${s.java}" 2023-10-17`) : null;
      if (name === 'mvn') return s.mvn ? ok(`Apache Maven ${s.mvn} (x)`) : null;
      if (name === 'dotnet') {
        if (s.dotnet === 'absent') return null;
        if (args[0] === '--list-sdks') return ok(s.sdks.map((v) => `${v} [/usr/share/dotnet/sdk]`).join('\n'));
        return ok(s.runtimes.map((v) => `Microsoft.NETCore.App ${v} [/usr/share/dotnet/shared]`).join('\n'));
      }
      if (name === 'npm') return s.npm ? ok(`${s.npm}\n`) : null;
      if (name === 'docker') {
        if (s.docker === 'absent') return null;
        if (args[0] === 'version') return s.docker === 'daemon-down' ? { code: 1, stdout: '', stderr: 'Cannot connect' } : ok(`${s.dockerVersion}\n`);
        if (args[0] === '--version') return ok(`Docker version ${s.dockerVersion}, build x\n`);
        if (args[0] === 'compose') return s.compose ? ok(`${s.compose}\n`) : { code: 1, stdout: '', stderr: 'unknown command' };
      }
      if (name === 'vswhere') return ok(`${s.vsVersion}\n`);
      return null;
    },
    exists: (p) => files.has(p),
    readFile(p) {
      if (p === path.join(ROOT, 'VERSION')) return '1.2.0\n';
      if (p === path.join(ROOT, 'docker', '.env')) return s.dotEnv;
      if (s.engineAnalyzer && p === path.join(path.dirname(s.engineAnalyzer), 'dotnet-analyzer.deps.json') && s.analyzerVersion) {
        return `{"targets":{"x":{"dotnet-analyzer/${s.analyzerVersion}":{}}}}`;
      }
      return null;
    },
    totalmem: () => s.ram,
    freeDisk: () => s.disk,
    tmpdir: '/tmp',
    portFree: async () => s.portFree,
    fetchHealth: async () => s.health,
  };
}
