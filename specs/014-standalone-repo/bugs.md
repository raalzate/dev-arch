# Bugs: 014-standalone-repo

Found by the first run of the GitHub Actions workflow on the own repository (PR #1, job "Contract - schema-check",
`BaselineParityTest`). Neither is caused by the move: the CI had never run before.

## BUG-008 — Rationale numbers depend on the JVM default locale (principle IV)

- **Status**: fixed
- **Severity**: high (non-deterministic output across machines)
- **Symptom**: `output_architecture.json` of `java-standar` says `CBO promedio 1,9` on a Spanish machine and
  `CBO promedio 1.9` on the CI runner (English locale); the 1.1.0 baseline holds the Spanish form.
- **Root cause**: `String.format` without a locale in `ViabilityScorer` (Spanish rationale text).
- **Fix**: fixed Spanish locale (`es`) for the rationale text; `Locale.ROOT` for the metrics debug log.
- **Test**: `engine/src/test/java/com/extractor/determinism/LocaleIndependenceTest.java` (same architecture under
  `en-US` and `es-CO` default locales; decimal comma in the rationale). Red before the fix, green after.

## BUG-009 — .NET semantic resolution depends on the installed targeting packs

- **Status**: fixed (user decision 2026-10-23: option A, pin SDK 8 and regenerate the .NET baselines)
- **Severity**: high (non-deterministic output across machines; likely the root cause of BUG-007)
- **Symptom**: `output.json` of `dotnet-ecommerce`: on the CI runner (.NET SDK 8) `extends` is
  `Microsoft.AspNetCore.Mvc.ControllerBase` and `cbo` 3; on the development machine (SDK 10, runtime 8 only) it is
  `ControllerBase` and `cbo` 5. The baseline was captured on the development machine.
- **Root cause**: the `net8.0` projects reference `Microsoft.AspNetCore.App`; MSBuildWorkspace resolves its
  reference assemblies only when the net8 targeting pack is installed (SDK 8). Without it the symbols stay
  unresolved silently (no warning, `meta.source` still `roslyn`).
- **Options**: (A) pin the toolchain (SDK 8 via `global.json`, already used by CI and the container image),
  report reduced fidelity with a warning when a targeting pack is missing, and regenerate the .NET baselines in the
  canonical environment (approval required: changes locked expected outputs); (B) keep the development-machine
  baseline and make CI use the same SDK (hides the reduced resolution).

## BUG-010 — Analysis phases lost when the progress arrives with the answer (007 flake)

- **Status**: fixed
- **Severity**: medium (the web may miss the last phases; flaky `engine-client.test.ts` on CI)
- **Symptom**: CI run 2 of PR #1: "starts lazily, reports phases in order…" got `['detection']`.
- **Root cause**: the MCP SDK dispatches notifications on a later microtask but handles the response at once and
  removes the progress handler; notifications in the same stdout chunk as the answer are dropped.
- **Fix**: `EngineClient.analyze` reports, in order, the phases a completed analysis did not get notified.
- **Test**: `web/src/server/engine/engine-client-phases.test.ts` with the stub engine `burst` mode (four
  notifications back to back before the answer, five runs). Red before (`[]` in a run), green after.

### BUG-009 resolution

- `global.json`: SDK `8.0.100`, `rollForward: major` — SDK 8 when installed (canonical: CI, container, baselines),
  a newer SDK otherwise (012 TS-001: a machine with SDK 10 and runtime 8 keeps building and passing the doctor).
- `ResolutionWarnings` (analyzer): a C# project loaded by MSBuild with unresolved type references is reported as a
  `[WARN]` line of the analysis log (not a user warning: 009 FR-063/TS-071 reserves those to the VB load) (`ResolutionWarningsTests`, red before, green after). With SDK 10 only, `dotnet-ecommerce` reports
  225 unresolved references; with SDK 8, 12 (its NuGet packages are not restored, on every machine).
- Baselines `baseline-v1.1.0` and `baseline-v1.2.0` of `dotnet-ecommerce` regenerated under SDK 8
  (`RegressionBaselineCaptureTest`; v1.1.0 derived with the same contract-metadata difference as before). The new
  `output.json` equals the output of the GitHub Actions runner (Linux, SDK 8). No other project changed.
- Golden file `Fixtures/Golden/SampleProject.golden.json` of 009 TS-070 regenerated under SDK 8 with its capture
  switch (`VB009_WRITE_GOLDEN=1`): only `ControllerBase` resolution and the `cbo` of two components change;
  `CodeIssuesSample.golden.json` is unchanged.
- `docs/INSTALL.md`: "Reproducible .NET analysis (SDK 8)".

## BUG-011 — CI area jobs exceed the 20-minute limit on the hosted runner

- **Status**: fixed (pending confirmation on the GitHub Actions run of the fix)
- **Severity**: high (the "Product acceptance" job never finished; schema-check and Engine Java at 15–20 min)
- **Symptom**: first runs of the workflow on the own repository: "Product acceptance" cancelled at 20 min in every
  run, "Contract - schema-check" 15–20 min, "Engine Java" 19 min, "clean clone build & test" cancelled at 45 min.
  The workflow had never run before the move (the monorepo was never pushed).
- **Root cause**: the acceptance job ran every scenario with `DEVARCH_E2E=true` (30–40 min); the 005 Cucumber
  runner, which re-runs every suite, ran both in the schema job and inside `mvn verify` of Engine Java; the clean
  clone job ran two full `make test` in sequence. Also latent: `not @TS-006 and not @TS-007` excluded the TS-006/TS-007
  of 007 and 011 too (scenario ids are per feature).
- **Fix** (job ids, area conditions and limits unchanged: 006 TS-025/TS-030, user decision A3):
  - `acceptance`: matrix of feature groups (`ACCEPTANCE_FEATURES`, new filter of `cucumber.mjs`); the clean-clone
    exclusion applies to 006 only.
  - `schema`: matrix `schema-check` | `scenarios`.
  - `engine-java`: matrix `tests` | `static-analysis`; `mvn verify` skips the 005 runner (run by the schema job).
  - `acceptance-clean-clone`: matrix `@TS-006` | `@TS-007` of feature 006, 45 minutes each.
