# Bug Reports: 002-dotnet-roslyn-analyzer

## BUG-001

**Reported**: 2026-10-07
**Severity**: high
**Status**: fixed
**GitHub Issue**: _(none)_

**Description**: Analysis output is not deterministic: `meta.collected_at` carries a wall-clock timestamp (Java and .NET), violating Constitution principle IV

**Reproduction Steps**:
1. Run the CLI twice on the same project (`test-for-demo/java-standar`) into two output files
2. Compare the dependency graph JSON byte by byte
3. Observe only `meta.collected_at` differs

**Root Cause**: `DependencyGraph.Meta` (Java) and `Meta` (.NET) stamped `Instant.now()`/`DateTime.UtcNow` unconditionally.

**Fix Reference**: `collected_at` is null/omitted unless `STATIC_INFERENCE_COLLECTED_AT=true`; tests `DependencyGraphMetaTest`, `MetaDeterminismTests`; CLI runs on java-standar and dotnet-ecommerce byte-identical.

---

## BUG-002

**Reported**: 2026-10-07
**Severity**: high
**Status**: fixed
**GitHub Issue**: _(none)_

**Description**: Java↔.NET bridge can hang: stdout is drained to EOF before stderr, and the timeout is only evaluated after both streams close

**Reproduction Steps**:
1. Use a dotnet-analyzer executable that writes more than the OS pipe buffer (~64 KB) to stderr before writing stdout
2. Run the analysis of a .NET project
3. Observe the bridge blocks forever; the configured timeout never fires

**Root Cause**: `DotNetBridgeAnalyzer` read stdout to EOF, then stderr, then `waitFor(timeout)`: a full stderr pipe blocked the child, and blocking reads prevented the timeout from firing.

**Fix Reference**: Both streams drained concurrently (`CompletableFuture`), `waitFor` enforced before joining, process tree killed on timeout; timeout injectable; test `DotNetBridgeProcessTest`.

---

## BUG-003

**Reported**: 2026-10-07
**Severity**: medium
**Status**: fixed
**GitHub Issue**: _(none)_

**Description**: The dotnet-analyzer tool locator does not find `dotnet-analyzer.exe` on Windows

**Reproduction Steps**:
1. On Windows, place `dotnet-analyzer.exe` next to the JAR (or in PATH / DOTNET_ANALYZER_PATH directory)
2. Analyze a .NET project
3. Observe "Could not find 'dotnet-analyzer' executable"

**Root Cause**: `DotNetToolLocator` only resolved the extension-less name `dotnet-analyzer`.

**Fix Reference**: Locator tries `dotnet-analyzer.exe` first on Windows (sibling, DOTNET_ANALYZER_PATH, PATH); tests in `DotNetToolLocatorTest`.

---

## BUG-004

**Reported**: 2026-10-07
**Severity**: high
**Status**: fixed
**GitHub Issue**: _(none)_

**Description**: Proposal names can differ between runs: the domain-token extraction stops at the first matching role keyword, but role keywords are iterated in an unspecified, per-process order

**Reproduction Steps**:
1. Analyze a project with a class whose name contains two role keywords (e.g. `OrderServiceHandler`)
2. Repeat the analysis in a new process several times
3. Observe the proposal name alternates (e.g. "Componente de Order" vs "Componente de Order y Orderservice")

**Root Cause**: `MicroserviceNameGenerator.extractDomainTokens` breaks on the first matching role while iterating `Set.of(...)`, whose iteration order is salted per JVM.

**Fix Reference**: role keywords held in `List.of(...)` (fixed precedence); test `MicroserviceNameGeneratorTest`; 5 runs on jee-architecture-master byte-identical.

---

## BUG-005

**Reported**: 2026-10-08
**Severity**: high
**Status**: fixed
**GitHub Issue**: _(none)_

**Description**: Released .NET analyzer always runs in degraded mode (`meta.source = roslyn-fallback`): the self-contained single-file build can never load MSBuild

**Reproduction Steps**:
1. Download a release bundle and run it on a machine with the .NET 8 SDK installed
2. Analyze `test-for-demo/dotnet-ecommerce`
3. Observe `meta.source` is `roslyn-fallback`, while a framework-dependent build reports `roslyn`

**Root Cause**: Release job published `--self-contained true -p:PublishSingleFile=true`; MSBuildLocator cannot load SDK assemblies from a single-file bundle, so `ProjectAnalyzer` always fell back to Adhoc.

**Fix Reference**: Release publishes framework-dependent (`--self-contained false`); release README states .NET 8 runtime/SDK requirement; test `ReleaseWorkflowTest`.

