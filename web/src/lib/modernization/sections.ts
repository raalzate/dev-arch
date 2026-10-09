// Declarative registry of result sections (010 FR-003..FR-006, FR-028; research D2; contracts/ui-sections.md).
// A section is shown only when it applies to the technology profile and has at least one item; applicable sections
// without items are named once per step in a "Sin hallazgos" line.
import type {
  Component, ConsolidatedArchitecture, DependencyGraph, EntrypointsDocument, Proposal, SupportLibrary,
} from '@static-inference/schema';
import { orderByRisk, orderProposals } from './ordering';
import { appliesTo, type TechnologyProfile, type TechnologyTarget } from './technology';

export type StepId = 'summary' | 'map' | 'proposals' | 'findings' | 'plan';

export const STEPS: readonly { id: StepId; label: string; question: string }[] = [
  { id: 'summary', label: 'Resumen', question: '¿En qué estado está el sistema legacy?' },
  { id: 'map', label: 'Mapa del sistema', question: '¿Dónde está el acoplamiento real?' },
  { id: 'proposals', label: 'Propuestas', question: '¿Qué se puede extraer y con qué viabilidad?' },
  { id: 'findings', label: 'Hallazgos', question: '¿Qué riesgos y contratos hay que atender?' },
  { id: 'plan', label: 'Plan', question: '¿En qué orden modernizar?' },
];

/** Presentation aggregate of one analysis. */
export interface AnalysisView {
  graph: DependencyGraph;
  architecture: ConsolidatedArchitecture;
  contracts?: EntrypointsDocument | null;
  warnings: string[];
}

type Edge = DependencyGraph['edges'][number];
type Endpoint = DependencyGraph['api_contracts']['endpoints'][number];
type SecretLocation = NonNullable<ConsolidatedArchitecture['project_metadata']['secrets_locations']>[number];
export type IssueRow = Component['code_issues'][number] & { componentId: string };

export interface SectionDef<T = unknown> {
  id: string;
  step: StepId;
  title: string;
  appliesTo: 'all' | readonly TechnologyTarget[];
  items(view: AnalysisView, profile: TechnologyProfile): T[];
}

const VB_LEGACY_PATTERNS = new Set(['OPTION_STRICT_OFF', 'ON_ERROR_RESUME_NEXT', 'GOTO_STATEMENT', 'LATE_BINDING']);
const comps = (v: AnalysisView) => v.graph.components;
const issues = (v: AnalysisView): IssueRow[] => comps(v).flatMap((c) => c.code_issues.map((i) => ({ ...i, componentId: c.id })));
const edgeTypes = (e: Edge) => e.type.split(',').map((t) => t.trim());

function def<T>(d: SectionDef<T>): SectionDef<T> {
  return d;
}

