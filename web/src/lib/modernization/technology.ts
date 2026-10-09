// Technology profile of an analysis (010-modernization-ux FR-001, FR-001a, FR-007; research D1): derived from the
// origin declared by the engine (meta.source) and the extensions of the component files. Presentation only.
import type { DependencyGraph } from '@static-inference/schema';

export type Technology = 'java' | 'csharp' | 'vb' | 'dotnet-mixed' | 'dotnet';
export type Language = 'java' | 'csharp' | 'vb';
export type Accent = 'java' | 'dotnet' | 'vb';
/** Targets a section can declare: one language family or every .NET flavour. */
export type TechnologyTarget = 'java' | 'csharp' | 'vb' | 'dotnet';

export interface TechnologyProfile {
  technology: Technology;
  label: string;
  languages: Language[];
  source: DependencyGraph['meta']['source'];
  reducedFidelity: boolean;
  accent: Accent;
}

const LABELS: Record<Technology, string> = {
  java: 'Java',
  csharp: '.NET · C#',
  vb: 'VB.NET',
  'dotnet-mixed': '.NET · C# + VB',
  dotnet: '.NET',
};

export function technologyLabel(t: Technology): string {
  return LABELS[t];
}

export function technologyProfile(graph: Pick<DependencyGraph, 'meta' | 'components'>): TechnologyProfile {
  const source = graph.meta.source;
  const reducedFidelity = source === 'roslyn-fallback';
  if (source === 'spoon') {
    return { technology: 'java', label: LABELS.java, languages: ['java'], source, reducedFidelity, accent: 'java' };
  }
  let cs = false;
  let vb = false;
  for (const c of graph.components) {
    for (const f of c.files ?? []) {
      const lower = f.toLowerCase();
      if (lower.endsWith('.cs')) cs = true;
      else if (lower.endsWith('.vb')) vb = true;
    }
  }
  const technology: Technology = cs && vb ? 'dotnet-mixed' : vb ? 'vb' : cs ? 'csharp' : 'dotnet';
  const languages: Language[] = [...(cs ? (['csharp'] as const) : []), ...(vb ? (['vb'] as const) : [])];
  return { technology, label: LABELS[technology], languages, source, reducedFidelity, accent: vb ? 'vb' : 'dotnet' };
}

/** Whether something declared for `targets` applies to the profile ('all' always applies). */
export function appliesTo(profile: TechnologyProfile, targets: 'all' | readonly TechnologyTarget[]): boolean {
  if (targets === 'all') return true;
  const t = profile.technology;
  return targets.some((x) => {
    if (x === 'java') return t === 'java';
    if (x === 'dotnet') return t !== 'java';
    if (x === 'csharp') return t === 'csharp' || t === 'dotnet-mixed';
    return t === 'vb' || t === 'dotnet-mixed';
  });
}
