# Data Model: 008-configurable-inference

## InferenceConfig (record, `com.extractor.inference.config`)

All fields required in the record; the JSON form is partial (merged onto `InferenceConfig.defaults()`). Source column = literal replaced (pre-008 line numbers, see `engine/CONFIGURATION.md` of 1.2.0). Range column = validation rule (research D4).

| Parameter (JSON path) | Type | Default | Range | Source (literal) |
|---|---|---|---|---|
| `detection.maxDepth` | int | 0 | 0..5 | new (root-only detection) |
| `clustering.singleDomainRatio` | double | 0.75 | [0,1] | `ClusteringAlgorithm.isSingleDomainProject` `> total * 0.75` |
| `clustering.largeClusterRatio` | double | 0.5 | [0,1] | `ClusteringAlgorithm.hasLargeSingleCluster` `> 0.5` |
| `evidence.weights.table` | double | 0.25 | [0,1] | `InterClusterGraph:41` |
| `evidence.weights.call` | double | 0.35 | [0,1] | `InterClusterGraph:41` |
| `evidence.weights.token` | double | 0.30 | [0,1] | `InterClusterGraph:42` |
| `evidence.weights.event` | double | 0.10 | [0,1] | `InterClusterGraph:42` |
| `evidence.edgeThreshold` | double | 0.1 | [0,1] | `InterClusterGraph:28` `> 0.1` |
| `evidence.callDensitySaturation` | double | 0.5 | (0,1] | `InterClusterGraph:75` `internal * 0.5` |
| `evidence.strongSignals.table` | double | 0.4 | [0,1] | `InterClusterGraph:269` |
| `evidence.strongSignals.call` | double | 0.35 | [0,1] | `InterClusterGraph:270` |
| `evidence.strongSignals.token` | double | 0.6 | [0,1] | `InterClusterGraph:271` |
| `evidence.evidenceThreshold` | double | 0.65 | [0,1] | `InterClusterGraph:274` |
| `evidence.minStrongSignals` | int | 2 | 0..4 | `InterClusterGraph:274` |
| `evidence.roleKeywords` | string[] | service, controller, repository, repo, usecase, operations, listener, publisher, adapter, factory, handler, db | items non-blank | `InterClusterGraph:130-131` (Set.of, insertion order kept) |
| `evidence.excludeTokens` | string[] | entity, model, data, dto, event, command, query | items non-blank | `InterClusterGraph:129` |
| `evidence.minPackageTokenLength` | int | 3 | ≥ 0 | `InterClusterGraph:149` `length() > 2` |
| `evidence.eventPublisherKeywords` | string[] | publisher, event | items non-blank | `InterClusterGraph:188` |
| `evidence.eventConsumerKeywords` | string[] | listener, consumer | items non-blank | `InterClusterGraph:199` |
| `consolidation.genericNames` | string[] | Componente de Negocio, Componente Desconocido, Componente de Infraestructura, Componente de Configuración | items non-blank | `ClusterConsolidator:50-51` |
| `consolidation.domainMergeMaxSize` | int | 50 | ≥ 0 | `ClusterConsolidator:91` |
| `consolidation.significantInfrastructureRatio` | double | 0.3 | [0,1] | `ClusterConsolidator:122` |
| `consolidation.supportRatio` | double | 0.8 | [0,1] | `ClusterConsolidator:182` |
| `consolidation.maxMergedSizeWithoutSimilarity` | int | 40 | ≥ 0 | `ClusterConsolidator:153` |
| `consolidation.highTokenSimilarity` | double | 0.75 | [0,1] | `ClusterConsolidator:153` |
| `consolidation.separationCallDensity` | double | 0.15 | [0,1] | `ClusterConsolidator:156` |
| `consolidation.separationTableJaccard` | double | 0.2 | [0,1] | `ClusterConsolidator:157` |
| `consolidation.strongCandidate.minCohesion` | double | 0.7 | [0,1] | `ClusterConsolidator:210` |
| `consolidation.strongCandidate.maxCoupling` | double | 0.3 | [0,1] | `ClusterConsolidator:211` |
| `consolidation.strongCandidate.minSize` | int | 3 | ≥ 0 | `ClusterConsolidator:212` |
| `consolidation.infrastructureKeywords` | string[] | config, configuration, security, application, exception, error, filter, interceptor, aspect, swagger, openapi, main | items non-blank | `ClusterConsolidator:8-11` |
| `viability.weights.cohesion` | double | 0.5 | [0,1] | `ViabilityScorer:41` |
| `viability.weights.coupling` | double | 0.35 | [0,1] | `ViabilityScorer:41` |
| `viability.weights.data` | double | 0.15 | [0,1] | `ViabilityScorer:41` |
| `viability.cohesionBlend.average` | double | 0.7 | [0,1] | `ViabilityScorer:75` |
| `viability.cohesionBlend.density` | double | 0.3 | [0,1] | `ViabilityScorer:75` |
| `viability.noTablesDataCohesion` | double | 0.5 | [0,1] | `ViabilityScorer:129,142` |
| `viability.smallSize.below` | int | 3 | ≥ 0 | `ViabilityScorer:43,269,307` |
| `viability.smallSize.penalty` | double | 0.6 | [0,1] | `ViabilityScorer:44` |
| `viability.largeSize.above` | int | 50 | ≥ 0 | `ViabilityScorer:45,271` |
| `viability.largeSize.minDensity` | double | 0.5 | [0,1] | `ViabilityScorer:47` |
| `viability.largeSize.penalty` | double | 0.7 | [0,1] | `ViabilityScorer:48` |
| `viability.thresholds.high` | double | 0.7 | [0,1], ≥ medium | `ViabilityScorer:52` |
| `viability.thresholds.medium` | double | 0.5 | [0,1] | `ViabilityScorer:52` |
| `viability.rationale.cohesionGood` / `cohesionFair` | double | 0.7 / 0.5 | [0,1], fair ≤ good | `ViabilityScorer:209-212,284` |
| `viability.rationale.couplingGood` / `couplingFair` | double | 0.3 / 0.5 | [0,1], good ≤ fair | `ViabilityScorer:222-225,289` |
| `viability.rationale.cboGood` / `cboFair` | double | 5 / 10 | ≥ 0, good ≤ fair | `ViabilityScorer:235-238,295` |
| `viability.rationale.lcomGood` / `lcomFair` | double | 0.3 / 0.6 | [0,1], good ≤ fair | `ViabilityScorer:249-252,301` |
| `viability.rationale.dataGood` / `dataFair` | double | 0.6 / 0.3 | [0,1], fair ≤ good | `ViabilityScorer:262-264,312` |
| `recommendation.supportRatio` | double | 0.8 | [0,1] | `MicroserviceRecommendationEngine:182` |
| `recommendation.infrastructureKeywords` | string[] | (same 12 as consolidation) | items non-blank | `MicroserviceRecommendationEngine:18-21` |
| `recommendation.dataJaccardMode` | enum | `legacy` | legacy, data_cohesion | new (opt-in, FR-025) |
| `recommendation.legacyDataJaccard` | double | 0.8 | [0,1] | `MicroserviceRecommendationEngine:468` |
| `naming.infrastructureRatio` | double | 0.8 | [0,1] | `MicroserviceNameGenerator:56` |
| `naming.infrastructureLabels` | map string→string | config→Configuración, security→Seguridad, auth→Autenticación, swagger→Documentación, email→Notificaciones por Email, notification→Notificaciones, log→Logging, audit→Auditoría, application→Aplicación Principal | keys and values non-blank | `MicroserviceNameGenerator:13-23` |
| `naming.roleKeywords` | string[] (ordered) | service, controller, repository, repo, usecase, operations, listener, publisher, adapter, factory, handler, db | items non-blank | `MicroserviceNameGenerator:121-122` |
| `naming.excludeTokens` | string[] | entity, model, data, dto, event, command, query, impl, repository, service, controller, api, rest, http, adapter, port, localevents, rabbit, jpa, repo, dao, operations, listener, publisher, handler, factory, db, activityupdaterimpl, usecase, primaryports, secondaryports, userprofilejpa, tweetcrud, suggestion, suggestions | items non-blank | `MicroserviceNameGenerator:7-11` |
| `naming.minTokenLength` | int | 3 | ≥ 0 | `MicroserviceNameGenerator:133,140` `length() > 2` |

