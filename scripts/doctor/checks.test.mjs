// Unit tests of the doctor checks (012-install-doctor-docker): one simulated system per case and OS.
import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  analyzerVersion, atLeast, dotnetBin, engineJarPath, hintsFor, javaMajor, locateAnalyzer, overall, parseRuntimes, parseSdks,
  parseVersion, queryEngine, runDoctor,
} from './checks.mjs';
import { ANALYZER, JAR, ROOT, state, system } from './testing.mjs';

const GIB = 1024 ** 3;
const run = (s, mode = 'local', only = null) => runDoctor(system(s), { mode, only });
const byId = (report, id) => report.checks.find((c) => c.id === id);

describe('parsing', () => {
  it('parses versions and compares them', () => {
    assert.deepEqual(parseVersion('v20.11.1'), [20, 11, 1]);
    assert.deepEqual(parseVersion('21'), [21, 0, 0]);
    assert.equal(parseVersion('none'), null);
    assert.equal(atLeast([3, 6, 0], [3, 6, 0]), true);
    assert.equal(atLeast([3, 5, 9], [3, 6, 0]), false);
    assert.equal(atLeast([4, 0, 0], [3, 6, 0]), true);
  });

  it('reads the Java major version, including the 1.x scheme', () => {
    assert.deepEqual(javaMajor('openjdk version "17.0.9" 2023-10-17'), { major: 17, text: '17.0.9' });
    assert.deepEqual(javaMajor('java version "1.8.0_392"'), { major: 8, text: '1.8.0_392' });
    assert.equal(javaMajor('no java here'), null);
  });

  it('lists SDKs and .NET runtimes', () => {
    assert.deepEqual(parseSdks('8.0.100 [/a]\n10.0.105 [/b]\n'), ['8.0.100', '10.0.105']);
    assert.deepEqual(parseRuntimes('Microsoft.AspNetCore.App 8.0.1 [/a]\nMicrosoft.NETCore.App 8.0.27 [/b]\nMicrosoft.NETCore.App 10.0.5 [/c]'), ['8.0.27', '10.0.5']);
  });

  it('computes the overall status', () => {
    assert.equal(overall([{ status: 'OK' }, { status: 'WARN' }]), 'WARN');
    assert.equal(overall([{ status: 'WARN' }, { status: 'FAIL' }]), 'FAIL');
    assert.equal(overall([{ status: 'OK' }]), 'OK');
  });

  it('gives the hints of each platform', () => {
    assert.deepEqual(hintsFor('jdk', 'darwin'), ['brew: brew install openjdk@17']);
    assert.deepEqual(hintsFor('jdk', 'win32'), ['winget: winget install EclipseAdoptium.Temurin.17.JDK', 'choco: choco install temurin17']);
    assert.deepEqual(hintsFor('jdk', 'freebsd'), ['apt: sudo apt-get install -y openjdk-17-jdk']);
    assert.deepEqual(hintsFor('vs-build-tools', 'darwin'), []);
  });
});

