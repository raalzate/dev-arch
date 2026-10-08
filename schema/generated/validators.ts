/* eslint-disable */
// GENERATED FILE — DO NOT EDIT.
// Generated from @static-inference/schema contract 1.0.0 (schema/1.0.0/*.schema.json)
// by schema/gen/generate.mjs. Regenerate with: npm --prefix schema run generate

import { z } from "zod";
import type * as T from "./types.ts";

/** Validator of the `ApiContracts` definition. */
export const apiContractsSchema: z.ZodTypeAny = z
  .object({
    meta: z.lazy(() => documentMetaSchema).optional(),
    endpoints: z.array(z.lazy(() => apiEndpointSchema)),
    schemas: z.record(z.lazy(() => apiSchemaSchema)).describe("Dynamic map: schema name -> schema."),
  })
  .strict()
  .describe("Endpoints and data schemas (output_entrypoints.json, embedded as api_contracts in the graph).");

/** Validator of the `ApiEndpoint` definition. */
export const apiEndpointSchema: z.ZodTypeAny = z
  .object({
    id: z.string(),
    path: z.string(),
    method: z.string().describe("HTTP verb or non-HTTP kind (STRUTS_ACTION, SOAP, LISTENER, ...); open set."),
    description: z.union([z.string(), z.null()]).optional(),
    parameters: z.array(z.lazy(() => parameterSchema)),
    request_body_schema: z.union([z.string(), z.null()]).optional(),
    response_schema: z
      .union([
        z.string().describe("Name of the response schema; omitted by the .NET analyzer when null."),
        z.null().describe("Name of the response schema; omitted by the .NET analyzer when null."),
      ])
      .describe("Name of the response schema; omitted by the .NET analyzer when null.")
      .optional(),
    component_id: z.string(),
  })
  .strict()
  .describe("Entry point exposed by a component.");

/** Validator of the `ApiSchema` definition. */
export const apiSchemaSchema: z.ZodTypeAny = z
  .object({
    type: z.string(),
    properties: z.record(z.lazy(() => apiSchemaPropertySchema)).describe("Dynamic map: property name -> property."),
  })
  .strict()
  .describe("Data schema referenced by endpoints.");

/** Validator of the `ApiSchemaProperty` definition. */
export const apiSchemaPropertySchema: z.ZodTypeAny = z
  .object({ type: z.string() })
  .strict()
  .describe("Property of a data schema.");

/** Validator of the `CodeIssue` definition. */
export const codeIssueSchema: z.ZodTypeAny = z
  .object({
    type: z.enum(["BUG_PATTERN", "CODE_STYLE", "SECURITY", "PERFORMANCE"]),
    severity: z.enum(["INFO", "WARNING", "ERROR", "CRITICAL"]),
    message: z.string().min(1),
    line: z.number().int().gte(0).describe("Line number (0 when unknown)."),
    pattern: z.string().min(1).describe("Rule identifier (open set of values)."),
  })
  .strict()
  .describe("Static code issue detected in a component.");

