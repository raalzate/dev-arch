## Specification Analysis Report

Run: 2026-10-08T22:04:15Z — artifacts: spec.md (29 FR, 10 SC, 7 US), plan.md, tasks.md (37 tasks), 7 .feature files (49 scenarios, hash LOCKED).

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| A1 | Inconsistency (with PLAN-INTEGRACION Fase 4) | MEDIUM | spec FR-027, Clarifications; research D5 | The plan asks for "new MCP tools"; locked assertions of 001 (TS-016), 005 (`McpResponsesSteps`) and 007 (`McpLanguageContractTest`) require exactly 5 tools, so the new tools are registered only with `STATIC_INFERENCE_INFERENCE_TOOLS=true` (the web always sets it). | Keep (conservative, no locked assertion touched). Pending user confirmation; alternative = re-lock 001/005/007 assertions to "at least five tools". |
| A2 | Contract | MEDIUM | spec FR-026, Clarifications; research D8 | New response/config schemas are added inside contract 1.0.0 without a version bump (a bump changes `meta.schema_version` of every existing output and breaks locked 005–007 assertions). | Keep; pending user confirmation; alternative = 1.1.0 minor bump with relaxed regression on the version field. |
| A3 | Scope deviation | LOW | spec FR-025, US7-AS4; research D7 | The known issue "isSupport checks only the root cluster" is shown to be unobservable (merges only join roots with equal support status ⇒ group ratio on the same side of the threshold); no option is added, an invariant test (TS-042) guards it. | Pending user confirmation. |
| A4 | Coverage | LOW | TS-047, T003 | The clustering-stage effect is asserted on the synthetic graph, whose generator is written in T003. | Generator must have ≥ 2 domains with none above 75 % so that `singleDomainRatio = 0` switches strategy. |
| A5 | Measurement | LOW | SC-009, T036 | Checkstyle baseline 4655 comes from the caller; it is re-measured on the branch before the first production change. | Record the measured count in T036 evidence. |
| A6 | Terminology | MEDIUM | data-model.md, contracts | `legacyDataJaccard`/`dataJaccardMode` naming mixes the emitted field name (`data_jaccard`) with config camelCase. | Accepted: config keys are camelCase (MCP input convention); documented in CONFIGURATION.md. |

**Constitution Alignment**:
- I. Backward Compatibility -> ALIGNED -> defaults identical (byte regression TS-001/TS-002 on 6 projects × 3 documents, CLI and MCP); corrections opt-in; 5 tools by default; contract version unchanged.
- II. Single Source of Truth -> ALIGNED -> ExtractionService/InferenceService/GraphSource/ProposalScorer in the shared core; adapters parse and serialize only.
- III. Test-First -> ALIGNED -> testify locked before tasks; every production task preceded by a red test task; no existing assertion modified.
- IV. Deterministic Output -> ALIGNED -> pure inference; same iteration structures; determinism scenarios TS-018, TS-022, TS-028.
- V. Graceful Degradation -> ALIGNED -> named-parameter validation errors, warnings for missing project metadata and nested markers.
- VI. Minimal Footprint -> ALIGNED -> 0 new dependencies; resources inside the fat JAR.

**Coverage Summary**: 29/29 FR and 10/10 SC have ≥ 1 task, ≥ 1 tagged scenario and a plan reference (plan.md *Requirement Traceability*). 49/49 TS referenced by tasks. No prose ranges.

**Phase Separation Violations**: none (spec free of class/tool names; governance only in CONSTITUTION.md).

**Metrics**: requirements 39 (29 FR + 10 SC), tasks 37, coverage 100 %, ambiguity 0, critical 0, high 0, medium 3, low 3.

**Defaults that change existing outputs**: none.

**Health Score**: 92/100 (first run)

## Score History

| Run | Score | Coverage | Critical | High | Medium | Low | Total |
|-----|-------|----------|----------|------|--------|-----|-------|
| 2026-10-08T22:04:15Z | 92 | 100% | 0 | 0 | 3 | 3 | 6 |
