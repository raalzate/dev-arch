export interface Component {
  id: string;
  files?: string[];
  layer?: string;
  loc?: number;
  tables_used?: string[];
  sensitive_data?: boolean;
  annotations?: string[];
  ejb_type?: string;
  interface?: boolean;
  is_interface?: boolean;
  secrets_references?: string[];
  external_dependencies?: string[];
  package_dependencies?: any[];
  extends?: string | null;
  implements?: string[];
  messaging_type?: string | null;
  messaging_role?: string | null;
  web_type?: string | null;
  web_role?: string | null;
  cbo?: number;
  lcom?: number | null;
  code_issues?: CodeIssue[];
}

export interface CodeIssue {
  type: string;
  severity: string;
  message: string;
  line: number;
  pattern: string;
  componentId?: string;
}

export interface Edge {
  from: string;
  to: string;
}

export interface ComponentsData {
  components: Component[];
  edges: Edge[];
  code_issues?: CodeIssue[];
}

export interface ProposalMetrics {
  size: number;
  cohesion_avg: number;
  external_coupling: number;
  tables: string[];
  sensitive: boolean;
}

export interface Proposal {
  id: number;
  name: string;
  viability: string;
  components?: string[];
  metrics: ProposalMetrics;
  rationale?: string[];
  recommended_actions?: string[];
}

export interface SupportLibrary {
  id: number;
  name: string;
  components: string[];
  clusters: number[];
}

export interface PackageDependencyDetails {
  components_count: number;
  total_dependencies_out: number;
  depends_on_packages: string[];
}


export interface ProjectMetadata {
  total_components: number;
  total_loc: number;
  shared_domain: string;
  components_with_secrets: number;
  external_dependencies: Record<string, string>;
  package_dependencies: Record<string, PackageDependencyDetails>;
}

export interface ArchitectureData {
  project_metadata?: ProjectMetadata;
  summary?: string;
  proposals?: Proposal[];
  support_libraries?: SupportLibrary[];
}
