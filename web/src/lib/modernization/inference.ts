// Inference panel parameters (010 FR-022, FR-023; data-model.md InferenceScenario). Only the values that differ
// from the engine defaults are sent, clamped to the contract range and rounded to the parameter step.
import type { InferenceConfig } from '@static-inference/schema';

export interface PanelParameter {
  path: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

export const MIN_VIABILITIES = ['Alta', 'Media', 'Baja'] as const;
export type MinViability = (typeof MIN_VIABILITIES)[number];

export interface InferenceParameters {
  config: InferenceConfig;
  minViability: MinViability | null;
}

function decimals(step: number): number {
  const s = String(step);
  return s.includes('.') ? s.length - s.indexOf('.') - 1 : 0;
}

export function clampToRange(value: number, p: PanelParameter): number {
  if (!Number.isFinite(value)) return p.default;
  const v = Math.min(p.max, Math.max(p.min, value));
  return Number(v.toFixed(decimals(p.step)));
}

export function isDefault(values: Record<string, number>, params: readonly PanelParameter[]): boolean {
  return params.every((p) => values[p.path] === undefined || clampToRange(values[p.path], p) === p.default);
}

export function toInferenceConfig(values: Record<string, number>, params: readonly PanelParameter[]): InferenceConfig {
  const out: Record<string, unknown> = {};
  for (const p of params) {
    if (values[p.path] === undefined) continue;
    const v = clampToRange(values[p.path], p);
    if (v === p.default) continue;
    const keys = p.path.split('.');
    let node = out;
    for (const k of keys.slice(0, -1)) node = (node[k] ??= {}) as Record<string, unknown>;
    node[keys[keys.length - 1]] = v;
  }
  return out as InferenceConfig;
}
