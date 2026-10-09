// Deterministic exports of the modernization plan (010 FR-034, FR-035; research D8): Markdown and JSON.
import type { ConsolidatedArchitecture } from '@static-inference/schema';
import type { InferenceParameters } from './inference';
import type { ModernizationPlan } from './plan';
import { SEVERITIES, SEVERITY_STYLES } from './severity';

const n2 = (x: number) => x.toFixed(2);

export function planToMarkdown(plan: ModernizationPlan): string {
  const L: string[] = [];
  const p = plan.profile;
  L.push(`# Plan de modernización: ${plan.project}`, '');
  L.push(`- Tecnología: ${p.label} (origen del análisis: ${p.source}${p.reducedFidelity ? ', fidelidad reducida' : ''})`);
  L.push(`- Análisis: ${plan.analysisId}${plan.finishedAt ? ` (${plan.finishedAt})` : ''}`, '');
  L.push('## Resumen ejecutivo', '');
  L.push(`- Componentes: ${plan.totals.components}`);
  L.push(`- Líneas de código: ${plan.totals.loc}`);
  L.push(`- Dependencias internas: ${plan.totals.edges}`);
  L.push(`- Endpoints expuestos: ${plan.totals.endpoints}`);
  L.push(`- Propuestas de extracción: ${plan.totals.proposals}`);
  const counts = plan.stages.map((s) => `${s.viability}: ${s.proposals.length}`).join(', ');
  if (counts) L.push(`- Viabilidad de las propuestas: ${counts}`);
  L.push('');
  L.push('## Hallazgos por severidad', '');
  for (const s of SEVERITIES) L.push(`- ${SEVERITY_STYLES[s].label}: ${plan.severityCounts[s]}`);
  L.push('');
  L.push('## Plan por etapas', '');
  if (plan.stages.length === 0) L.push('No hay propuestas de extracción.', '');
  for (const st of plan.stages) {
    L.push(`### Etapa ${st.index}. ${st.title} (viabilidad ${st.viability})`, '');
    for (const it of st.proposals) {
      L.push(`#### ${it.name}${it.edited ? ' (editada)' : ''}`, '');
      L.push(`- Viabilidad: ${it.viability}${it.score !== null ? ` (puntuación ${n2(it.score)})` : ''}`);
      L.push(`- Cohesión: ${n2(it.cohesion)}; acoplamiento externo: ${n2(it.coupling)}`);
      L.push(`- Componentes (${it.components.length}): ${it.components.join(', ')}`);
      if (it.tables.length) L.push(`- Tablas: ${it.tables.join(', ')}`);
      if (it.entrypoint) L.push(`- Punto de entrada legacy: ${it.entrypoint.type}${it.entrypoint.description ? `. ${it.entrypoint.description}` : ''}`);
      const risks: string[] = [];
      if (it.sensitive) risks.push('datos sensibles');
      if (it.componentsWithSecrets.length) risks.push(`secretos en ${it.componentsWithSecrets.join(', ')}`);
      if (it.severeIssues) risks.push(`${it.severeIssues} hallazgos críticos o de error`);
      if (risks.length) L.push(`- Riesgos: ${risks.join('; ')}`);
      if (it.actions.length) {
        L.push('- Acciones recomendadas:');
        for (const a of it.actions) L.push(`  - ${a}`);
      }
      if (it.rationale.length) {
        L.push('- Justificación:');
        for (const r of it.rationale) L.push(`  - ${r}`);
      }
      L.push('');
    }
  }
  if (plan.supportLibraries.length) {
    L.push('## Base compartida (librerías de soporte)', '');
    for (const l of plan.supportLibraries) L.push(`- ${l.name} (${l.components} componentes)`);
    L.push('');
  }
  if (plan.warnings.length) {
    L.push('## Advertencias del análisis', '');
    for (const w of plan.warnings) L.push(`- ${w}`);
    L.push('');
  }
  if (plan.parameters) {
    L.push('## Parámetros de inferencia', '');
    L.push('```json', JSON.stringify(plan.parameters, null, 2), '```', '');
  }
  return L.join('\n').replace(/\n+$/, '') + '\n';
}

export function exportPlanJson(architecture: ConsolidatedArchitecture, inference: InferenceParameters | { config: unknown; minViability: string | null } | null): string {
  return JSON.stringify({ architecture, inference }, null, 2) + '\n';
}
