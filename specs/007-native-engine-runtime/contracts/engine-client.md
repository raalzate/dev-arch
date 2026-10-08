# Contract: web engine client (`web/src/server/engine/`)

## engine-locator.ts

`locateEngine(env, cwd, exists)` extends 006 `resolveEngine` (same `ENGINE_JAR_PATH` / `JAVA_HOME` rules and the same `Engine not built …make build` message — TS-016/TS-017 of 006 keep passing) and returns `{ javaBin, jarPath, javaOpts: string[] (ENGINE_JAVA_OPTS split on whitespace), env: { DOTNET_ANALYZER_PATH?, DOTNET_ROOT?, JAVA_HOME? } }`.

## engine-client.ts

```ts
interface EngineClient {
  analyze(req: { jobId: string; projectPath: string; outputDir: string; language: 'java'|'dotnet'|'auto' },
          hooks: { onPhase(phase: Phase): void; onStderr(line: string): void; signal: AbortSignal; timeoutMs: number })
    : Promise<{ summary: AnalyzeProjectResponse; warnings: string[] }>;
  state(): EngineState;
  shutdown(): Promise<void>;
}
```

- Singleton per server process (`globalThis.__devarchEngine`); lazy start; `Client({name: 'dev-arch-web', version: <VERSION>})`.
- `analyze` → `client.callTool({ name: 'analyze_project', arguments: { projectPath, outputDir, language } }, undefined, { timeout, onprogress, signal })`; `onprogress` maps `message` to `Phase` (ignores unknown/regressive values).
- `isError: true` → rejects `EngineToolError(message)`; message `Ambiguous project type` → job error code `AMBIGUOUS_PROJECT`.
- Response `content[0].text` parsed with `parseAnalyzeProjectResponse` (contract 1.0.0); warnings from `result._meta?.["static-inference/warnings"]`.
- Transport close/error → all in-flight reject `EngineCrashedError` (< 1 s); next call restarts (backoff 1/2/4 s; > 3 crashes in 60 s → `EngineUnavailableError` for 60 s).
- Timeout → `EngineTimeoutError`; `recycleWhenIdle = true`.
- stderr lines → `console.error('[engine]', line)` and `hooks.onStderr` for every in-flight job.

## job-runner.ts / job-store.ts

- `JobStore`: `create`, `get`, `update` (atomic), `list`, `delete`, `paths(id)`; validates ids.
- `JobRunner`: semaphore (`maxConcurrent`), FIFO queue (`maxQueued`), per-`realpath(projectRoot)` mutex; `submit(job)` returns immediately; on `register()` marks `queued|running` → `failed/INTERRUPTED` and starts the cleaner.
