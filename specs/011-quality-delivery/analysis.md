# Cross-artifact analysis: 011-quality-delivery (`/iikit-06-analyze`, 2026-10-10)

| ID | Severity | Area | Finding | Resolution |
|---|---|---|---|---|
| A1 | LOW | Coverage | Every FR (FR-001…FR-032) and SC (SC-001…SC-008) is tagged by ≥ 1 scenario (FR-003 via TS-002, FR-030 via TS-031, FR-031 via TS-032/TS-033); every TS-001…TS-034 is referenced by a task | none |
| A2 | MEDIUM | Locked scenarios | 006 TS-010 forbids `npx` and requires `npm test -w web` in `make test-web`; TS-025 requires exact area-job triggering; TS-029 the release matrix; TS-012 the `make e2e`/`make doctor` placeholders | Typecheck/lint via `npm run … -w web`; CI additions are steps in existing jobs or tag-only jobs with compound conditions; placeholders untouched (T006, T017, T021) |
| A3 | MEDIUM | Runtime | `engine-java` CI job (timeout 20) now also runs the .NET legacy scenarios | Measure in T011; if it approaches the limit, move .NET legacy runs to a step of an existing job (checklist CHK014) |
| A4 | LOW | Constitution VI | New build/dev dependencies (JaCoCo, coverlet, ESLint) | Justified in plan Complexity Tracking; no runtime dependency |
| A5 | LOW | Plan vs user scope | Plan mentions Vitest; the user said "extend what exists" | Existing `node --test` runner kept (default pending confirmation, spec Clarifications) |
| A6 | LOW | Legacy scenarios | Some 2026-03 scenarios may contradict later decisions | T011: fix the engine, or STOP and report (spec Edge Cases) |

**CRITICAL: 0 · HIGH: 0 · MEDIUM: 2 (mitigated in design) · LOW: 4.** Constitution gate: PASS. Ready for `/iikit-07-implement`.

## Implementation finding (2026-10-10, `/iikit-07-implement`) — BLOCKER under the additive rule

Four locked scenarios of 001–003 contradict later, deliberate and locked behaviour; making them pass requires
re-testifying them (forbidden by the user's additive rule of 2026-10-09) or reverting later decisions:

| Scenario | Asserts | Contradicted by |
|---|---|---|
| 001 TS-003 | empty folder ⇒ MCP error `isError: true` | 007 FR-026 / TS-061 (success, 0 components, warning) |
| 002 TS-014 | folder without markers ⇒ UNKNOWN error | Java fallback for UNKNOWN (Constitution I; 007 research E5) |
| 003 TS-001 | exactly 1 issue for `catch (Exception e) { }` | 003 FR-001 / TS-003 (same snippet also raises CATCH_GENERIC_EXCEPTION) |
| 003 TS-018 | code issue has `location` | 005 contract 1.0.0 (research E3: `location` dropped, schema rejects it) |

They are excluded by tag filter in the new runners (documented in each runner) pending the user's decision;
011 TS-007/TS-008 (every legacy scenario reported/passed) stay red until then. **Status: STOP — awaiting user.**
