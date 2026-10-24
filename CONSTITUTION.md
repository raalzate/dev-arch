<!-- Sync Impact Report
Version: 1.0.0 -> 2.0.0 (MAJOR: scope and principle VI redefined, principle VII added)
Approved by the user: 2026-10-23 (Fase 7 of PLAN-INTEGRACION-DEV-ARCH, "has todo eso")
Changes:
  - Scope: from the Static Inference MCP server to the whole dev-arch product (analysis engine, web, agent
    endpoint), now in its own repository.
  - I: the public contracts include every entry point (command line, engine MCP, REST API, agent MCP).
  - II: the web projections of the analysis are shared pure functions too; every entry point is a thin adapter.
  - IV: outputs MUST NOT depend on the machine (locale, operating system, installed toolchain); the canonical
    environment is declared and environment-dependent resolution is reported (lessons of BUG-008 and BUG-009).
  - VI: redefined: the engine stays one self-contained artifact; the web is a separate artifact that embeds it;
    no vendored build outputs; container packaging is optional.
  - VII (new): one versioned data contract, with consumer types generated from it.
  - Technology names removed from the principles (phase separation: technology choices live in plan.md).
Migration plan: no code change required; features 001-014 already comply (see specs/014-standalone-repo/bugs.md
  for the IV fixes). New plans MUST run their Constitution Check against v2.0.0.
Follow-up: none.
-->

# dev-arch Constitution

## Core Principles

### I. Backward Compatibility (NON-NEGOTIABLE)

- Every entry point (command line, engine MCP server, REST API, agent MCP endpoint) MUST keep working after any
  change
- All JSON outputs and tool responses are public contracts; changes require explicit versioning
- No behavioral regression: identical inputs MUST produce identical outputs regardless of the entry point used

**Rationale**: People, agents and downstream systems depend on these interfaces. Breaking one undermines trust in
all of them.

### II. Single Source of Truth for Analysis Logic

- All analysis, inference and metric computation MUST live in the shared engine core
- The projections of an analysis shown to people and agents (summary, ordering, findings, plan, comparison) MUST
  be shared functions used by every consumer
- Every entry point MUST be a thin adapter that delegates to the shared core and projections
- Duplication of business logic across entry points is forbidden

**Rationale**: Divergent analysis paths produce inconsistent results. An agent and a person must always see the
same analysis.

### III. Test-First Development (NON-NEGOTIABLE)

- All new code MUST follow the TDD Red-Green-Refactor cycle
- New functionality MUST have failing tests before implementation code is written
- Test assertions are the specification; modifying assertions to pass tests is forbidden — fix the production code
  instead
- Existing tests MUST continue passing after every change

**Rationale**: The product produces architectural recommendations that inform critical decisions. Untested code
risks silently wrong analysis, which is worse than no analysis at all.

### IV. Deterministic and Reproducible Output

- Given the same source project, the analysis MUST produce identical results across runs and across machines
- No randomness, timestamps or environment-dependent values (locale, operating system, installed toolchain) in
  analysis output; optional non-deterministic metadata MUST stay outside the compared contract and be opt-in
- The canonical analysis environment MUST be declared in the repository; when a machine cannot reproduce it, the
  analysis MUST say so instead of degrading silently
- Tool responses MUST be valid JSON matching documented schemas

**Rationale**: Determinism is what makes the analysis a source of truth: two analyses can be compared, so the
analysis can guard every change of an AI-assisted modernization.

### V. Graceful Degradation and Clear Error Reporting

- Analysis failures on individual components MUST NOT abort the entire analysis
- Errors MUST be reported with context: what failed, why, and what was skipped
- Error responses of every interface MUST follow that interface's error format with actionable messages

**Rationale**: Real-world legacy projects are messy. Partial results with clear warnings are more useful than total
failure on the first unparseable file.

### VI. Minimal Footprint

- New dependencies MUST be justified and minimal
- The analysis engine MUST remain one self-contained deployable artifact with no runtime infrastructure beyond its
  language runtimes
- The web MUST be a separate artifact that embeds the engine; build outputs MUST NOT be versioned or vendored
- Container packaging is an optional distribution, never a requirement to use the engine
- Complexity MUST be justified by concrete user value

**Rationale**: The strength of the product is zero-setup static analysis. Infrastructure requirements or bloated
dependencies undermine it.

### VII. Single Versioned Data Contract

- Every output of the engine and every tool response MUST be described by one versioned contract kept in the
  repository
- Types used by consumers MUST be generated from the contract, never written by hand
- Contract changes follow principle I (explicit versioning and migration documentation)

**Rationale**: One contract keeps the engine, the web, the command line and the agents aligned without drift.

## Quality Standards

- All public methods in the shared core MUST have unit tests
- Integration tests MUST verify end-to-end analysis on representative sample projects
- Tool handlers of every MCP interface MUST have contract tests validating request/response schemas
- Code coverage for new code MUST not decrease below the existing project baseline
- Static analysis warnings MUST be resolved before merging

## Development Workflow

- Every change goes through a feature branch and pull request
- PRs MUST include tests demonstrating the change works and MUST pass the repository continuous integration
- Breaking changes to JSON output schemas require a version bump and migration documentation
- Commit messages follow conventional commits format

## Governance

- This constitution supersedes all other development practices for this project
- Amendments require explicit user approval, version increment, and migration plan
- All PRs and code reviews MUST verify compliance with these principles
- Conflicts between principles are resolved by their ordering (I > II > III > IV > V > VI > VII)

**Version**: 2.0.0 | **Ratified**: 2026-03-25 | **Last Amended**: 2026-10-24
