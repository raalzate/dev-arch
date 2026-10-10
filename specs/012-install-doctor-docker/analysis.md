# Cross-artifact analysis: 012-install-doctor-docker (`/iikit-06-analyze`, 2026-10-10)

| ID | Severity | Area | Finding | Resolution |
|---|---|---|---|---|
| A1 | LOW | Coverage | Every FR (FR-001…FR-027) and SC (SC-001…SC-006) is tagged by ≥ 1 scenario; every TS-001…TS-037 is referenced by a task (directly or by range) | none |
| A2 | MEDIUM | User instruction vs locked scenario | The user asked for `tools/doctor/`; 006 TS-001 (closed list of product root entries) and TS-013 (workspaces exactly `web`, `schema`) forbid a new root folder or workspace | `scripts/doctor/` + root `bin`; `docker/compose.yaml` instead of a root `compose.yaml`; recorded as default pending confirmation (spec Clarifications, research D1). No locked artifact changes → no HARD RULE conflict |
| A3 | MEDIUM | CI | 006 TS-025/TS-030 evaluate "area jobs" (exactly one `needs.changes.outputs.X == 'true'` gate) | the `docker` job uses a compound condition, so it is not an area job; TS-029 re-checks the TS-025 example |
| A4 | MEDIUM | Local validation | Docker is not installed: the image cannot be built or run locally | static validation (TS-027/028/031/032) + real build and smoke test in the CI `docker` job (TS-029/030); reported as a limitation |
| A5 | LOW | Quality gate | New Java code is checked by sun_checks (Checkstyle count must not exceed 4589) | `EngineDoctor` in an existing package (no `package-info`), final class, Javadoc on every member, ≤ 80 columns; TS-037 measures it |
| A6 | LOW | Coverage gate | New web modules (`server/health/health.ts`, `app/api/health/route.ts`) join the ≥ 85 % target set | unit tests T010 |
| A7 | LOW | Plan vs scope | Plan mentions Vitest, `make build`/`make dev` running the doctor first, a separate engine image and a `split` profile | out of scope by user decisions or recorded defaults (spec Clarifications) |
| A8 | LOW | Image fidelity | The final image has no .NET SDK (plan: "no SDKs"), so the analyzer falls back to `AdhocWorkspace` | documented in INSTALL.md (default pending confirmation) |

**CRITICAL: 0 · HIGH: 0 · MEDIUM: 3 (mitigated in design) · LOW: 5.** Constitution gate: PASS. HARD RULE: no conflict (no locked artifact of 001–011 changes). Ready for `/iikit-07-implement`.
