## Specification Analysis Report

**Feature**: 007-native-engine-runtime · **Run**: 2026-10-08 (after user decisions A1–A3, A5, A7, A8) · **Artifacts**: spec.md (9 US, 37 FR, 15 SC), plan.md, research.md, data-model.md, contracts/ (3), tasks.md (76 tasks), tests/features (9 files, 87 scenarios TS-001..TS-087, hash LOCKED `231ffdd0…`)

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| B1 | Inconsistency | MEDIUM | spec.md FR-034, FR-032 | The async API keeps the absolute engine path in the `ENGINE_NOT_BUILT` message (documented exception for 006 compatibility), so FR-034 is not absolute | Accept (deployment diagnostic, not job data); revisit with feature 012 `doctor` |
| B2 | Underspecification | MEDIUM | plan.md note 15 (c), FR-036 | The listening address is inferred from `HOSTNAME`/`-H`/`--hostname`; a proxy or container port mapping can expose a loopback-bound server without the warning | Accept; documented in ENVIRONMENT.md (T073) |
| B3 | Ambiguity | LOW | tasks.md T072, Phase 10 header | Expanded ID lists of feature 006 (`TS-025, …, TS-030 de 006`) sit next to 007 IDs | Keep the "de 006" qualifier; traceability tools only count 007 feature tags |
| B4 | Measurability | LOW | SC-008, TS-055 | `< 20 %` timing on one machine can be noisy | Measure on the warm second call within one JVM (T054) |
| B5 | Coverage | LOW | analyze findings A11/A12 of the previous run | Not recorded in the repository (previous analysis.md was not committed); cannot be re-evaluated | None; current run supersedes |
| B6 | Terminology | LOW | data-model.md vs contracts | `projectRoot` is absolute in `job.json` and relative in the API | Documented as "solo interno" in data-model.md |

Previous HIGH findings (A1 warnings channel, A2 engine concurrency vs SC-001, A3 API exposure) are resolved by the user decisions recorded in spec.md *Clarifications* and propagated to plan/research/contracts/tasks/features. Previous MEDIUM A5 (step reuse) → tasks.md reuse list + TS-011/TS-077 wording; A7 (disk full) → FR-037, SC-015, TS-086, TS-087, T019/T040/T041; A8 (TS-076 commit hash) → tag `dev-arch-006-baseline` (T007).

**Constitution Alignment**:
- I. Backward Compatibility → ALIGNED → `language`/`--language` optional; outputs byte-identical without new options (FR-027, TS-052); `/api/analyze` kept (FR-033)
- II. Single Source of Truth → ALIGNED → phases, language, cache, warnings in `com.extractor.service`; adapters translate only
- III. Test-First → ALIGNED → every implementation task preceded by a red test task; hash-locked features
- IV. Determinism → ALIGNED → byte-identity checks (TS-049, TS-055, TS-058, TS-064, TS-065, T059); redaction is textual and deterministic
- V. Graceful Degradation → ALIGNED → warnings exposed; coded errors with summarized messages (FR-031, FR-037)
- VI. Minimal Footprint → ALIGNED → engine 0 new deps; web 1 runtime + 1 dev dependency justified (research D1, D11); token without new deps (D15)

**Coverage Summary**: 37/37 FR and 15/15 SC appear in plan.md (requirement → design map) and in ≥ 1 feature tag; 87/87 TS IDs referenced by tasks; every user story has a task phase (US1–US9).

**Phase Separation Violations**: none (spec.md names no framework, header or file path for the new requirements; Bearer/`DEVARCH_API_TOKEN`/`_meta` live in plan/research/contracts).

**Metrics**: requirements 52 (37 FR + 15 SC) · tasks 76 · coverage 100 % · ambiguity 1 · critical 0 · high 0 · medium 2 · low 4

**Health Score**: 94/100 (↑ improving)

## Score History

| Run | Score | Coverage | Critical | High | Medium | Low | Total |
|-----|-------|----------|----------|------|--------|-----|-------|
| 2026-10-08T16:56:54Z | 71 | 100% | 0 | 3 | 6 | 4 | 13 |
| 2026-10-08T17:20:00Z | 94 | 100% | 0 | 0 | 2 | 4 | 6 |