/** Validator of the `Component` definition. */
export const componentSchema: z.ZodTypeAny = z
  .object({
    id: z.string().min(1).describe("Fully qualified name."),
    files: z.array(z.string()).describe("Source files of the component."),
    loc: z.number().int().gte(0).describe("Lines of code."),
    tables_used: z.array(z.string()),
    sensitive_data: z.boolean(),
    secrets_references: z.array(z.string()),
    layer: z
      .enum(["Controlador", "Negocio", "Datos", "Persistencia", "Dominio", "Transferencia", "Web", "Compartida"])
      .describe('Architectural layer. "Datos" is the historical alias of "Persistencia".'),
    calls_out: z.array(z.string()),
    calls_in: z.array(z.string()),
    annotations: z.array(z.string()),
    implements: z.array(z.string()),
    external_dependencies: z.array(z.string()),
    package_dependencies: z.array(z.lazy(() => packageGroupSchema)),
    code_issues: z.array(z.lazy(() => codeIssueSchema)),
    uses_jndi: z.boolean(),
    is_interface: z.boolean(),
    interface: z
      .boolean()
      .describe("Deprecated duplicate of is_interface (emitted by the Java engine only).")
      .optional(),
    domain: z.union([z.string(), z.null()]).optional(),
    ejb_type: z.union([z.string(), z.null()]).optional(),
    extends: z.union([z.string(), z.null()]).optional(),
    messaging_type: z
      .union([
        z.string().describe("Open set of values (jms, MassTransit, ...)."),
        z.null().describe("Open set of values (jms, MassTransit, ...)."),
      ])
      .describe("Open set of values (jms, MassTransit, ...).")
      .optional(),
    messaging_role: z
      .union([z.string().describe("Open set of values."), z.null().describe("Open set of values.")])
      .describe("Open set of values.")
      .optional(),
    web_type: z.union([z.string(), z.null()]).optional(),
    web_role: z.union([z.string(), z.null()]).optional(),
    cbo: z
      .union([z.number().int().gte(0), z.null()])
      .describe("Coupling Between Objects.")
      .optional(),
    lcom: z
      .union([z.number().gte(0).lte(1), z.null()])
      .describe("Lack of Cohesion in Methods (LCOM-HS, 0 = cohesive).")
      .optional(),
    complexity_avg: z
      .union([z.number().gte(0), z.null()])
      .describe("Average cyclomatic complexity.")
      .optional(),
    complexity_max: z
      .union([z.number().int().gte(0), z.null()])
      .describe("Maximum cyclomatic complexity.")
      .optional(),
  })
  .strict()
  .describe("Unit of analysis (class/interface/enum or .NET type).");

/** Validator of the `DocumentMeta` definition. */
export const documentMetaSchema: z.ZodTypeAny = z
  .object({ schema_version: z.lazy(() => schemaVersionSchema) })
  .strict()
  .describe("Contract metadata of the consolidated architecture and entrypoints documents.");

/** Validator of the `Edge` definition. */
export const edgeSchema: z.ZodTypeAny = z
  .object({
    from: z.string(),
    to: z.string(),
    weight: z.number().int().gte(0),
    type: z
      .string()
      .regex(new RegExp("^[a-z][a-z-]*(,[a-z][a-z-]*)*$"))
      .describe("Edge kind; open set, composite values are comma separated (e.g. call,use,injection-constructor)."),
  })
  .strict()
  .describe("Dependency between two components.");

/** Validator of the `GraphMeta` definition. */
export const graphMetaSchema: z.ZodTypeAny = z
  .object({
    source: z
      .enum(["spoon", "roslyn", "roslyn-fallback"])
      .describe(
        "Producer of the graph: Java (Spoon) or .NET (Roslyn, or Roslyn adhoc fallback with reduced fidelity).",
      ),
    schema_version: z.lazy(() => schemaVersionSchema),
    collected_at: z
      .string()
      .datetime({ offset: true })
      .describe("Collection timestamp (ISO 8601), only when STATIC_INFERENCE_COLLECTED_AT is enabled.")
      .optional(),
    microservice_candidates: z.record(z.string()).describe("Dynamic map: component id -> candidate cluster name."),
    dependency_accuracy: z
      .union([
        z.record(z.any()).describe("Optional accuracy report (reserved)."),
        z.null().describe("Optional accuracy report (reserved)."),
      ])
      .describe("Optional accuracy report (reserved).")
      .optional(),
    decomposition_accuracy: z
      .union([
        z.record(z.any()).describe("Optional accuracy report (reserved)."),
        z.null().describe("Optional accuracy report (reserved)."),
      ])
      .describe("Optional accuracy report (reserved).")
      .optional(),
  })
  .strict()
  .describe("Metadata of the dependency graph.");

/** Validator of the `LegacyEntrypoint` definition. */
export const legacyEntrypointSchema: z.ZodTypeAny = z
  .object({
    type: z.enum(["rest", "messaging", "service", "internal"]),
    primary_entry_class: z.string().optional(),
    exposed_operations: z.array(z.string()).optional(),
    messaging_channels: z.array(z.string()).optional(),
    endpoints: z.array(z.lazy(() => apiEndpointSchema)).optional(),
    description: z.string().optional(),
  })
  .strict()
  .describe("How the legacy system enters the proposal (null members are omitted).");

/** Validator of the `PackageDependencyInfo` definition. */
export const packageDependencyInfoSchema: z.ZodTypeAny = z
  .object({
    components_count: z.number().int().gte(0),
    total_dependencies_out: z.number().int().gte(0),
    depends_on_packages: z.array(z.string()),
  })
  .strict()
  .describe("Aggregated dependencies of a package.");

