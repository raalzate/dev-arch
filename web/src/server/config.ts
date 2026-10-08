// Web server configuration of 007-native-engine-runtime (research D13, D15): read once from the environment.
import path from 'node:path';

export interface AppConfig {
  dataDir: string;
  maxUploadBytes: number;
  maxUncompressedBytes: number;
  maxZipEntries: number;
  maxConcurrent: number;
  maxQueued: number;
  jobTtlHours: number;
  cleanupIntervalMs: number;
  analysisTimeoutMs: number;
  maxSourceViewBytes: number;
  allowLocalPath: boolean;
  apiToken: string | null;
  sourceExtensions: readonly string[];
}

/** Source viewer allowlist (research D10): code and configuration files of the supported languages. */
export const DEFAULT_SOURCE_EXTENSIONS: readonly string[] = [
  '.java', '.kt', '.groovy', '.gradle', '.kts', '.xml', '.properties', '.yml', '.yaml', '.json',
  '.cs', '.vb', '.csproj', '.vbproj', '.sln', '.config', '.cshtml', '.razor', '.xaml', '.resx', '.settings',
  '.sql', '.md', '.txt', '.jsp', '.html', '.js', '.ts',
];

/**
 * Default number of analyses running at the same time. 2 because TS-064 (concurrent engine analyses are
 * byte-identical to sequential ones) passed in the foundational phase (decision A2); it would be 1 otherwise.
 */
export const DEFAULT_MAX_CONCURRENT = 2;

function positiveInt(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name]?.trim();
  if (raw === undefined || raw === '') return fallback;
  if (!/^\d+$/.test(raw) || Number(raw) <= 0 || !Number.isSafeInteger(Number(raw))) {
    throw new Error(`Invalid configuration: ${name} must be a positive integer (got '${env[name]}')`);
  }
  return Number(raw);
}

function bool(env: NodeJS.ProcessEnv, name: string, fallback: boolean): boolean {
  const raw = env[name]?.trim().toLowerCase();
  if (raw === undefined || raw === '') return fallback;
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  throw new Error(`Invalid configuration: ${name} must be true or false (got '${env[name]}')`);
}

export function loadConfig(env: NodeJS.ProcessEnv, cwd: string): AppConfig {
  const dataDirRaw = env.ARCHVIEW_DATA_DIR?.trim();
  const token = env.DEVARCH_API_TOKEN?.trim();
  return {
    dataDir: dataDirRaw ? path.resolve(cwd, dataDirRaw) : path.join(cwd, '.archview'),
    maxUploadBytes: positiveInt(env, 'MAX_UPLOAD_BYTES', 209715200),
    maxUncompressedBytes: positiveInt(env, 'MAX_UNCOMPRESSED_BYTES', 1073741824),
    maxZipEntries: positiveInt(env, 'MAX_ZIP_ENTRIES', 100000),
    maxConcurrent: positiveInt(env, 'MAX_CONCURRENT_ANALYSES', DEFAULT_MAX_CONCURRENT),
    maxQueued: positiveInt(env, 'MAX_QUEUED_ANALYSES', 10),
    jobTtlHours: positiveInt(env, 'ARCHVIEW_JOB_TTL_HOURS', 24),
    cleanupIntervalMs: positiveInt(env, 'ARCHVIEW_CLEANUP_INTERVAL_MS', 600000),
    analysisTimeoutMs: positiveInt(env, 'ANALYSIS_TIMEOUT_MS', 1800000),
    maxSourceViewBytes: positiveInt(env, 'MAX_SOURCE_VIEW_BYTES', 2097152),
    allowLocalPath: bool(env, 'DEVARCH_ALLOW_LOCAL_PATH', env.NODE_ENV === 'development'),
    apiToken: token ? token : null,
    sourceExtensions: DEFAULT_SOURCE_EXTENSIONS,
  };
}
