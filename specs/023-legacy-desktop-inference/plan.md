# Implementation Plan: Inferencia para el perfil desktop legacy

**Branch**: `023-legacy-desktop-inference` | **Date**: 2026-10-30 | **Spec**: [spec.md](./spec.md) (plan feature 018)

## Summary
Solo motor Java y configuración. `InferenceConfig` gana `inference` (`preset`, `presentationInCohesion`), `viability.debtWeight`, `naming.strategy`, `recommendation.supportNamespaces`, `recommendation.minReferencingDomains`; el preset `legacy-desktop` es un JSON versionado (`inference-preset-legacy-desktop.json`) que `InferenceConfigLoader.applyPreset(config, graph)` superpone a los defaults sin pisar lo explícito del usuario (se guarda el árbol de overrides). `DebtIndex` calcula el índice por componente/propuesta; `ViabilityScorer` lo resta con `debtWeight` y añade las líneas de `rationale`; `MetricsCalculator`/`ViabilityScorer` excluyen presentación de cohesión/densidad cuando `presentationInCohesion = false`; `MicroserviceNameGenerator` estrategia `domain`; `MicroserviceRecommendationEngine.isSupportGroup` con namespaces de soporte y fan-in; `summary` con el preset. Defaults inalterados ⇒ baselines idénticos.

## Technical Context
Java 17; 0 dependencias; Cucumber `@engine` + JUnit; prueba `Corpus` opt-in (grafo de la referencia generado por el analizador .NET).

## Constitution Check
I PASS (defaults y salidas intactos; contrato sin cambio; schema `inference-config` aditivo) · II PASS (`DebtIndex` y `Presets` únicos; CLI/MCP/REST comparten `InferenceConfig`) · III PASS · IV PASS (preset por señales del grafo; orden ordinal; 3 decimales invariantes) · V PASS (preset desconocido ⇒ error de configuración) · VI PASS · VII PASS (tipos TS regenerados).

## Design
1. `InferenceSection(String preset, boolean presentationInCohesion)` + `ViabilityConfig.debtWeight` + `NamingConfig.strategy` + `RecommendationConfig.supportNamespaces/minReferencingDomains`; defaults `auto`, `true`, `0`, `tokens`, `[]`, `0`; validación.
2. `Presets`: `LEGACY_DESKTOP` desde recurso JSON; `InferenceConfigLoader.fromJson` conserva el árbol de overrides en `InferenceConfig.overrides()` (JSON) para que `Presets.apply(config, graph)` = defaults ← preset ← overrides. Selección: `preset` explícito, o `auto` ⇒ `roslyn-fallback` o ≥ 50 % componentes con archivo `.vb`.
3. `InferenceService.infer` resuelve el preset una vez (`ResolvedConfig { config, presetName }`) y lo pasa a `InferenceEngine` y `MicroserviceRecommendationEngine`; `summary` añade `Preset de inferencia: <name>`.
4. `DebtIndex.of(component)` (FR-040) y `DebtIndex.of(components)` (FR-041); `ViabilityScorer`: `score -= debtWeight × debt`; `rationale` += líneas FR-043 cuando `debtWeight > 0`.
5. Presentación fuera de cohesión: `MetricsCalculator.calculateMetrics` y `ViabilityScorer.calculateAdjustedCohesion/InternalEdgeDensity` filtran miembros con anotación `Layer:Presentación|Reportes` cuando `presentationInCohesion = false` y queda al menos uno.
6. `MicroserviceNameGenerator.generateName(..., naming, components)`: `domain` ⇒ prefijo común global del grafo, namespace común de los miembros, hasta 2 segmentos; ` · <Entidad>` si heurística activa; fallback `tokens`.
7. `isSupportGroup`: regla actual ∨ `supportNamespaces` (ratio ≥ `supportRatio`) ∨ fan-in de dominios ≥ `minReferencingDomains`.
8. Pruebas: Cucumber `RunLegacyInferenceFeaturesTest` (glue propio + `storedprocsbdd`); JUnit `DebtIndexTest`, `PresetsTest`; `Corpus` opt-in Java (`LegacyDesktopCorpusTest`, `@Tag("corpus")`, grafo de `engine/test-for-demo/vb-demo-legacy` vía analizador).
9. Docs: `engine/CONFIGURATION.md` (filas + sección Presets), `docs/VB-LEGACY.md`, `docs/SCHEMA.md`, `CHANGELOG.md`.

## Project Structure
```text
engine/src/main/java/com/extractor/inference/config/{InferenceSection.java (NEW), Presets.java (NEW), InferenceConfig, InferenceConfigLoader, InferenceConfigValidator, ViabilityConfig, NamingConfig, RecommendationConfig}
engine/src/main/resources/static-inference/{inference-defaults.json, inference-preset-legacy-desktop.json (NEW)}
engine/src/main/java/com/extractor/inference/{DebtIndex.java (NEW), ViabilityScorer, MetricsCalculator, MicroserviceNameGenerator, MicroserviceRecommendationEngine, InferenceEngine}
engine/src/main/java/com/extractor/service/InferenceService.java
schema/1.0.0/inference-config.schema.json · schema/extensions/*.ts · engine/CONFIGURATION.md · docs
engine/src/test/java/com/extractor/{inference/DebtIndexTest, inference/config/PresetsTest, legacyinferencebdd/*, corpus/LegacyDesktopCorpusTest}
```

## Complexity Tracking
| Riesgo | Mitigación |
|---|---|
| Preset cambia muchos parámetros a la vez | Archivo versionado único; `auto` solo con señales VB; baselines guardan los defaults |
| Deuda en texto (`rationale`) en lugar de campo | Contrato cerrado; formato fijo `Deuda técnica: 0.000` parseable; 1.1.0 pendiente |
| Exclusión de presentación cambia métricas | Solo con `presentationInCohesion=false` (preset) |

## Requirement Coverage
FR-001..003 → Design 1-3 · FR-010 → 5 · FR-020 → 6 · FR-030 → 7 · FR-040..043 → 4 · FR-050/051 → 8-9.