/** Validator of the `PackageGroup` definition. */
export const packageGroupSchema: z.ZodTypeAny = z
  .object({ package_name: z.string(), components: z.array(z.string()), count: z.number().int().gte(0) })
  .strict()
  .describe("Internal package a component depends on.");

/** Validator of the `Parameter` definition. */
export const parameterSchema: z.ZodTypeAny = z
  .object({
    name: z.string(),
    in: z.string().describe("path, query, header, body (open set)."),
    type: z.string(),
    required: z.boolean(),
  })
  .strict()
  .describe("Endpoint parameter.");

/** Validator of the `ProjectMetadata` definition. */
export const projectMetadataSchema: z.ZodTypeAny = z
  .object({
    external_dependencies: z.record(z.string()).describe("Dynamic map: dependency key -> coordinates.").optional(),
    package_dependencies: z
      .record(z.lazy(() => packageDependencyInfoSchema))
      .describe("Dynamic map: package -> aggregated dependencies.")
      .optional(),
    total_components: z.number().int().gte(0).optional(),
    total_loc: z.number().int().gte(0).optional(),
    components_with_secrets: z.number().int().gte(0).describe("Number of components referencing secrets.").optional(),
    shared_domain: z.string().optional(),
    secrets_locations: z.array(z.lazy(() => secretLocationSchema)).optional(),
  })
  .strict()
  .describe("Project-level metadata (null members are omitted).");

/** Validator of the `Proposal` definition. */
export const proposalSchema: z.ZodTypeAny = z
  .object({
    id: z.number().int(),
    name: z.string(),
    viability: z.enum(["Alta", "Media", "Baja"]),
    clusters: z.array(z.number().int()),
    components: z.array(z.string()),
    metrics: z.lazy(() => proposalMetricsSchema),
    signals: z.lazy(() => proposalSignalsSchema),
    rationale: z.array(z.string()),
    recommended_actions: z.array(z.string()),
    tables: z.array(z.lazy(() => proposalTableSchema)).optional(),
    legacy_entrypoint: z.union([z.lazy(() => legacyEntrypointSchema), z.null()]).optional(),
  })
  .strict()
  .describe("Microservice extraction proposal.");

/** Validator of the `ProposalMetrics` definition. */
export const proposalMetricsSchema: z.ZodTypeAny = z
  .object({
    size: z.number().int().gte(0),
    cohesion_avg: z.number(),
    external_coupling: z.number(),
    internal_edge_density: z.number(),
    data_jaccard: z.number(),
    tables: z.array(z.string()),
    sensitive: z.boolean(),
    tables_source: z.string().describe("Open set (jpa, orm, sql-parse, mixed, none).").optional(),
  })
  .strict()
  .describe("Metrics of a microservice proposal.");

/** Validator of the `ProposalSignals` definition. */
export const proposalSignalsSchema: z.ZodTypeAny = z
  .object({
    avg_cluster_size: z.number(),
    cluster_count: z.number().int().gte(0),
    total_components: z.number().int().gte(0),
  })
  .strict()
  .describe("Clustering signals of a proposal.");

/** Validator of the `ProposalTable` definition. */
export const proposalTableSchema: z.ZodTypeAny = z
  .object({ name: z.string(), component: z.string(), source: z.string() })
  .strict()
  .describe("Table used by a proposal.");

/** Validator of the `SchemaVersion` definition. */
export const schemaVersionSchema: z.ZodTypeAny = z
  .literal("1.0.0")
  .describe('Semantic version of the output contract. Contract 1.0.0 only accepts "1.0.0".');

/** Validator of the `SecretLocation` definition. */
export const secretLocationSchema: z.ZodTypeAny = z
  .object({
    path: z.string(),
    line: z.number().int().gte(0),
    kind: z.string().describe("Open set (API_KEY, JDBC_PASSWORD, ...)."),
    redacted: z.boolean(),
  })
  .strict()
  .describe("Location of a (redacted) secret.");

/** Validator of the `SupportLibrary` definition. */
export const supportLibrarySchema: z.ZodTypeAny = z
  .object({
    id: z.number().int(),
    name: z.string(),
    clusters: z.array(z.number().int()),
    components: z.array(z.string()),
  })
  .strict()
  .describe("Shared library candidate.");

