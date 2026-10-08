# Research: 008-configurable-inference

## D1. Regression baseline `baseline-v1.2.0`

- **Decision**: Capture the three documents of the six demo projects (`java-standar`, `jee-architecture-master`, `legacy-erp`, `dotnet-ecommerce`, `dotnet-legacy-clinic`, `dotnet-unstructured`) with the engine of commit `7bc8170` (end of 007, product 1.2.0) before any production change, on the hermetic copies of `DemoOutputs` (`target/schema-demo`), replacing the demo root with `${REPO}` exactly like `baseline-v1.1.0`. Store under `engine/src/test/resources/baseline-v1.2.0/<project>/`.
- **Rationale**: `baseline-v1.1.0` covers 2 projects and is compared after stripping `meta`; FR-005/SC-001 require full byte identity on all six. Using a temporary `git worktree` of `7bc8170` guarantees "before" outputs even if the capture runs late.
- **Alternatives**: compare against `schema/fixtures/valid` (only 2 projects, relative paths); compare old vs new jar at test time (needs two builds in CI).

## D2. Stage split

- **Decision**: `ExtractionService.extract(Path, AnalysisOptions, InferenceConfig.detection, listener)` → `ExtractionResult(graph, projectDependencies, secretsLocations, warnings)`. `InferenceService.infer(InferenceInput, InferenceConfig)` → `ConsolidatedArchitecture` with no file-system access. `MicroserviceRecommendationEngine` gets an overload receiving precomputed `List<SecretLocation>`; the old overloads keep scanning (tests). `AnalysisService` keeps every public signature and adds overloads with `InferenceConfig`.
- **Rationale**: Principle II; reinfer needs a pure function. The secrets scan reads the project tree, so it belongs to extraction; moving it earlier does not change the result (nothing is written between extraction and inference).
- **Alternatives**: keep the scan in inference with nullable root (keeps I/O in inference; reinfer could not reproduce `secrets_locations`).

## D3. `InferenceConfig` shape and identity of defaults

- **Decision**: Java records nested per stage (`detection`, `clustering`, `evidence`, `consolidation`, `viability` + `rationale`, `recommendation`, `naming`), camelCase JSON keys (same convention as MCP inputs `projectPath`, `minViability`). Every literal in `com.extractor.inference` that reaches an output becomes a field (mapping in data-model.md). Doubles are compared/multiplied in the same expression order, so a value parsed from `"0.25"` is the same IEEE double as the literal `0.25`. `InterClusterGraph` builds its role set with `Set.of(roleKeywords.toArray(new String[0]))`, the same varargs constructor and insertion order as today's `Set.of(...)` literal, so iteration order (which decides the winning role) is unchanged; `Set.copyOf` is avoided because it re-inserts through a `HashSet`. Lists that are only queried with `contains` become `Set`s; ordered lists stay `List`s.
- **Rationale**: byte identity (FR-005) and Principle IV.
- **Alternatives**: `Map<String, Double>` bag (no typing, no defaults per field); environment variables (CONFIGURATION.md old proposal: global, not per request).

## D4. Loading, merging and validation

- **Decision**: `InferenceConfigLoader`: parse JSON → deep-merge onto `valueToTree(defaults())` (objects merge recursively; arrays, strings and numbers replace) while rejecting keys absent from the defaults tree (`unknown parameter 'viability.thresholds.hihg'`) and JSON types different from the default's (`'evidence.weights.table' must be a number`) → `treeToValue` → semantic validation: ratios/weights/thresholds in [0, 1] (`callDensitySaturation` in (0, 1]), sizes integers ≥ 0, `minStrongSignals` in 0..4, `detection.maxDepth` in 0..5, `viability.thresholds.medium ≤ high`, each `*Fair` cut consistent with its `*Good` cut, enums `dataJaccardMode ∈ {legacy, data_cohesion}`, list items non-blank lower-case strings. Errors are `InvalidConfigException` (subclass of `IllegalArgumentException`, so existing MCP/CLI error paths apply) with message `Invalid inference configuration: <path>: <reason>`; file errors `Inference configuration file '<path>' <reason>`. CLI `--config=<file>`; MCP `config` (object) xor `configPath` (string).
- **Rationale**: FR-007..FR-009, SC-006; partial configs are the common case.
- **Alternatives**: JSON Schema validation at runtime (adds networknt to main scope — it is test-only today, Principle VI).

## D5. Exposure of the new tools

- **Decision**: `McpServerMain.createToolSpecs(service)` keeps returning the 5 tools; `createToolSpecs(service, true)` adds `reinfer_architecture` and `score_proposal`; `start()` enables them when `STATIC_INFERENCE_INFERENCE_TOOLS=true` (env or system property). The web engine process always sets it.
- **Rationale**: locked assertions of 001 (TS-016 "responds with 5 tools", `McpServerContractTest`), 005 (`McpResponsesSteps` "the 5 tools") and 007 (`McpLanguageContractTest` tool set) cannot be edited (assertion-integrity rule). Pending user confirmation (spec Clarifications) — alternative: re-lock those assertions to "at least the five tools".
- **Alternatives**: separate `--mcp-inference` mode (two servers); always on (breaks locked tests).

## D6. Graph sources and project-level metadata

