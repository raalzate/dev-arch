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

- **Status**: open — decision of the user needed (changes the locked 1.1.0 .NET baseline)
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