/** Validator of `DependencyGraph` (kind `dependency-graph`, dependency-graph.schema.json). */
export const dependencyGraphSchema: z.ZodTypeAny = z
  .object({
    components: z.array(z.lazy(() => componentSchema)),
    edges: z.array(z.lazy(() => edgeSchema)),
    api_contracts: z.lazy(() => apiContractsSchema),
    meta: z.lazy(() => graphMetaSchema),
  })
  .strict()
  .describe(
    "Dependency graph (output.json; MCP get_dependency_graph). api_contracts.meta is optional (the raw .NET graph does not emit it).",
  );

/** Validator of `ConsolidatedArchitecture` (kind `architecture`, architecture.schema.json). */
export const consolidatedArchitectureSchema: z.ZodTypeAny = z
  .object({
    meta: z.lazy(() => documentMetaSchema),
    project_metadata: z.lazy(() => projectMetadataSchema),
    proposals: z.array(z.lazy(() => proposalSchema)),
    support_libraries: z.array(z.lazy(() => supportLibrarySchema)),
    summary: z.string(),
  })
  .strict()
  .describe("Consolidated architecture proposal (output_architecture.json; MCP get_architecture_proposal).");

/** Validator of `EntrypointsDocument` (kind `entrypoints`, entrypoints.schema.json). */
export const entrypointsDocumentSchema: z.ZodTypeAny = z
  .object({
    meta: z.lazy(() => documentMetaSchema),
    endpoints: z.array(z.lazy(() => apiEndpointSchema)),
    schemas: z.record(z.lazy(() => apiSchemaSchema)).describe("Dynamic map: schema name -> schema."),
  })
  .strict()
  .describe(
    "Entrypoints / API contracts document (output_entrypoints.json; MCP get_api_contracts): ApiContracts with meta required.",
  );

/** Validator of `AnalyzeProjectResponse` (kind `mcp/analyze_project`, mcp/analyze_project.response.schema.json). */
export const analyzeProjectResponseSchema: z.ZodTypeAny = z
  .object({
    componentCount: z.number().int().gte(0),
    edgeCount: z.number().int().gte(0),
    proposalCount: z.number().int().gte(0),
    endpointCount: z.number().int().gte(0),
    filesGenerated: z
      .array(z.string())
      .min(3)
      .max(3)
      .describe("Paths of output.json, output_architecture.json and output_entrypoints.json."),
    summary: z.string(),
  })
  .strict()
  .describe("Successful analyze_project response: analysis summary (camelCase, unchanged shape, no meta).");

/** Validator of `GetDependencyGraphResponse` (kind `mcp/get_dependency_graph`, mcp/get_dependency_graph.response.schema.json). */
export const getDependencyGraphResponseSchema: z.ZodTypeAny = dependencyGraphSchema;

/** Validator of `GetArchitectureProposalResponse` (kind `mcp/get_architecture_proposal`, mcp/get_architecture_proposal.response.schema.json). */
export const getArchitectureProposalResponseSchema: z.ZodTypeAny = consolidatedArchitectureSchema;

/** Validator of `GetApiContractsResponse` (kind `mcp/get_api_contracts`, mcp/get_api_contracts.response.schema.json). */
export const getApiContractsResponseSchema: z.ZodTypeAny = entrypointsDocumentSchema;

/** Validator of `GetComponentMetricsResponse` (kind `mcp/get_component_metrics`, mcp/get_component_metrics.response.schema.json). */
export const getComponentMetricsResponseSchema: z.ZodTypeAny = componentSchema;

/** Validator of `ReinferArchitectureResponse` (kind `mcp/reinfer_architecture`, mcp/reinfer_architecture.response.schema.json). */
export const reinferArchitectureResponseSchema: z.ZodTypeAny = consolidatedArchitectureSchema;

/** Validator of `ScoreProposalResponse` (kind `mcp/score_proposal`, mcp/score_proposal.response.schema.json). */
export const scoreProposalResponseSchema: z.ZodTypeAny = z
  .object({
    meta: z.lazy(() => documentMetaSchema),
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
  })
  .strict()
  .describe(
    "Inference configuration (008-configurable-inference): analysis-config.json, CLI --config, MCP config/configPath. Every property is optional; omitted properties keep the defaults (MCP resource static-inference://configuration/defaults). Range checks between properties (medium <= high, fair/good cuts) are enforced by the engine.",
  );