Out of scope (no observable output): `HighCohesionRule`/`LowCouplingRule`/`SharedDataRule` thresholds and contributions (only `Cluster.finalScore`/`rulesFired`, never serialized); fixed Spanish texts.

## ExtractionResult (record, `com.extractor.service`)

`graph: DependencyGraph`, `projectDependencies: Map<String,String>` (from the analyzer's dependency resolver), `secretsLocations: List<SecretLocation>` (from `SecretLocationScanner`, empty on scanner failure as today), `warnings: List<String>`, `projectRoot: Path`.

## InferenceInput (record)

`graph`, `projectDependencies`, `secretsLocations`. Built from an `ExtractionResult` or from a `LoadedGraph`.

## LoadedGraph (record)

`graph`, `projectDependencies`, `secretsLocations`, `warnings` (sibling architecture missing), `source` (path used).

## ProposalScore (record, serialized snake_case)

| Field | Type | Notes |
|---|---|---|
| `meta.schema_version` | string | `1.0.0` |
| `name` | string | `MicroserviceNameGenerator` over fragments |
| `viability` | enum Alta/Media/Baja | |
| `score` | number | penalized score |
| `metrics.cohesion_adjusted` | number | |
| `metrics.external_coupling` | number | |
| `metrics.data_cohesion` | number | |
| `metrics.internal_edge_density` | number | |
| `metrics.size` | integer | total fragment members |
| `metrics.cluster_count` | integer | fragments |
| `components` | string[] | unique, sorted |
| `clusters` | integer[] | source cluster ids, ascending |
| `rationale` | string[] | as in proposals |
| `recommended_actions` | string[] | as in proposals |

## Detection (record, `com.extractor.analyzer`)

`type: ProjectType`, `moduleDirs: List<String>` (relative, sorted; empty when decided at root), `nested: boolean`.

## State / lifecycle

Stateless: configs are values; reinfer/score never write files. `AnalysisCache` (007) stores only default-config analyses.
