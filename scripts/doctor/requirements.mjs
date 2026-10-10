// Single definition of the dev-arch system requirements (012-install-doctor-docker, FR-002/FR-020).
// The doctor checks, the `--fix` hints and the requirements table of docs/INSTALL.md are all derived from it.

/** Install hint keys, in display order: macOS (Homebrew), Debian/Ubuntu (apt), Windows (winget, Chocolatey). */
export const HINT_KEYS = ['brew', 'apt', 'winget', 'choco'];

/** Package manager used for the hints of each platform (`process.platform`). */
export const PLATFORM_HINTS = { darwin: ['brew'], linux: ['apt'], win32: ['winget', 'choco'] };

const BUILD = 'make build';

/**
 * @typedef {{ id: string, name: string, requiredFor: string, minimum: string, detection: string,
 *   modes: ('local'|'docker')[], platforms?: string[], hints: Record<string, string> }} Requirement
 * @type {Requirement[]}
 */
export const REQUIREMENTS = [
  {
    id: 'jdk',
    name: 'JDK',
    requiredFor: 'engine runtime and build',
    minimum: '17',
    detection: '`java -version`, `JAVA_HOME`',
    modes: ['local'],
    hints: {
      brew: 'brew install openjdk@17',
      apt: 'sudo apt-get install -y openjdk-17-jdk',
      winget: 'winget install EclipseAdoptium.Temurin.17.JDK',
      choco: 'choco install temurin17',
    },
  },
  {
    id: 'maven',
    name: 'Maven',
    requiredFor: 'engine build (not at runtime)',
    minimum: '3.6',
    detection: '`mvn -v` or `engine/mvnw`',
    modes: ['local'],
    hints: {
      brew: 'brew install maven',
      apt: 'sudo apt-get install -y maven',
      winget: 'winget install Apache.Maven',
      choco: 'choco install maven',
    },
  },
  {
    id: 'dotnet-sdk',
    name: '.NET SDK',
    requiredFor: 'dotnet-analyzer build',
    minimum: '8.0',
    detection: '`dotnet --list-sdks`',
    modes: ['local'],
    hints: {
      brew: 'brew install --cask dotnet-sdk',
      apt: 'sudo apt-get install -y dotnet-sdk-8.0',
      winget: 'winget install Microsoft.DotNet.SDK.8',
      choco: 'choco install dotnet-8.0-sdk',
    },
  },
  {
    id: 'dotnet-runtime',
    name: '.NET runtime',
    requiredFor: 'dotnet-analyzer runtime (framework-dependent)',
    minimum: '8.0 (major 8)',
    detection: '`dotnet --list-runtimes`',
    modes: ['local'],
    hints: {
      brew: 'brew install dotnet@8',
      apt: 'sudo apt-get install -y dotnet-runtime-8.0',
      winget: 'winget install Microsoft.DotNet.Runtime.8',
      choco: 'choco install dotnet-8.0-runtime',
    },
  },
  {
    id: 'node',
    name: 'Node + npm',
    requiredFor: 'web',
    minimum: '20 / 10',
    detection: '`node -v`, `npm -v`',
    modes: ['local'],
    hints: {
      brew: 'brew install node@20',
      apt: 'curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs',
      winget: 'winget install OpenJS.NodeJS.LTS',
      choco: 'choco install nodejs-lts',
    },
  },
  {
    id: 'engine-jar',
    name: 'engine.jar',
    requiredFor: 'web runtime',
    minimum: 'version = `VERSION`',
    detection: '`web/engine-dist/engine.jar`, `ENGINE_JAR_PATH`, `java -jar engine.jar --doctor`',
    modes: ['local'],
    hints: { brew: BUILD, apt: BUILD, winget: BUILD, choco: BUILD },
  },
  {
    id: 'dotnet-analyzer',
    name: 'dotnet-analyzer',
    requiredFor: '.NET / VB analysis',
    minimum: 'version = `VERSION`',
    detection: 'next to the jar, `DOTNET_ANALYZER_PATH`, `PATH` (`.exe` on Windows)',
    modes: ['local'],
    hints: { brew: BUILD, apt: BUILD, winget: BUILD, choco: BUILD },
  },
  {
    id: 'vs-build-tools',
    name: 'VS Build Tools / MSBuild',
    requiredFor: 'full VB legacy analysis (Windows only)',
    minimum: '17',
    detection: '`vswhere`, `MSBuild.exe`',
    modes: ['local'],
    platforms: ['win32'],
    hints: {
      brew: '',
      apt: '',
      winget: 'winget install Microsoft.VisualStudio.2022.BuildTools',
      choco: 'choco install visualstudio2022buildtools',
    },
  },
  {
    id: 'docker',
    name: 'Docker / Compose',
    requiredFor: 'container mode (WARN only in local mode)',
    minimum: '24 / v2',
    detection: '`docker version`, `docker compose version`',
    modes: ['local', 'docker'],
    hints: {
      brew: 'brew install --cask docker',
      apt: 'sudo apt-get install -y docker-ce docker-compose-plugin (https://docs.docker.com/engine/install/)',
      winget: 'winget install Docker.DockerDesktop',
      choco: 'choco install docker-desktop',
    },
  },
  {
    id: 'env',
    name: 'Environment variables',
    requiredFor: 'AI features and paths',
    minimum: '—',
    detection: '`GEMINI_API_KEY`/`GOOGLE_GENAI_API_KEY`, `LLM_MODEL`, `ENGINE_JAR_PATH`',
    modes: ['local', 'docker'],
    hints: {
      brew: 'export GEMINI_API_KEY=<key>',
      apt: 'export GEMINI_API_KEY=<key>',
      winget: 'setx GEMINI_API_KEY <key>',
      choco: 'setx GEMINI_API_KEY <key>',
    },
  },
  {
    id: 'port',
    name: 'Port 9002',
    requiredFor: 'web start',
    minimum: 'free (or served by dev-arch)',
    detection: 'bind test on 9002, `GET /api/health`',
    modes: ['local', 'docker'],
    hints: {
      brew: 'lsof -i :9002',
      apt: 'ss -ltnp | grep 9002',
      winget: 'netstat -ano | findstr 9002',
      choco: 'netstat -ano | findstr 9002',
    },
  },
  {
    id: 'resources',
    name: 'Memory and disk',
    requiredFor: 'analysis of large projects',
    minimum: 'RAM ≥ 4 GB, temporary disk ≥ 2 GB',
    detection: 'total memory, free space of the temporary directory',
    modes: ['local', 'docker'],
    hints: {
      brew: 'free disk space in the temporary directory',
      apt: 'free disk space in /tmp',
      winget: 'free disk space in %TEMP%',
      choco: 'free disk space in %TEMP%',
    },
  },
];

/** Requirement by id (throws on an unknown id: the checks and the definition must not diverge). */
export function requirement(id) {
  const r = REQUIREMENTS.find((x) => x.id === id);
  if (!r) throw new Error(`unknown requirement ${id}`);
  return r;
}

/** Markdown requirements table of docs/INSTALL.md, generated from REQUIREMENTS. */
export function requirementsTable() {
  const rows = REQUIREMENTS.map((r) => {
    const modes = r.modes.join(', ') + (r.platforms ? ` (${r.platforms.map((p) => (p === 'win32' ? 'Windows' : p)).join(', ')} only)` : '');
    return `| ${r.name} | ${r.requiredFor} | ${r.minimum} | ${r.detection} | ${modes} |`;
  });
  return ['| Dependency | Required for | Minimum | How it is detected | Modes |', '|---|---|---|---|---|', ...rows].join('\n');
}

/** Markers that delimit the generated table in docs/INSTALL.md. */
export const TABLE_START = '<!-- doctor:requirements:start (generated by `npm run doctor -- --requirements-table`; do not edit) -->';
export const TABLE_END = '<!-- doctor:requirements:end -->';