describe('local mode', () => {
  for (const platform of ['darwin', 'linux', 'win32']) {
    it(`is OK on a complete ${platform} system`, async () => {
      const r = await run(state(platform));
      assert.equal(r.status, 'OK', JSON.stringify(r.checks.filter((c) => c.status !== 'OK')));
      assert.equal(r.checks.length, 12);
      assert.equal(r.engine.version, '1.2.0');
      assert.equal(r.version, '1.2.0');
    });
  }

  it('passes a .NET SDK 10 with the .NET 8.0.27 runtime', async () => {
    const s = state('darwin');
    s.sdks = ['10.0.105'];
    s.runtimes = ['8.0.27', '10.0.5'];
    const r = await run(s);
    assert.equal(byId(r, 'dotnet-sdk').status, 'OK');
    assert.equal(byId(r, 'dotnet-runtime').status, 'OK');
    assert.match(byId(r, 'dotnet-runtime').detail, /8\.0\.27/);
  });

  it('fails without a .NET 8 runtime, with an old SDK or without dotnet', async () => {
    const s = state();
    s.runtimes = ['10.0.5'];
    s.sdks = ['6.0.400'];
    let r = await run(s);
    assert.equal(byId(r, 'dotnet-runtime').status, 'FAIL');
    assert.equal(byId(r, 'dotnet-sdk').status, 'FAIL');
    s.dotnet = 'absent';
    r = await run(s);
    assert.equal(byId(r, 'dotnet-sdk').detected, 'not found');
    assert.equal(byId(r, 'dotnet-runtime').status, 'FAIL');
  });

  it('uses DOTNET_ROOT when it contains dotnet', () => {
    const s = state();
    s.env.DOTNET_ROOT = '/opt/dotnet';
    s.files = ['/opt/dotnet/dotnet'];
    assert.equal(dotnetBin(system(s)), '/opt/dotnet/dotnet');
    s.files = [];
    assert.equal(dotnetBin(system(s)), 'dotnet');
  });

  it('fails an old or missing JDK and a JAVA_HOME without java', async () => {
    const s = state();
    s.java = '11.0.21';
    assert.equal(byId(await run(s), 'jdk').status, 'FAIL');
    s.java = null;
    const r = await run(s);
    assert.equal(byId(r, 'jdk').status, 'FAIL');
    assert.equal(r.status, 'FAIL');
    assert.match(byId(r, 'engine-jar').detail, /version not checked/);
    const h = state();
    h.env.JAVA_HOME = '/broken';
    assert.match(byId(await run(h), 'jdk').detail, /JAVA_HOME/);
    const good = state();
    good.env.JAVA_HOME = '/jdk';
    good.files = [path.join('/jdk', 'bin', 'java')];
    assert.match(byId(await run(good), 'jdk').detail, /JAVA_HOME=\/jdk/);
  });

  it('accepts the Maven wrapper and rejects an old Maven', async () => {
    const s = state();
    s.mvn = null;
    assert.equal(byId(await run(s), 'maven').status, 'FAIL');
    s.files = [path.join(ROOT, 'engine', 'mvnw')];
    assert.equal(byId(await run(s), 'maven').status, 'OK');
    const w = state('win32');
    w.mvn = null;
    w.files = [path.join(ROOT, 'engine', 'mvnw.cmd')];
    assert.equal(byId(await run(w), 'maven').status, 'OK');
    const old = state();
    old.mvn = '3.5.4';
    assert.equal(byId(await run(old), 'maven').status, 'FAIL');
  });

  it('fails Node below 20 and npm below 10', async () => {
    const s = state();
    s.node = 'v18.19.0';
    assert.equal(byId(await run(s), 'node').status, 'FAIL');
    const n = state();
    n.npm = '9.8.0';
    assert.equal(byId(await run(n), 'node').status, 'FAIL');
    n.npm = null;
    assert.match(byId(await run(n), 'node').detected, /npm not found/);
  });

  it('checks the engine archive through its self-diagnosis', async () => {
    const cases = [['ok', 'OK'], ['other-version', 'WARN'], ['silent', 'WARN'], ['garbage', 'WARN'], ['absent', 'WARN']];
    for (const [jar, status] of cases) {
      const s = state();
      s.jar = jar;
      assert.equal(byId(await run(s), 'engine-jar').status, status, jar);
    }
    const broken = state();
    broken.env.ENGINE_JAR_PATH = '/nowhere/engine.jar';
    const r = await run(broken);
    assert.equal(byId(r, 'engine-jar').status, 'FAIL');
    assert.equal(byId(r, 'env').status, 'FAIL');
    const rel = state();
    rel.env.ENGINE_JAR_PATH = 'engine-dist/engine.jar';
    assert.equal(engineJarPath(system(rel)), JAR);
    const r2 = await run(rel);
    assert.match(byId(r2, 'env').detail, /ENGINE_JAR_PATH=engine-dist\/engine.jar/);
  });

  it('parses the engine self-diagnosis line', async () => {
    const s = state();
    assert.equal((await queryEngine(system(s), 'java', JAR)).schema_version, '1.0.0');
    s.jar = 'silent';
    assert.equal(await queryEngine(system(s), 'java', JAR), null);
  });

  it('locates the analyzer like the engine and compares its version', async () => {
    let s = state();
    assert.equal(byId(await run(s), 'dotnet-analyzer').status, 'OK');
    s.analyzerVersion = '1.1.0';
    assert.equal(byId(await run(s), 'dotnet-analyzer').status, 'WARN');
    s.analyzerVersion = null;
    assert.match(byId(await run(s), 'dotnet-analyzer').detail, /version unknown/);
    s = state();
    s.engineAnalyzer = null;
    delete s.env.DOTNET_ANALYZER_PATH;
    assert.equal(byId(await run(s), 'dotnet-analyzer').status, 'WARN');
    // sibling of the jar, override as a file, PATH (Windows .exe)
    const sib = state();
    sib.files = [path.join(path.dirname(JAR), 'dotnet-analyzer')];
    assert.equal(locateAnalyzer(system(sib), JAR), path.join(path.dirname(JAR), 'dotnet-analyzer'));
    const file = state();
    file.env.DOTNET_ANALYZER_PATH = '/x/dotnet-analyzer';
    file.files = ['/x/dotnet-analyzer'];
    file.engineAnalyzer = null;
    assert.equal(locateAnalyzer(system(file), null), '/x/dotnet-analyzer');
    const win = state('win32');
    win.engineAnalyzer = null;
    delete win.env.DOTNET_ANALYZER_PATH;
    win.env.PATH = 'C:\\a;C:\\tools';
    win.files = [path.join('C:\\tools', 'dotnet-analyzer.exe')];
    assert.equal(locateAnalyzer(system(win), null), path.join('C:\\tools', 'dotnet-analyzer.exe'));
    const none = state();
    none.engineAnalyzer = null;
    delete none.env.DOTNET_ANALYZER_PATH;
    none.env.PATH = undefined;
    assert.equal(locateAnalyzer(system(none), null), null);
    assert.equal(analyzerVersion(system(state()), ANALYZER), '1.2.0');
  });

  it('checks VS Build Tools only on Windows', async () => {
    assert.match(byId(await run(state('linux')), 'vs-build-tools').detail, /only required on Windows/);
    const w = state('win32');
    w.vswhere = false;
    assert.equal(byId(await run(w), 'vs-build-tools').status, 'WARN');
    const old = state('win32');
    old.vsVersion = '16.11.0';
    assert.equal(byId(await run(old), 'vs-build-tools').status, 'WARN');
  });

  it('warns about Docker in local mode', async () => {
    const s = state();
    s.docker = 'absent';
    const r = await run(s);
    assert.equal(byId(r, 'docker').status, 'WARN');
    assert.equal(r.status, 'WARN');
  });

  it('warns about missing AI keys, a busy port and low resources', async () => {
    const s = state();
    delete s.env.GEMINI_API_KEY;
    s.env.LLM_MODEL = 'gemini-x';
    s.portFree = false;
    s.ram = 2 * GIB;
    s.disk = GIB;
    const r = await run(s);
    assert.equal(byId(r, 'env').status, 'WARN');
    assert.match(byId(r, 'env').detected, /LLM_MODEL=gemini-x/);
    assert.equal(byId(r, 'port').status, 'WARN');
    assert.equal(byId(r, 'resources').status, 'WARN');
    assert.match(byId(r, 'resources').detail, /4 GB.*2 GB/);
    s.health = { service: 'dev-arch', version: '1.2.0', status: 'OK' };
    assert.equal(byId(await run(s), 'port').status, 'OK');
    const g = state();
    delete g.env.GEMINI_API_KEY;
    g.env.GOOGLE_GENAI_API_KEY = 'x';
    assert.equal(byId(await run(g), 'env').status, 'OK');
    const unknownDisk = state();
    unknownDisk.disk = null;
    assert.equal(byId(await run(unknownDisk), 'resources').status, 'OK');
  });
});

