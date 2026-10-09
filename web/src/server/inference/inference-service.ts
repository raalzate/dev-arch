// Inference service of the web (010-modernization-ux FR-022..FR-027, FR-042, FR-043; research D4, D5; contracts/
// web-api.md): panel parameters (engine defaults + contract ranges), request validation with the generated zod
// schemas, delegation to the engine tools reinfer_architecture / score_proposal by analysis id, and mapping of the
// engine messages to HTTP errors. The web never re-implements the inference (Constitution II).
import type { ConsolidatedArchitecture } from '@static-inference/schema';
import { inferenceConfigSchema, reinferArchitectureResponseSchema, scoreProposalResponseSchema } from '@static-inference/schema/extensions';
import type { InferenceConfig, ScoreProposalResponse } from '@static-inference/schema/extensions';
import inferenceConfigJsonSchema from '@static-inference/schema/1.0.0/inference-config.schema.json';
import { ApiError } from '../api-error';
import { EngineToolError, type EngineClient } from '../engine/engine-client';

export const DEFAULTS_URI = 'static-inference://configuration/defaults';
export const INFERENCE_TIMEOUT_MS = 120_000;

export const PANEL: readonly { path: string; label: string; step: number }[] = [
  { path: 'viability.thresholds.high', label: 'Umbral de viabilidad alta', step: 0.01 },
  { path: 'viability.thresholds.medium', label: 'Umbral de viabilidad media', step: 0.01 },
  { path: 'viability.weights.cohesion', label: 'Peso de la cohesión', step: 0.01 },
  { path: 'viability.weights.coupling', label: 'Peso del acoplamiento', step: 0.01 },
  { path: 'viability.weights.data', label: 'Peso de los datos', step: 0.01 },
  { path: 'evidence.evidenceThreshold', label: 'Umbral de evidencia para fusionar', step: 0.01 },
  { path: 'clustering.largeClusterRatio', label: 'Proporción de clúster grande', step: 0.01 },
];

export interface PanelParameterView {
  path: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

const at = (obj: unknown, dotted: string): unknown =>
  dotted.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj);

function schemaNode(schema: unknown, dotted: string): { minimum?: number; maximum?: number } {
  let node = schema as { properties?: Record<string, unknown> };
  for (const k of dotted.split('.')) node = (node.properties?.[k] ?? {}) as typeof node;
  return node as { minimum?: number; maximum?: number };
}

export function panelParameters(defaults: unknown, schema: unknown = inferenceConfigJsonSchema): PanelParameterView[] {
  return PANEL.map((p) => {
    const node = schemaNode(schema, p.path);
    const d = at(defaults, p.path);
    if (typeof d !== 'number') throw new Error(`The engine defaults have no number at ${p.path}`);
    return { path: p.path, label: p.label, step: p.step, min: node.minimum ?? 0, max: node.maximum ?? 1, default: d };
  });
}

type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };
const VIABILITIES = ['Alta', 'Media', 'Baja'] as const;

function parseConfig(raw: unknown): Parsed<InferenceConfig | undefined> {
  if (raw === undefined || raw === null) return { ok: true, value: undefined };
  const r = inferenceConfigSchema.safeParse(raw);
  if (!r.success) {
    const i = r.error.issues[0];
    return { ok: false, message: `Invalid inference configuration: ${i?.path.join('.') || '(root)'}: ${i?.message ?? 'invalid'}` };
  }
  return { ok: true, value: r.data as InferenceConfig };
}

export function parseReinferBody(body: unknown): Parsed<{ config?: InferenceConfig; minViability?: (typeof VIABILITIES)[number] }> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, message: 'The JSON body must be an object.' };
  const b = body as Record<string, unknown>;
  const config = parseConfig(b.config);
  if (!config.ok) return config;
  if (b.minViability !== undefined && b.minViability !== null && !VIABILITIES.includes(b.minViability as never)) {
    return { ok: false, message: `Invalid minViability '${String(b.minViability)}'. Allowed: ${VIABILITIES.join(', ')}` };
  }
  return { ok: true, value: { config: config.value, minViability: (b.minViability ?? undefined) as (typeof VIABILITIES)[number] | undefined } };
}