---

## BUG-006

**Reported**: 2026-10-08
**Severity**: low
**Status**: fixed
**GitHub Issue**: _(none)_

**Description**: Tool-locator "not found" test is not hermetic: it fails when `DOTNET_ANALYZER_PATH` is exported or the analyzer is on PATH

**Reproduction Steps**:
1. `export DOTNET_ANALYZER_PATH=<dir containing dotnet-analyzer>`
2. Run `DotNetToolLocatorTest`
3. Observe `locate_whenNotFound_throwsWithInstructions` fails

**Root Cause**: `DotNetToolLocator` read `System.getenv` directly, so tests inherited the developer environment.

**Fix Reference**: Package-private constructor with injectable environment lookup; locator tests use an empty environment; test `locate_withEmptyInjectedEnvironment_throwsEvenIfProcessEnvIsSet`.

---

## BUG-007

**Reported**: 2026-10-08
**Severity**: medium
**Status**: closed — not reproduced (2026-10-30)
**GitHub Issue**: _(none)_

**Description**: Intermittent failure of TS-017 `SchemaVersionContractTest.twoRunsAreByteIdentical[dotnet-ecommerce]` (output.json mismatch at byte 782) during full `mvn verify`

**Reproduction Steps**:
1. Run full `mvn -B -o verify` repeatedly (observed 2 failures in ~5 full runs, one while `dotnet test` ran concurrently)
2. Not reproduced: 8 sequential + 12 concurrent raw analyzer runs, 6 CLI runs, 3 fresh-copy pairs, 12 targeted test loops, 2 full verifies — all byte-identical

**Root Cause**: not confirmed. The most likely cause was BUG-009 (014-standalone-repo): `Microsoft.AspNetCore.App` reference assemblies resolved or not depending on the installed .NET SDK, which changed `extends`/`cbo` of `dotnet-ecommerce`; a concurrent `dotnet test` on the development machine changed which SDK/runtime the analyzer picked up. Since the `global.json` pin and the fidelity warning of BUG-009, TS-017 has passed in every continuous-integration run and in 6 consecutive local runs on 2026-10-30 (`mvn -o test -Dtest='SchemaVersionContractTest#twoRunsAreByteIdentical*'`, both projects).

**Fix Reference**: no code change. Closed under 014b (PLAN-VB-PLATAFORMA-LEGACY §4, engine debt): the byte-identical double run is the exit criterion of features 015-019, so this record is closed with evidence instead of staying open; reopen with the output diff if it recurs.

---

## BUG-008

**Reported**: 2026-10-30
**Severity**: medium
**Status**: fixed
**GitHub Issue**: _(none)_

**Description**: File enumerations that feed the analysis are not ordered before use (`Directory.GetFiles` in `LoadCSharpAdhoc`, `Files.walk` in the Java resolvers and scanners), so the order of compilation and of collected items depends on the file system

**Reproduction Steps**:
1. Analyze a directory of loose `.cs` files without a project file (Adhoc fallback) on two file systems that enumerate in different orders (APFS vs ext4, or the same files created in a different order on a file system that returns creation order).
2. Compare the two outputs after replacing the root path.
3. Observe that the compilation order (and any order-dependent result: duplicate-member resolution, first-wins dictionaries, the order of secret locations and discovered source paths) is not guaranteed to be the same. `VbProjectLoader` and the project discovery of `ProjectAnalyzer` already sort ordinally; `LoadCSharpAdhoc` and the Java `Files.walk` pipelines (`DependencyResolver`, `DotNetDependencyResolver`, `SourcePathDiscoverer`, `SecretLocationScanner`) do not.

**Root Cause**: `Directory.GetFiles` and `Files.walk` return entries in file-system order (not specified by either API); the results are consumed directly.

**Fix Reference**: `LoadCSharpAdhoc` sorts the `.cs` files with `StringComparer.Ordinal`; every `Files.walk` pipeline of the engine calls `.sorted()` (`SourcePathDiscoverer`, `DependencyResolver`, `DotNetDependencyResolver`, `SecretLocationScanner`, `ProjectTypeDetector`, `McpResources`). Scenario `bugfix_BUG-008.feature`: two directories with the same loose sources created in opposite order give the same graph, and a source check fails on any `Files.walk` without `.sorted(` or any `var x = Directory.GetFiles(...)` not followed by `Array.Sort(x, StringComparer.Ordinal)`. The demo baselines (`BaselineParityTest`) stay byte-identical.