/** Validators by contract kind (as accepted by `npm run check -- --kind`). */
export const validatorsByKind: Record<string, z.ZodTypeAny> = {
  "dependency-graph": dependencyGraphSchema,
  architecture: consolidatedArchitectureSchema,
  entrypoints: entrypointsDocumentSchema,
  "mcp/analyze_project": analyzeProjectResponseSchema,
  "mcp/get_dependency_graph": getDependencyGraphResponseSchema,
  "mcp/get_architecture_proposal": getArchitectureProposalResponseSchema,
  "mcp/get_api_contracts": getApiContractsResponseSchema,
  "mcp/get_component_metrics": getComponentMetricsResponseSchema,
  "mcp/reinfer_architecture": reinferArchitectureResponseSchema,
  "mcp/score_proposal": scoreProposalResponseSchema,
  "inference-config": inferenceConfigSchema,
};

/** Parses (and validates) a `DependencyGraph`; throws a ZodError naming the failing path. */
export const parseDependencyGraph = (doc: unknown): T.DependencyGraph =>
  dependencyGraphSchema.parse(doc) as T.DependencyGraph;
/** Parses (and validates) a `ConsolidatedArchitecture`; throws a ZodError naming the failing path. */
export const parseConsolidatedArchitecture = (doc: unknown): T.ConsolidatedArchitecture =>
  consolidatedArchitectureSchema.parse(doc) as T.ConsolidatedArchitecture;
/** Parses (and validates) a `EntrypointsDocument`; throws a ZodError naming the failing path. */
export const parseEntrypointsDocument = (doc: unknown): T.EntrypointsDocument =>
  entrypointsDocumentSchema.parse(doc) as T.EntrypointsDocument;
/** Parses (and validates) a `AnalyzeProjectResponse`; throws a ZodError naming the failing path. */
export const parseAnalyzeProjectResponse = (doc: unknown): T.AnalyzeProjectResponse =>
  analyzeProjectResponseSchema.parse(doc) as T.AnalyzeProjectResponse;
/** Parses (and validates) a `GetDependencyGraphResponse`; throws a ZodError naming the failing path. */
export const parseGetDependencyGraphResponse = (doc: unknown): T.GetDependencyGraphResponse =>
  getDependencyGraphResponseSchema.parse(doc) as T.GetDependencyGraphResponse;
/** Parses (and validates) a `GetArchitectureProposalResponse`; throws a ZodError naming the failing path. */
export const parseGetArchitectureProposalResponse = (doc: unknown): T.GetArchitectureProposalResponse =>
  getArchitectureProposalResponseSchema.parse(doc) as T.GetArchitectureProposalResponse;
/** Parses (and validates) a `GetApiContractsResponse`; throws a ZodError naming the failing path. */
export const parseGetApiContractsResponse = (doc: unknown): T.GetApiContractsResponse =>
  getApiContractsResponseSchema.parse(doc) as T.GetApiContractsResponse;
/** Parses (and validates) a `GetComponentMetricsResponse`; throws a ZodError naming the failing path. */
export const parseGetComponentMetricsResponse = (doc: unknown): T.GetComponentMetricsResponse =>
  getComponentMetricsResponseSchema.parse(doc) as T.GetComponentMetricsResponse;
/** Parses (and validates) a `ReinferArchitectureResponse`; throws a ZodError naming the failing path. */
export const parseReinferArchitectureResponse = (doc: unknown): T.ReinferArchitectureResponse =>
  reinferArchitectureResponseSchema.parse(doc) as T.ReinferArchitectureResponse;
/** Parses (and validates) a `ScoreProposalResponse`; throws a ZodError naming the failing path. */
export const parseScoreProposalResponse = (doc: unknown): T.ScoreProposalResponse =>
  scoreProposalResponseSchema.parse(doc) as T.ScoreProposalResponse;
/** Parses (and validates) a `InferenceConfig`; throws a ZodError naming the failing path. */
export const parseInferenceConfig = (doc: unknown): T.InferenceConfig =>
  inferenceConfigSchema.parse(doc) as T.InferenceConfig;
/** Parses (and validates) a single `Component`. */
export const parseComponent = (doc: unknown): T.Component => componentSchema.parse(doc) as T.Component;
