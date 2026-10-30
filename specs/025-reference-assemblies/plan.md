# Implementation Plan: Ensamblados de referencia (opt-in) y runner Windows manual

**Branch**: `025-reference-assemblies` | **Date**: 2026-10-30 | **Spec**: [spec.md](./spec.md)

## Summary
.NET: `AnalysisSection.ReferenceAssemblies` (string?), `VbProjectLoader.ReferenceAssembliesDirectory` (fijado por `ProjectAnalyzer` desde las opciones) → `MetadataReference.CreateFromFile` de `*.dll` + `Facades/*.dll` ordenados en lugar de `AppDomain` assemblies; advertencia si falta. Java: `AnalysisConfig.referenceAssemblies` (nullable), bridge reenvía ruta absoluta, schema/TS/docs. Fixture `SyntheticExtended` + `Rules/SqlQuery.vb`; test csproj referencia el paquete net48 (`ExcludeAssets=all`, `GeneratePathProperty`) y los pasos resuelven la carpeta desde `NUGET_PACKAGES`/`~/.nuget/packages`. Workflow `windows-fidelity.yml` manual.

## Constitution Check
I PASS (opt-in) · II PASS · III PASS · IV PASS (orden ordinal) · V PASS (carpeta ausente → advertencia) · VI PASS (sin dependencia nueva en el motor; paquete solo en pruebas) · VII PASS.

## Design
1. `AnalysisOptions.Parse`: `referenceAssemblies` string|null.
2. `VbProjectLoader`: `public static string? ReferenceAssembliesDirectory`; `References()` devuelve los del directorio (si válido) o los del runtime; `[info]` con el conteo.
3. `ProjectAnalyzer`: asigna la propiedad al inicio del análisis; carpeta inválida → `_userWarnings`.
4. Java: `AnalysisConfig` + loader null-string + bridge + schema + `CONFIGURATION.md`.
5. Pruebas: `reference-assemblies.feature` (Reqnroll) con pasos `Given the .NET Framework 4.8 reference assemblies of the test host` y `When the project is analyzed with the configuration using the reference assemblies:` (`<REFS>` sustituido); `reference-assemblies-engine.feature` (Cucumber, glue `storedprocsbdd` + `legacyinferencebdd`).
6. `.github/workflows/windows-fidelity.yml`; docs.

## Requirement Coverage
FR-001 → 1, 4 · FR-010/011 → 2, 3 · FR-020 → 5 (baselines) · FR-030 → 6 · FR-040 → 6.