export const SECTIONS: readonly SectionDef[] = [
  // Summary
  def<string>({ id: 'summary-warnings', step: 'summary', title: 'Advertencias del análisis', appliesTo: 'all', items: (v) => v.warnings }),
  def<Proposal>({ id: 'summary-candidates', step: 'summary', title: 'Candidatas a extracción', appliesTo: 'all', items: (v) => orderProposals(v.architecture.proposals).slice(0, 3) }),
  def<Component>({ id: 'summary-risky', step: 'summary', title: 'Componentes de mayor riesgo', appliesTo: 'all', items: (v) => orderByRisk(comps(v)).slice(0, 8) }),
  // Proposals
  def<SupportLibrary>({ id: 'support-libraries', step: 'proposals', title: 'Librerías de soporte (base compartida)', appliesTo: 'all', items: (v) => v.architecture.support_libraries }),
  // Findings — technology inventory
  def<Component>({ id: 'java-deprecated', step: 'findings', title: 'Componentes obsoletos (@Deprecated)', appliesTo: ['java'], items: (v) => comps(v).filter((c) => c.annotations.includes('Deprecated')) }),
  def<Component>({ id: 'java-ejb', step: 'findings', title: 'Componentes EJB', appliesTo: ['java'], items: (v) => comps(v).filter((c) => !!c.ejb_type) }),
  def<Component>({ id: 'java-jndi', step: 'findings', title: 'Uso de JNDI', appliesTo: ['java'], items: (v) => comps(v).filter((c) => c.uses_jndi) }),
  def<Edge>({ id: 'csharp-di', step: 'findings', title: 'Dependencias inyectadas y registradas en el contenedor', appliesTo: ['csharp'], items: (v) => v.graph.edges.filter((e) => edgeTypes(e).some((t) => t === 'injection' || t === 'registration')) }),
  def<Component>({ id: 'vb-desktop-ui', step: 'findings', title: 'Presentación de escritorio (formularios y reportes)', appliesTo: ['vb'], items: (v) => comps(v).filter((c) => c.layer === 'Web' && c.files.some((f) => f.toLowerCase().endsWith('.vb'))) }),
  def<Component>({ id: 'vb-modules', step: 'findings', title: 'Módulos compartidos', appliesTo: ['vb'], items: (v) => comps(v).filter((c) => c.layer === 'Compartida' && c.files.some((f) => f.toLowerCase().endsWith('.vb'))) }),
  def<IssueRow>({ id: 'vb-legacy-risks', step: 'findings', title: 'Riesgos de VB legacy', appliesTo: ['vb'], items: (v) => issues(v).filter((i) => VB_LEGACY_PATTERNS.has(i.pattern)) }),
  def<SecretLocation>({ id: 'dotnet-app-config', step: 'findings', title: 'Configuración de aplicación (.config)', appliesTo: ['dotnet'], items: (v) => (v.architecture.project_metadata.secrets_locations ?? []).filter((s) => s.path.toLowerCase().endsWith('.config')) }),
  def<Component>({ id: 'interfaces', step: 'findings', title: 'Interfaces', appliesTo: 'all', items: (v) => comps(v).filter((c) => c.is_interface) }),
  def<Component>({ id: 'messaging', step: 'findings', title: 'Mensajería', appliesTo: 'all', items: (v) => comps(v).filter((c) => !!c.messaging_type) }),
  def<Component>({ id: 'data-access', step: 'findings', title: 'Acceso a datos (tablas)', appliesTo: 'all', items: (v) => comps(v).filter((c) => c.tables_used.length > 0) }),
  def<[string, string]>({ id: 'external-deps', step: 'findings', title: 'Dependencias externas', appliesTo: 'all', items: (v) => Object.entries(v.architecture.project_metadata.external_dependencies ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)) }),
  // Findings — tabs
  def<IssueRow>({ id: 'tab-issues', step: 'findings', title: 'Problemas de código', appliesTo: 'all', items: issues }),
  def<Component | SecretLocation>({ id: 'tab-secrets', step: 'findings', title: 'Secretos', appliesTo: 'all', items: (v) => [...comps(v).filter((c) => c.secrets_references.length > 0), ...(v.architecture.project_metadata.secrets_locations ?? [])] }),
  def<Endpoint>({ id: 'tab-contracts', step: 'findings', title: 'Contratos', appliesTo: 'all', items: (v) => v.graph.api_contracts.endpoints }),
  def<Proposal>({ id: 'tab-entrypoints', step: 'findings', title: 'Puntos de entrada', appliesTo: 'all', items: (v) => v.architecture.proposals.filter((p) => !!p.legacy_entrypoint && p.legacy_entrypoint.type !== 'internal') }),
];

export const FINDINGS_TABS = ['tab-issues', 'tab-secrets', 'tab-contracts', 'tab-entrypoints'] as const;

export function sectionApplies(d: SectionDef, profile: TechnologyProfile): boolean {
  return appliesTo(profile, d.appliesTo);
}

export function sectionById(id: string): SectionDef | undefined {
  return SECTIONS.find((s) => s.id === id);
}

export interface ResolvedSections {
  visible: { def: SectionDef; items: unknown[] }[];
  empty: { id: string; title: string }[];
}

export function resolveSections(step: StepId, profile: TechnologyProfile, view: AnalysisView): ResolvedSections {
  const out: ResolvedSections = { visible: [], empty: [] };
  for (const d of SECTIONS) {
    if (d.step !== step || !sectionApplies(d, profile)) continue;
    const items = d.items(view, profile);
    if (items.length > 0) out.visible.push({ def: d, items });
    else out.empty.push({ id: d.id, title: d.title });
  }
  return out;
}
