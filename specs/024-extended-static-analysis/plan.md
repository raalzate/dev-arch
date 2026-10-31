# Implementation Plan: Análisis estático extendido

**Branch**: `024-extended-static-analysis` | **Date**: 2026-10-30 | **Spec**: [spec.md](./spec.md) (plan feature 019)

## Summary
.NET: nueva pasada 11d `VbExtendedAnalyzer` (NetAnalyzers VB vía `CompilationWithAnalyzers` con `SpecificDiagnosticOptions` para las reglas activas; `AnalyzerFileReference` sobre los DLL del paquete copiados al output), `VbDeadCodeAnalyzer` (referencias por nombre en toda la compilación), `VbDuplicationAnalyzer` (hash SHA-256 de tokens normalizados por método), `VbMaintainabilityCalculator` (anotación `Maintainability:<n>`), `SarifImporter` (System.Text.Json), `LayerSuppressions` (post-proceso); `AnalysisOptions.Analysis` parseado de `--config`; `schema/extended-rules.json` embebido. Java: `AnalysisConfig` (sección `analysis`), `viability.maintainabilityWeight`, `DebtIndex` con MI, bridge reenvía la sección, preset actualizado; corrección BUG-010 (`EOL_DEPENDENCY` → `SECURITY`, prueba enum Java = enum esquema).

## Technical Context
.NET 8 / Roslyn 4.9.2 / `Microsoft.CodeAnalysis.NetAnalyzers` 8.0.0 (MIT, solo análisis); Java 17; Reqnroll + Cucumber.

## Constitution Check
I PASS (salidas por defecto intactas, pasada `auto` solo VB) · II PASS (una pasada, reglas en un archivo versionado) · III PASS · IV PASS (orden ordinal; hash SHA-256; sin tiempo ni red) · V PASS (analizador externo con excepción → `[WARN]` y resto conservado; SARIF inválido → advertencia) · VI PASS (un paquete MIT de solo análisis, versión fija; LGPL excluido) · VII PASS.

## Design
1. `AnalysisOptions.Analysis = AnalysisSection(PassMode Extended, IReadOnlyList<string> Rules, int DuplicateMinTokens, IReadOnlyList<string> Sarif, IReadOnlyList<string> LayerSuppressions)`; `Parse` lee `analysis`.
2. `ExtendedRuleSet` desde `DotNetAnalyzer.extended-rules.json` (`{"rules":[{"id":"CA2200","category":"reliability","cwe":null,"severity":"WARNING"}…]}`); `analysis.rules` no vacío filtra la lista a esos ids (ids desconocidos → advertencia).
3. `VbExtendedAnalyzer.Analyze(compilation, vbIndex, components, ruleSet)`: `compilation.WithOptions(opts.WithSpecificDiagnosticOptions(ids→Warn))`, `new CompilationWithAnalyzers(analyzers)`, `GetAnalyzerDiagnosticsAsync().Result`; agrupa por tipo propietario (`vbIndex.Owner(location)`); mapea tipo/severidad/mensaje; ordena.
4. `VbDeadCodeAnalyzer`: conjunto de nombres referenciados (IdentifierName/MemberAccess/Handles/Implements/Overrides en todos los árboles) menos los de la propia declaración; reglas de exclusión FR-020.
5. `VbDuplicationAnalyzer`: tokens normalizados por `MethodBlockSyntax`; hash SHA-256 hex; grupos ≥ 2 componentes.
6. `VbMaintainabilityCalculator`: Halstead (operadores = keywords/punct, operandos = identifiers/literals) por tipo; CC suma (`VbMetricsCalculator.CyclomaticComplexity`); LOC del componente; anotación.
7. `SarifImporter.Import(paths, root, components)` → issues + advertencias.
8. `LayerSuppressions.Apply(components, list)`.
9. Java: `AnalysisConfig(extended, rules, duplicateMinTokens, sarif, layerSuppressions)`; `ViabilityConfig.maintainabilityWeight`; `DebtIndex` lee `Maintainability:`; bridge: sección `analysis` cuando no es default; preset.
10. Pruebas: Reqnroll `extended-analysis.feature` (+ `Bdd/ExtendedSteps.cs`); Cucumber `extended-analysis-engine.feature` (`extendedbdd` glue + `storedprocsbdd`); fixture `Fixtures/VbLegacy/SyntheticExtended` + `Golden/SyntheticExtended.golden.json`; `CodeIssueTypeTest` (enum Java = esquema).

## Project Structure
```text
engine/src/main/dotnet/DotNetAnalyzer/Analysis/{AnalysisOptions.cs, ProjectAnalyzer.cs, Vb/VbExtendedAnalyzer.cs, Vb/VbDeadCodeAnalyzer.cs, Vb/VbDuplicationAnalyzer.cs, Vb/VbMaintainabilityCalculator.cs, Vb/ExtendedRuleSet.cs, Sarif/SarifImporter.cs, LayerSuppressions.cs}
engine/src/main/dotnet/DotNetAnalyzer/DotNetAnalyzer.csproj (PackageReference NetAnalyzers 8.0.0, DLL copiados, recurso extended-rules)
schema/extended-rules.json · schema/1.0.0/inference-config.schema.json · engine/CONFIGURATION.md · docs
engine/src/main/java/com/extractor/inference/config/{AnalysisConfig.java, InferenceConfig, Loader, Validator, ViabilityConfig} · inference/DebtIndex · analyzer/DotNetBridgeAnalyzer
engine/src/test/dotnet/DotNetAnalyzer.Tests/{Bdd/ExtendedSteps.cs, Fixtures/VbLegacy/SyntheticExtended/**, Fixtures/Golden/SyntheticExtended.golden.json}
engine/src/test/java/com/extractor/{extendedbdd/*, model/CodeIssueTypeTest}
```

## Requirement Coverage
FR-001 → 1, 9 · FR-010/011 → 2, 3 · FR-020 → 4 · FR-030 → 5 · FR-040/041 → 6, 9 · FR-050 → 7 · FR-060 → 8 · FR-070/080 → 10.