- **Decision**: `GraphSource.fromPath` reads the graph with a Jackson mapper (`FAIL_ON_UNKNOWN_PROPERTIES=false` only for the deprecated duplicate `interface`); rejects unreadable/invalid JSON, missing `components`, `meta.schema_version` ≠ `1.0.0`. The sibling architecture is `<graph name without .json>_architecture.json` (CLI and `analyze_project` naming); from it the loader takes `project_metadata.external_dependencies` (re-merging component dependencies yields the same map) and `project_metadata.secrets_locations`. Missing/invalid sibling → empty project dependencies, empty secret locations, warning `Project metadata not found next to the graph ('<name>'): external_dependencies limited to component dependencies and secrets_locations omitted`. `fromJob(id, jobsDir)`: id regex `^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$`, path `<jobsDir>/<id>/out/output.json`, real path must stay under the real `jobsDir`; no `STATIC_INFERENCE_JOBS_DIR` → `jobId requires STATIC_INFERENCE_JOBS_DIR; pass graphPath instead`.
- **Rationale**: FR-013..FR-016, SC-002; the web job layout is `<ARCHVIEW_DATA_DIR>/jobs/<id>/out/output.json` (007 `JobStore.paths`).

## D7. Opt-in corrections (no default output change)

- **Decision**: `recommendation.dataJaccardMode` (`legacy` default → `legacyDataJaccard` 0.8 / 0.0; `data_cohesion` → the `dataCohesion` of `ViabilityScorer` for the proposal's clusters); three keyword lists kept separate (`consolidation.infrastructureKeywords`, `recommendation.infrastructureKeywords`, `naming.infrastructureLabels`) with current values; CONFIGURATION.md shows the aligned configuration.
- **Support guard scope**: no option. `canMerge`/`canMergeSameDomain` only merge roots with equal `isSupport`, so by induction every source cluster of a group shares its root's status; the group-wide ratio is a size-weighted mean of cluster ratios and therefore falls on the same side of `supportRatio`. Root-only evaluation is equivalent; an invariant test checks it on the demos and the synthetic graph.
- **Rationale**: Principle I; spec Clarifications.

## D8. Contract

- **Decision**: add `schema/1.0.0/inference-config.schema.json` (closed objects, all properties optional, ranges as in D4), `schema/1.0.0/mcp/reinfer_architecture.response.schema.json` (`$ref` to `architecture.schema.json`) and `schema/1.0.0/mcp/score_proposal.response.schema.json` (closed `ProposalScore`). `schema/VERSION` stays `1.0.0`; existing schemas untouched; `ENTRIES` and the Java registry gain the two responses; `schema/generated` regenerated; valid fixtures for both responses.
- **Rationale**: FR-026; a bump to 1.1.0 changes `meta.schema_version` in every existing output and breaks locked 005–007 assertions. Pending user confirmation.

## D9. Parity and cache

- **Decision**: CLI and `analyze_project` with the same config produce the same three documents (test). `AnalysisCache` is used only when the effective config equals `defaults()` (record equality); otherwise compute without lookup/store.
- **Rationale**: FR-010, FR-011.

## D10. `score_proposal` semantics

- **Decision**: infer clusters of the graph with the given config (`InferenceEngine.analyze`), then for each cluster in cluster-id order build a fragment with the members of the list that belong to it (cluster member order, duplicates removed), with metrics from `MetricsCalculator`; fragment ids are the source cluster ids. `ViabilityScorer(fragments, components, config.viability).calculateViability(ids)` gives viability, score and rationale; actions reuse the proposal action generator with consolidated metrics over the fragments (infrastructure filtering as for proposals); name from `MicroserviceNameGenerator` over the fragments. Response: `{meta, name, viability, score, metrics{cohesion_adjusted, external_coupling, data_cohesion, internal_edge_density, size, cluster_count}, components, clusters, rationale, recommended_actions}`.
- **Rationale**: identical fragments for a full-cluster proposal ⇒ identical rationale/viability (FR-019, SC-007).
- **Alternatives**: treat the list as one synthetic cluster (cohesion would differ from the engine's own proposals).

## D11. Resources

- **Decision**: four `SyncResourceSpecification`s (SDK 1.1.0), capability `resources(false, false)`; content loaded from classpath `static-inference/docs/{ALGORITHMS,CONFIGURATION}.md` and `static-inference/schema/1.0.0/**`; unknown URI → SDK error (`Resource not found`). Maven `<resource>` entries without filtering (the markdown contains `${...}` examples).
- **Rationale**: FR-021, SC-008; PREMISE.md promise.

## D12. Nested detection

- **Decision**: `detection.maxDepth` (0..5, default 0). Root markers win. Otherwise bounded walk (depth ≤ N) skipping `target, build, bin, obj, node_modules, .git, .svn, .hg, .idea, .vs, out, dist`; module dirs = parents of markers, relative, `/`-separated, sorted; Java-only → JAVA, .NET-only → DOTNET, both → AMBIGUOUS (message lists both groups). Warning `Nested project markers found (<lang>): <dirs>` added to the extraction warnings (MCP `_meta`, CLI stderr — 007 mechanism).
- **Rationale**: FR-023/FR-024; default 0 keeps outputs.

## D13. Performance

- **Decision**: deterministic synthetic graph generator (500 components, 25 packages/domains × 20 classes, intra-package calls + some cross calls + tables) in test support; measure `ReinferArchitectureTool.handle` after one warm-up call, 5 runs each < 2 s. If over budget, index `clusterId → Cluster` lookups in `ClusterConsolidator`/`ViabilityScorer`/`MicroserviceNameGenerator` preserving iteration order.
- **Rationale**: FR-017, SC-003.

## Tessl Tiles

No new technologies; no tiles installed for this feature.
