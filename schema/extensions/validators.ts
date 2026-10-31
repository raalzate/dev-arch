/* eslint-disable */
// GENERATED FILE — DO NOT EDIT.
// Generated from @static-inference/schema contract 1.0.0 (schema/1.0.0/*.schema.json)
// by schema/gen/generate.mjs. Regenerate with: npm --prefix schema run generate

import { z } from "zod";
import * as B from "../generated/validators.ts";
import type * as T from "./types.ts";

/** Validator of `InferenceConfig` (kind `inference-config`, inference-config.schema.json). */
export const inferenceConfigSchema: z.ZodTypeAny = z
  .object({
    detection: z
      .object({ maxDepth: z.number().int().gte(0).lte(5).optional() })
      .strict()
      .optional(),
    clustering: z
      .object({
        singleDomainRatio: z.number().gte(0).lte(1).optional(),
        largeClusterRatio: z.number().gte(0).lte(1).optional(),
      })
      .strict()
      .optional(),
    evidence: z
      .object({
        weights: z
          .object({
            table: z.number().gte(0).lte(1).optional(),
            call: z.number().gte(0).lte(1).optional(),
            token: z.number().gte(0).lte(1).optional(),
            event: z.number().gte(0).lte(1).optional(),
          })
          .strict()
          .optional(),
        edgeThreshold: z.number().gte(0).lte(1).optional(),
        callDensitySaturation: z.number().gt(0).lte(1).optional(),
        strongSignals: z
          .object({
            table: z.number().gte(0).lte(1).optional(),
            call: z.number().gte(0).lte(1).optional(),
            token: z.number().gte(0).lte(1).optional(),
          })
          .strict()
          .optional(),
        evidenceThreshold: z.number().gte(0).lte(1).optional(),
        minStrongSignals: z.number().int().gte(0).lte(4).optional(),
        roleKeywords: z.array(z.string().regex(new RegExp("^[^A-Z]*$")).min(1)).optional(),
        excludeTokens: z.array(z.string().min(1)).optional(),
        minPackageTokenLength: z.number().int().gte(0).optional(),
        eventPublisherKeywords: z.array(z.string().regex(new RegExp("^[^A-Z]*$")).min(1)).optional(),
        eventConsumerKeywords: z.array(z.string().regex(new RegExp("^[^A-Z]*$")).min(1)).optional(),
      })
      .strict()
      .optional(),
    consolidation: z
      .object({
        genericNames: z.array(z.string().min(1)).optional(),
        domainMergeMaxSize: z.number().int().gte(0).optional(),
        significantInfrastructureRatio: z.number().gte(0).lte(1).optional(),
        supportRatio: z.number().gte(0).lte(1).optional(),
        maxMergedSizeWithoutSimilarity: z.number().int().gte(0).optional(),
        highTokenSimilarity: z.number().gte(0).lte(1).optional(),
        separationCallDensity: z.number().gte(0).lte(1).optional(),
        separationTableJaccard: z.number().gte(0).lte(1).optional(),
        strongCandidate: z
          .object({
            minCohesion: z.number().gte(0).lte(1).optional(),
            maxCoupling: z.number().gte(0).lte(1).optional(),
            minSize: z.number().int().gte(0).optional(),
          })
          .strict()
          .optional(),
        infrastructureKeywords: z.array(z.string().regex(new RegExp("^[^A-Z]*$")).min(1)).optional(),
      })
      .strict()
      .optional(),
    viability: z
      .object({
        weights: z
          .object({
            cohesion: z.number().gte(0).lte(1).optional(),
            coupling: z.number().gte(0).lte(1).optional(),
            data: z.number().gte(0).lte(1).optional(),
          })
          .strict()
          .optional(),
        cohesionBlend: z
          .object({ average: z.number().gte(0).lte(1).optional(), density: z.number().gte(0).lte(1).optional() })
          .strict()
          .optional(),
        noTablesDataCohesion: z.number().gte(0).lte(1).optional(),
        smallSize: z
          .object({ below: z.number().int().gte(0).optional(), penalty: z.number().gte(0).lte(1).optional() })
          .strict()
          .optional(),
        largeSize: z
          .object({
            above: z.number().int().gte(0).optional(),
            minDensity: z.number().gte(0).lte(1).optional(),
            penalty: z.number().gte(0).lte(1).optional(),
          })
          .strict()
          .optional(),
        thresholds: z
          .object({ high: z.number().gte(0).lte(1).optional(), medium: z.number().gte(0).lte(1).optional() })
          .strict()
          .optional(),
        rationale: z
          .object({
            cohesionGood: z.number().gte(0).lte(1).optional(),
            cohesionFair: z.number().gte(0).lte(1).optional(),
            couplingGood: z.number().gte(0).lte(1).optional(),
            couplingFair: z.number().gte(0).lte(1).optional(),
            cboGood: z.number().gte(0).optional(),
            cboFair: z.number().gte(0).optional(),
            lcomGood: z.number().gte(0).lte(1).optional(),
            lcomFair: z.number().gte(0).lte(1).optional(),
            dataGood: z.number().gte(0).lte(1).optional(),
            dataFair: z.number().gte(0).lte(1).optional(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
    recommendation: z
      .object({
        supportRatio: z.number().gte(0).lte(1).optional(),
        infrastructureKeywords: z.array(z.string().regex(new RegExp("^[^A-Z]*$")).min(1)).optional(),
        dataJaccardMode: z.enum(["legacy", "data_cohesion"]).optional(),
        legacyDataJaccard: z.number().gte(0).lte(1).optional(),
      })
      .strict()
      .optional(),
    naming: z
      .object({
        infrastructureRatio: z.number().gte(0).lte(1).optional(),
        infrastructureLabels: z.record(z.string().min(1)).optional(),
        roleKeywords: z.array(z.string().regex(new RegExp("^[^A-Z]*$")).min(1)).optional(),
        excludeTokens: z.array(z.string().min(1)).optional(),
        minTokenLength: z.number().int().gte(0).optional(),
      })
      .strict()
      .optional(),
    dataAccess: z
      .object({
        procedures: z
          .enum(["auto", "on", "off"])
          .describe("Stored procedure detection: auto = Visual Basic compilations only.")
          .optional(),
        procedureCatalog: z
          .union([
            z
              .string()
              .describe(
                "Directory of .sql scripts (CREATE PROCEDURE) or .csv file (procedimiento,tabla,operación) translating procedures to tables.",
              ),
            z
              .null()
              .describe(
                "Directory of .sql scripts (CREATE PROCEDURE) or .csv file (procedimiento,tabla,operación) translating procedures to tables.",
              ),
          ])
          .describe(
            "Directory of .sql scripts (CREATE PROCEDURE) or .csv file (procedimiento,tabla,operación) translating procedures to tables.",
          )
          .optional(),
        catalogMode: z
          .enum(["complement", "replace"])
          .describe("complement keeps sp:<name> next to the tables; replace emits tables only.")
          .optional(),
        procedureWeight: z
          .number()
          .gte(0)
          .describe(
            "Weight of an sp: resource relative to a table in shared-data grouping, tables_shared and data cohesion; 0 ignores procedures.",
          )
          .optional(),
        entityHeuristic: z
          .boolean()
          .describe("Derive a business entity from procedure names for proposal naming.")
          .optional(),
      })
      .strict()
      .describe(
        "Data access parameters (020-stored-procedures): stored procedure detection in the .NET analyzer, the optional procedure catalog and the weight of sp: resources in the inference.",
      )
      .optional(),
    debt: z
      .object({
        enabled: z.enum(["auto", "on", "off"]).describe("auto = Visual Basic compilations only.").optional(),
        godClass: z
          .object({
            minLoc: z.number().int().gte(1).describe("Lines of code above which a type may be a god class.").optional(),
            minComplexity: z
              .number()
              .int()
              .gte(1)
              .describe("Maximum method complexity above which a type may be a god class.")
              .optional(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .describe("Legacy debt rules of the .NET analyzer (021-desktop-identity-layers).")
      .optional(),
    integrations: z
      .object({ outbound: z.enum(["auto", "on", "off"]).describe("auto = Visual Basic compilations only.").optional() })
      .strict()
      .describe("Outbound integration detection of the .NET analyzer (022-external-integrations).")
      .optional(),
    dependencies: z
      .object({
        enabled: z.enum(["auto", "on", "off"]).optional(),
        eol: z.array(z.string().min(1)).describe("Name prefixes added to schema/eol-dependencies.json.").optional(),
      })
      .strict()
      .describe("External dependency and end-of-life detection of the .NET analyzer (022-external-integrations).")
      .optional(),
  })
  .strict()
  .describe(
    "Inference configuration (008-configurable-inference): analysis-config.json, CLI --config, MCP config/configPath. Every property is optional; omitted properties keep the defaults (MCP resource static-inference://configuration/defaults). Range checks between properties (medium <= high, fair/good cuts) are enforced by the engine.",
  );

/** Validator of `ReinferArchitectureResponse` (kind `mcp/reinfer_architecture`, mcp/reinfer_architecture.response.schema.json). */
export const reinferArchitectureResponseSchema: z.ZodTypeAny = B.consolidatedArchitectureSchema;

/** Validator of `ScoreProposalResponse` (kind `mcp/score_proposal`, mcp/score_proposal.response.schema.json). */
export const scoreProposalResponseSchema: z.ZodTypeAny = z
  .object({
    meta: B.documentMetaSchema,
    name: z.string(),
    viability: z.enum(["Alta", "Media", "Baja"]),
    score: z.number(),
    metrics: z
      .object({
        cohesion_adjusted: z.number(),
        external_coupling: z.number(),
        data_cohesion: z.number(),
        internal_edge_density: z.number(),
        size: z.number().int().gte(1),
        cluster_count: z.number().int().gte(1),
      })
      .strict(),
    components: z.array(z.string()).min(1),
    clusters: z.array(z.number().int()).min(1),
    rationale: z.array(z.string()),
    recommended_actions: z.array(z.string()),
  })
  .strict()
  .describe(
    "Successful score_proposal response (008-configurable-inference): evaluation of a user-defined proposal with the formulas of the engine's proposals.",
  );

/** Validators of the extension kinds (separate from the original `validatorsByKind` registry). */
export const extensionValidatorsByKind: Record<string, z.ZodTypeAny> = {
  "inference-config": inferenceConfigSchema,
  "mcp/reinfer_architecture": reinferArchitectureResponseSchema,
  "mcp/score_proposal": scoreProposalResponseSchema,
};

/** Parses (and validates) a `InferenceConfig`; throws a ZodError naming the failing path. */
export const parseInferenceConfig = (doc: unknown): T.InferenceConfig =>
  inferenceConfigSchema.parse(doc) as T.InferenceConfig;
/** Parses (and validates) a `ReinferArchitectureResponse`; throws a ZodError naming the failing path. */
export const parseReinferArchitectureResponse = (doc: unknown): T.ReinferArchitectureResponse =>
  reinferArchitectureResponseSchema.parse(doc) as T.ReinferArchitectureResponse;
/** Parses (and validates) a `ScoreProposalResponse`; throws a ZodError naming the failing path. */
export const parseScoreProposalResponse = (doc: unknown): T.ScoreProposalResponse =>
  scoreProposalResponseSchema.parse(doc) as T.ScoreProposalResponse;
