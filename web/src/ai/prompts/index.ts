// Technology-specific documentation prompts (010 FR-039; research D11). The user prompt is a compact summary of the
// analysis (not the raw documents) so that large systems fit in the model context.
import { layerLabel } from '../../lib/modernization/layers';
import { buildPlan } from '../../lib/modernization/plan';
import { summarize } from '../../lib/modernization/summary';
import type { AnalysisView } from '../../lib/modernization/sections';
import { SEVERITIES, SEVERITY_STYLES } from '../../lib/modernization/severity';
import type { TechnologyProfile } from '../../lib/modernization/technology';
import { ASPNET_CORE } from './aspnet-core';
import { JAVA_SPRING_JEE } from './java-spring-jee';
import { VB_DESKTOP } from './vb-desktop';

export type PromptTemplate = 'java-spring-jee' | 'aspnet-core' | 'vb-desktop';

const TEMPLATES: Record<PromptTemplate, string> = {
  'java-spring-jee': JAVA_SPRING_JEE,
  'aspnet-core': ASPNET_CORE,
  'vb-desktop': VB_DESKTOP,
};

export function selectPromptTemplate(profile: TechnologyProfile): PromptTemplate {
  if (profile.technology === 'java') return 'java-spring-jee';
  if (profile.languages.includes('vb')) return 'vb-desktop';
  return 'aspnet-core';
}

const OUTPUT = `Escribe en español un documento técnico en Markdown con estas secciones: 1. Ficha técnica (tecnología, arquetipo, dependencias clave). 2. Arquitectura lógica (capas y responsabilidades; incluye un diagrama Mermaid de componentes). 3. Datos y seguridad (tablas, datos sensibles, secretos). 4. Salud del código (hallazgos por severidad, puntos calientes). 5. Propuestas de extracción (veredicto por propuesta). 6. Hoja de ruta de modernización (etapas y 3 acciones inmediatas). Sé preciso y basa cada afirmación en los datos.`;

export function buildDocumentationPrompt(view: AnalysisView, profile: TechnologyProfile): { template: PromptTemplate; system: string; user: string } {
  const template = selectPromptTemplate(profile);
  const s = summarize(view, profile);
  const plan = buildPlan(view, profile, { project: view.architecture.project_metadata.shared_domain ?? 'sistema', analysisId: '-', finishedAt: null });
  const layers = new Map<string, number>();
  for (const c of view.graph.components) layers.set(layerLabel(c.layer, profile), (layers.get(layerLabel(c.layer, profile)) ?? 0) + 1);
  const lines: string[] = [];
  lines.push(`Tecnología: ${profile.label} (origen ${profile.source}${profile.reducedFidelity ? ', fidelidad reducida' : ''})`);
  lines.push(`Dominio compartido: ${view.architecture.project_metadata.shared_domain ?? 'desconocido'}`);
  lines.push(`Componentes: ${s.components}; LOC: ${s.loc}; dependencias internas: ${s.edges}; endpoints: ${s.endpoints}; tablas: ${s.tables}`);
  lines.push(`Capas: ${[...layers.entries()].map(([k, n]) => `${k} (${n})`).join(', ')}`);
  lines.push(`Hallazgos: ${SEVERITIES.map((x) => `${SEVERITY_STYLES[x].label} ${s.severity[x]}`).join(', ')}`);
  const deps = Object.entries(view.architecture.project_metadata.external_dependencies ?? {}).slice(0, 25);
  if (deps.length) lines.push(`Dependencias externas: ${deps.map(([k, v]) => `${k} ${v}`).join(', ')}`);
  lines.push('Componentes (id | capa | loc | cbo | tablas | hallazgos):');
  for (const c of view.graph.components.slice(0, 200)) {
    lines.push(`- ${c.id} | ${layerLabel(c.layer, profile)} | ${c.loc} | ${c.cbo ?? '-'} | ${c.tables_used.join(' ') || '-'} | ${c.code_issues.map((i) => `${i.pattern}:${i.severity}`).join(' ') || '-'}`);
  }
  lines.push('Propuestas (en orden del plan):');
  for (const st of plan.stages) {
    for (const p of st.proposals) {
      lines.push(`- ${p.name} | viabilidad ${p.viability} | cohesión ${p.cohesion.toFixed(2)} | acoplamiento ${p.coupling.toFixed(2)} | componentes: ${p.components.join(', ')}`);
    }
  }
  if (view.warnings.length) lines.push(`Advertencias del análisis: ${view.warnings.join(' | ')}`);
  return { template, system: `${TEMPLATES[template]}\n\n${OUTPUT}`, user: lines.join('\n') };
}
