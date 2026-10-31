/* eslint-disable */
// GENERATED FILE — DO NOT EDIT.
// Generated from @static-inference/schema contract 1.0.0 (schema/1.0.0/*.schema.json)
// by schema/gen/generate.mjs. Regenerate with: npm --prefix schema run generate

import type { ConsolidatedArchitecture, DocumentMeta } from "../generated/types.ts";

/**
 * Extension documents and MCP responses of contract 1.0.0 (separate registry, 010-modernization-ux).
 */
export interface StaticInferenceContractExtensions {
  InferenceConfig: InferenceConfig;
  ScoreProposalResponse: ScoreProposalResponse;
}
/**
 * Inference configuration (008-configurable-inference): analysis-config.json, CLI --config, MCP config/configPath. Every property is optional; omitted properties keep the defaults (MCP resource static-inference://configuration/defaults). Range checks between properties (medium <= high, fair/good cuts) are enforced by the engine.
 */
export interface InferenceConfig {
  detection?: {
    maxDepth?: number;
  };
  clustering?: {
    singleDomainRatio?: number;
    largeClusterRatio?: number;
    /**
     * 023: in the entity path, a component without procedures joins the cluster it calls most.
     */
    attachCallersToTargets?: boolean;
    /**
     * 023: transitive = components sharing procedures (transitively) form one cluster; entity = components grouped by the stem of their dominant procedure entity.
     */
    procedureGrouping?: "transitive" | "entity";
  };
  evidence?: {
    weights?: {
      table?: number;
      call?: number;
      token?: number;
      event?: number;
    };
    edgeThreshold?: number;
    callDensitySaturation?: number;
    strongSignals?: {
      table?: number;
      call?: number;
      token?: number;
    };
    evidenceThreshold?: number;
    minStrongSignals?: number;
    roleKeywords?: string[];
    excludeTokens?: string[];
    minPackageTokenLength?: number;
    eventPublisherKeywords?: string[];
    eventConsumerKeywords?: string[];
  };
  consolidation?: {
    genericNames?: string[];
    domainMergeMaxSize?: number;
    significantInfrastructureRatio?: number;
    supportRatio?: number;
    maxMergedSizeWithoutSimilarity?: number;
    highTokenSimilarity?: number;
    separationCallDensity?: number;
    separationTableJaccard?: number;
    strongCandidate?: {
      minCohesion?: number;
      maxCoupling?: number;
      minSize?: number;
    };
    infrastructureKeywords?: string[];
    /**
     * 023: share of a cluster's outgoing cross-cluster calls (support clusters excluded) that must target one other cluster to merge both as a vertical slice; 0 disables the rule.
     */
    verticalSliceRatio?: number;
    /**
     * 023: merge clusters whose dominant procedure entities share a stem.
     */
    entityStemMerge?: boolean;
  };
  viability?: {
    weights?: {
      cohesion?: number;
      coupling?: number;
      data?: number;
    };
    cohesionBlend?: {
      average?: number;
      density?: number;
    };
    noTablesDataCohesion?: number;
    smallSize?: {
      below?: number;
      penalty?: number;
    };
    largeSize?: {
      above?: number;
      minDensity?: number;
      penalty?: number;
    };
    thresholds?: {
      high?: number;
      medium?: number;
    };
    rationale?: {
      cohesionGood?: number;
      cohesionFair?: number;
      couplingGood?: number;
      couplingFair?: number;
      cboGood?: number;
      cboFair?: number;
      lcomGood?: number;
      lcomFair?: number;
      dataGood?: number;
      dataFair?: number;
    };
    /**
     * 023: weight of the debt index subtracted from the viability score; 0 keeps the 1.2.0 score.
     */
    debtWeight?: number;
    /**
     * 023: calls to support-library members do not count as external coupling.
     */
    ignoreSupportCoupling?: boolean;
    /**
     * 024: weight of (1 - MI/100) added to the debt index when the component carries Maintainability:<n>.
     */
    maintainabilityWeight?: number;
  };
  recommendation?: {
    supportRatio?: number;
    infrastructureKeywords?: string[];
    dataJaccardMode?: "legacy" | "data_cohesion";
    legacyDataJaccard?: number;
    /**
     * 023: namespace segments whose components form support libraries.
     */
    supportNamespaces?: string[];
    /**
     * 023: distinct calling domains from which a group is a shared support library; 0 disables the rule.
     */
    minReferencingDomains?: number;
  };
  naming?: {
    infrastructureRatio?: number;
    infrastructureLabels?: {
      [k: string]: string;
    };
    roleKeywords?: string[];
    excludeTokens?: string[];
    minTokenLength?: number;
    /**
     * 023: tokens = 1.2.0 names; domain = namespace domain shared by the members.
     */
    strategy?: "tokens" | "domain";
  };
  /**
   * Data access parameters (020-stored-procedures): stored procedure detection in the .NET analyzer, the optional procedure catalog and the weight of sp: resources in the inference.
   */
  dataAccess?: {
    /**
     * Stored procedure detection: auto = Visual Basic compilations only.
     */
    procedures?: "auto" | "on" | "off";
    /**
     * Directory of .sql scripts (CREATE PROCEDURE) or .csv file (procedimiento,tabla,operación) translating procedures to tables.
     */
    procedureCatalog?: string | null;
    /**
     * complement keeps sp:<name> next to the tables; replace emits tables only.
     */
    catalogMode?: "complement" | "replace";
    /**
     * Weight of an sp: resource relative to a table in shared-data grouping, tables_shared and data cohesion; 0 ignores procedures.
     */
    procedureWeight?: number;
    /**
     * Derive a business entity from procedure names for proposal naming.
     */
    entityHeuristic?: boolean;
  };
  /**
   * Legacy debt rules of the .NET analyzer (021-desktop-identity-layers).
   */
  debt?: {
    /**
     * auto = Visual Basic compilations only.
     */
    enabled?: "auto" | "on" | "off";
    godClass?: {
      /**
       * Lines of code above which a type may be a god class.
       */
      minLoc?: number;
      /**
       * Maximum method complexity above which a type may be a god class.
       */
      minComplexity?: number;
    };
  };
  /**
   * Outbound integration detection of the .NET analyzer (022-external-integrations).
   */
  integrations?: {
    /**
     * auto = Visual Basic compilations only.
     */
    outbound?: "auto" | "on" | "off";
  };
  /**
   * External dependency and end-of-life detection of the .NET analyzer (022-external-integrations).
   */
  dependencies?: {
    enabled?: "auto" | "on" | "off";
    /**
     * Name prefixes added to schema/eol-dependencies.json.
     */
    eol?: string[];
  };
  /**
   * Inference-wide parameters and preset (023-legacy-desktop-inference).
   */
  inference?: {
    /**
     * auto = legacy-desktop for Visual Basic graphs (meta.source roslyn-fallback or >= 50% .vb components); none = never.
     */
    preset?: "auto" | "none" | "legacy-desktop";
    /**
     * false = Layer:Presentación/Layer:Reportes members do not count in cohesion or internal density.
     */
    presentationInCohesion?: boolean;
  };
  /**
   * Extended static analysis of the .NET analyzer (024-extended-static-analysis).
   */
  analysis?: {
    /**
     * off by default (opt-in); auto = Visual Basic compilations only; on = every compilation.
     */
    extended?: "auto" | "on" | "off";
    /**
     * Official analyzer rule ids to evaluate; empty = the versioned list schema/extended-rules.json.
     */
    rules?: string[];
    /**
     * Minimum normalized tokens of a duplicated method.
     */
    duplicateMinTokens?: number;
    /**
     * SARIF 2.1.0 reports merged into code_issues (paths relative to the analyzed project).
     */
    sarif?: string[];
    /**
     * Layer:RULE entries removed for components of that fine layer.
     */
    layerSuppressions?: string[];
    /**
     * 025: directory of .NET Framework reference assemblies (*.dll and Facades/*.dll) used by the VB Adhoc fallback instead of the host runtime assemblies; null = default.
     */
    referenceAssemblies?: string | null;
  };
}
/**
 * Successful score_proposal response (008-configurable-inference): evaluation of a user-defined proposal with the formulas of the engine's proposals.
 */
export interface ScoreProposalResponse {
  meta: DocumentMeta;
  name: string;
  viability: "Alta" | "Media" | "Baja";
  score: number;
  metrics: {
    cohesion_adjusted: number;
    external_coupling: number;
    data_cohesion: number;
    internal_edge_density: number;
    size: number;
    cluster_count: number;
  };
  /**
   * @minItems 1
   */
  components: string[];
  /**
   * @minItems 1
   */
  clusters: number[];
  rationale: string[];
  recommended_actions: string[];
}

/**
 * Successful reinfer_architecture response (008-configurable-inference, with or without minViability): the consolidated architecture document re-inferred from a stored dependency graph.
 */
export type ReinferArchitectureResponse = ConsolidatedArchitecture;