describe('docker mode', () => {
  it('checks only the container prerequisites', async () => {
    const r = await run(state(), 'docker');
    assert.deepEqual(r.checks.map((c) => c.id), ['docker', 'env', 'port', 'resources']);
    assert.equal(r.status, 'OK');
  });

  it('fails without Docker, with an old Docker, without Compose v2 or with the daemon down', async () => {
    for (const change of [
      (s) => { s.docker = 'absent'; },
      (s) => { s.dockerVersion = '20.10.7'; },
      (s) => { s.compose = null; },
      (s) => { s.compose = 'v1.29.2'; },
      (s) => { s.docker = 'daemon-down'; },
    ]) {
      const s = state();
      change(s);
      const r = await run(s, 'docker');
      assert.equal(byId(r, 'docker').status, 'FAIL', JSON.stringify(byId(r, 'docker')));
      assert.equal(r.status, 'FAIL');
    }
  });

  it('reads the AI key from the Compose .env file', async () => {
    const s = state();
    delete s.env.GEMINI_API_KEY;
    s.dotEnv = 'GEMINI_API_KEY=abc\n';
    assert.equal(byId(await run(s, 'docker'), 'env').status, 'OK');
  });

  it('rejects an unknown mode', async () => {
    await assert.rejects(run(state(), 'cloud'), /unknown mode/);
  });
});

describe('subsets', () => {
  it('runs the engine query for the analyzer check even when the jar check is not requested', async () => {
    const s = state();
    const r = await run(s, 'local', ['dotnet-analyzer']);
    assert.deepEqual(r.checks.map((c) => c.id), ['dotnet-analyzer']);
    assert.ok(s.calls.some((c) => c.includes('--doctor')));
    assert.equal(r.engine.engine, 'static-inference');
  });

  it('every non-OK check carries the hints of its platform', async () => {
    const s = state('darwin');
    s.java = null;
    const c = byId(await run(s), 'jdk');
    assert.deepEqual(c.fix, ['brew: brew install openjdk@17']);
    assert.equal(c.requiredFor, 'engine runtime and build');
  });
});