export function parseScoreBody(body: unknown): Parsed<{ components: string[]; config?: InferenceConfig }> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, message: 'The JSON body must be an object.' };
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.components) || b.components.length === 0 || !b.components.every((c) => typeof c === 'string' && c.length > 0)) {
    return { ok: false, message: '"components" must be a non-empty array of component identifiers.' };
  }
  const config = parseConfig(b.config);
  if (!config.ok) return config;
  return { ok: true, value: { components: b.components as string[], config: config.value } };
}

export function mapEngineError(message: string): { status: number; code: string } {
  if (/^Invalid inference configuration:|^Inference configuration file|^Pass either config or configPath|^Invalid minViability/.test(message)) {
    return { status: 422, code: 'INFERENCE_CONFIG_INVALID' };
  }
  if (/^Unknown components:|^components must contain/.test(message)) return { status: 422, code: 'UNKNOWN_COMPONENTS' };
  if (/has no dependency graph|^Graph file .* does not exist/.test(message)) return { status: 404, code: 'NOT_FOUND' };
  if (/Tool .* not found|Unknown tool|jobId requires STATIC_INFERENCE_JOBS_DIR/i.test(message)) return { status: 503, code: 'INFERENCE_UNAVAILABLE' };
  return { status: 502, code: 'ENGINE_ERROR' };
}

function engineFailure(e: unknown): never {
  if (e instanceof EngineToolError) {
    const m = mapEngineError(e.message);
    throw new ApiError(m.status, m.code, e.message);
  }
  const message = e instanceof Error ? e.message : String(e);
  const m = mapEngineError(message);
  throw new ApiError(m.status === 502 ? 503 : m.status, m.status === 502 ? 'ENGINE_UNAVAILABLE' : m.code, message);
}

function parseValidated<T>(text: string, schema: { safeParse(x: unknown): { success: boolean } }, what: string): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ApiError(502, 'ENGINE_ERROR', `The engine ${what} response is not valid JSON.`);
  }
  if (!schema.safeParse(parsed).success) throw new ApiError(502, 'ENGINE_ERROR', `The engine ${what} response violates the contract 1.0.0.`);
  return parsed as T;
}

export async function inferenceDefaults(engine: EngineClient): Promise<{ parameters: PanelParameterView[]; defaults: unknown }> {
  let text: string;
  try {
    text = await engine.readResource(DEFAULTS_URI);
  } catch (e) {
    engineFailure(e);
  }
  const defaults = JSON.parse(text);
  return { parameters: panelParameters(defaults), defaults };
}

export async function reinfer(
  engine: EngineClient,
  jobId: string,
  req: { config?: InferenceConfig; minViability?: string },
): Promise<{ architecture: ConsolidatedArchitecture; text: string }> {
  const args: Record<string, unknown> = { jobId };
  if (req.config && Object.keys(req.config).length) args.config = req.config;
  if (req.minViability) args.minViability = req.minViability;
  let text: string;
  try {
    ({ text } = await engine.callTool('reinfer_architecture', args, INFERENCE_TIMEOUT_MS));
  } catch (e) {
    engineFailure(e);
  }
  return { architecture: parseValidated<ConsolidatedArchitecture>(text, reinferArchitectureResponseSchema, 'reinfer_architecture'), text };
}

export async function score(
  engine: EngineClient,
  jobId: string,
  req: { components: string[]; config?: InferenceConfig },
): Promise<ScoreProposalResponse> {
  const args: Record<string, unknown> = { jobId, components: req.components };
  if (req.config && Object.keys(req.config).length) args.config = req.config;
  let text: string;
  try {
    ({ text } = await engine.callTool('score_proposal', args, INFERENCE_TIMEOUT_MS));
  } catch (e) {
    engineFailure(e);
  }
  return parseValidated<ScoreProposalResponse>(text, scoreProposalResponseSchema, 'score_proposal');
}
