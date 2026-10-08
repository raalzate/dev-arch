// Browser client of the asynchronous analyses API (007-native-engine-runtime, contracts/analyses-api.md; FR-007,
// FR-035). The browser keeps only the identifier of the active analysis (localStorage) and, when the server
// requires it, the API token for the browser session (sessionStorage) — never analysis results.
import type { ArchitectureData, ComponentsData } from '@/lib/types';

export const ACTIVE_JOB_KEY = 'devarch.activeJobId';
export const API_TOKEN_KEY = 'devarch.apiToken';

export type Language = 'auto' | 'java' | 'dotnet';
export type AnalysisState = 'queued' | 'running' | 'completed' | 'failed';
export type Phase = 'detection' | 'extraction' | 'inference' | 'writing';

export interface AnalysisStatus {
  jobId: string;
  origin: string;
  language: Language;
  status: AnalysisState;
  phase: Phase | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: { code: string; message: string } | null;
  warnings: string[];
  summary: { componentCount: number; edgeCount: number; proposalCount: number; endpointCount: number } | null;
  projectRoot: string | null;
  hasSources: boolean;
}

export interface ImportViolation {
  document: string;
  pointer: string;
  message: string;
}

/** The server requires an API token (401). */
export class ApiAuthError extends Error {
  constructor() {
    super('Se requiere un token de acceso a la API.');
    this.name = 'ApiAuthError';
  }
}

/** Any other API error, with its code and extra fields ({"error": {...}}). */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

function safeStorage(kind: 'local' | 'session'): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function getApiToken(): string | null {
  return safeStorage('session')?.getItem(API_TOKEN_KEY) || null;
}

export function setApiToken(token: string): void {
  safeStorage('session')?.setItem(API_TOKEN_KEY, token.trim());
}

export function getActiveJobId(): string | null {
  return safeStorage('local')?.getItem(ACTIVE_JOB_KEY) || null;
}

export function setActiveJobId(jobId: string | null): void {
  const s = safeStorage('local');
  if (!s) return;
  if (jobId) s.setItem(ACTIVE_JOB_KEY, jobId);
  else s.removeItem(ACTIVE_JOB_KEY);
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  const token = getApiToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

async function request(input: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(input, { ...init, cache: 'no-store', headers: headers((init.headers ?? {}) as Record<string, string>) });
  if (res.status === 401) throw new ApiAuthError();
  if (!res.ok) {
    let body: { error?: { code?: string; message?: string } & Record<string, unknown> } = {};
    try {
      body = await res.json();
    } catch {
      /* not JSON */
    }
    const { code = 'HTTP_' + res.status, message = res.statusText, ...details } = body.error ?? {};
    throw new ApiRequestError(res.status, code, message, details);
  }
  return res;
}

/** Uploads the ZIP as the request body (no multipart) and returns the registered analysis. */
export async function submitAnalysis(file: Blob, language: Language): Promise<{ jobId: string; status: AnalysisState }> {
  const res = await request(`/api/analyses?language=${encodeURIComponent(language)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/zip' },
    body: file,
  });
  return res.json();
}

export async function getStatus(jobId: string): Promise<AnalysisStatus> {
  return (await request(`/api/analyses/${encodeURIComponent(jobId)}`)).json();
}

export async function getDocuments(jobId: string): Promise<{ componentsData: ComponentsData; archData: ArchitectureData }> {
  const id = encodeURIComponent(jobId);
  const [graph, architecture] = await Promise.all([
    request(`/api/analyses/${id}/graph`).then((r) => r.json()),
    request(`/api/analyses/${id}/architecture`).then((r) => r.json()),
  ]);
  return { componentsData: graph as ComponentsData, archData: architecture as ArchitectureData };
}

export async function getSource(jobId: string, filePath: string): Promise<{ path: string; content: string }> {
  const q = `jobId=${encodeURIComponent(jobId)}&path=${encodeURIComponent(filePath)}`;
  return (await request(`/api/source?${q}`)).json();
}

export async function importResults(docs: { graph?: unknown; architecture?: unknown; entrypoints?: unknown }): Promise<{ jobId: string; status: AnalysisState }> {
  const res = await request('/api/analyses/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(docs),
  });
  return res.json();
}

export function isTerminal(s: AnalysisState): boolean {
  return s === 'completed' || s === 'failed';
}

/**
 * Polls the status until the analysis ends (or `signal` aborts): every 500 ms while it starts, 1 s afterwards and
 * up to 2 s after transient errors, so every change is visible in less than 3 s (FR-007).
 */
export async function pollAnalysis(
  jobId: string,
  onUpdate: (s: AnalysisStatus) => void,
  signal: AbortSignal,
): Promise<AnalysisStatus | null> {
  let polls = 0;
  let delay = 500;
  while (!signal.aborted) {
    try {
      const s = await getStatus(jobId);
      if (signal.aborted) return null;
      onUpdate(s);
      if (isTerminal(s.status)) return s;
      polls++;
      delay = polls < 10 ? 500 : 1000;
    } catch (e) {
      if (e instanceof ApiAuthError || (e instanceof ApiRequestError && e.status === 404)) throw e;
      delay = 2000;
    }
    await new Promise((r) => setTimeout(r, delay));
  }
  return null;
}

/** Spanish labels of the phases and states shown by the interface. */
export const PHASE_LABELS: Record<Phase, string> = {
  detection: 'detección',
  extraction: 'extracción',
  inference: 'inferencia',
  writing: 'escritura',
};

export const STATUS_LABELS: Record<AnalysisState, string> = {
  queued: 'en cola',
  running: 'en ejecución',
  completed: 'completado',
  failed: 'fallido',
};
