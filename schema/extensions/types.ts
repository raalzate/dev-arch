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
  };
  recommendation?: {
    supportRatio?: number;
    infrastructureKeywords?: string[];
    dataJaccardMode?: "legacy" | "data_cohesion";
    legacyDataJaccard?: number;
  };
  naming?: {
    infrastructureRatio?: number;
    infrastructureLabels?: {
      [k: string]: string;
    };
    roleKeywords?: string[];
    excludeTokens?: string[];
    minTokenLength?: number;
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
