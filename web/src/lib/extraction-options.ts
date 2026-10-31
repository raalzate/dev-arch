// 026-web-extraction-options: the extraction options of the analyze form and their translation to the engine's
// configuration object (only non-default values travel; null = no configuration at all).

export interface ExtractionOptions {
  /** analysis.extended = on (024: official rules, dead code, duplication, maintainability). */
  extended: boolean;
  /** detection.maxDepth (0 = project markers at the root only). */
  maxDepth: number;
  /** analysis.referenceAssemblies (025): server-side folder of .NET Framework reference assemblies. */
  referenceAssemblies: string;
}

export const DEFAULT_EXTRACTION: ExtractionOptions = { extended: false, maxDepth: 0, referenceAssemblies: '' };

export const MAX_DEPTH = 5;

export function toExtractionConfig(o: ExtractionOptions): Record<string, unknown> | null {
  const config: Record<string, unknown> = {};
  const depth = Math.min(MAX_DEPTH, Math.max(0, Math.trunc(Number(o.maxDepth) || 0)));
  if (depth > 0) config.detection = { maxDepth: depth };
  const analysis: Record<string, unknown> = {};
  if (o.extended) analysis.extended = 'on';
  const refs = o.referenceAssemblies.trim();
  if (refs) analysis.referenceAssemblies = refs;
  if (Object.keys(analysis).length) config.analysis = analysis;
  return Object.keys(config).length ? config : null;
}

/** Short Spanish description of a stored extraction configuration (summary step, 026 FR-011). */
export function describeExtractionConfig(config: Record<string, unknown> | null | undefined): string[] {
  if (!config) return [];
  const out: string[] = [];
  const detection = config.detection as Record<string, unknown> | undefined;
  if (detection && typeof detection.maxDepth === 'number' && detection.maxDepth > 0) out.push(`búsqueda de proyectos hasta ${detection.maxDepth} niveles`);
  const analysis = config.analysis as Record<string, unknown> | undefined;
  if (analysis?.extended === 'on' || analysis?.extended === 'auto') out.push('análisis extendido');
  if (typeof analysis?.referenceAssemblies === 'string' && analysis.referenceAssemblies) out.push('ensamblados de referencia .NET Framework');
  const known = new Set(['detection', 'analysis']);
  for (const key of Object.keys(config)) if (!known.has(key)) out.push(`sección ${key}`);
  return out;
}
