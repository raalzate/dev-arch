# Data Model: 010-modernization-ux

Todos los datos del contrato usan los tipos generados de `@static-inference/schema` y, para la configuración de inferencia y las respuestas de 008, de su módulo de extensión generado `@static-inference/schema/extensions` (`DependencyGraph`, `ConsolidatedArchitecture`, `EntrypointsDocument`, `Component`, `Proposal`, `InferenceConfig`, `ScoreProposalResponse`, …). Las entidades siguientes son modelos de presentación de la web (no forman parte del contrato) y viven en `web/src/lib/modernization/`.

## TechnologyProfile (FR-001, FR-001a, FR-002, FR-007, FR-015)

| Campo | Tipo | Regla |
|---|---|---|
| `technology` | `'java' \| 'csharp' \| 'vb' \| 'dotnet-mixed' \| 'dotnet'` | `meta.source = spoon` → `java`; `roslyn`/`roslyn-fallback` → por extensiones de `components[].files[]` (`.cs`, `.vb`, sin distinguir mayúsculas) |
| `label` | string | `Java`, `.NET · C#`, `VB.NET`, `.NET · C# + VB`, `.NET` |
| `languages` | `('java'\|'csharp'\|'vb')[]` | ordenados |
| `source` | `GraphMeta['source']` | copia |
| `reducedFidelity` | boolean | `source === 'roslyn-fallback'` |
| `accent` | `'java' \| 'dotnet' \| 'vb'` | `vb` si hay VB, `dotnet` si .NET sin VB |

Reglas de pertenencia: `appliesTo(profile, t)` es verdadero si `t === 'all'`, si `t` coincide con `technology`, o si `technology = dotnet-mixed` y `t ∈ {csharp, vb, dotnet}`, o si `t = dotnet` y la tecnología es `csharp | vb | dotnet-mixed | dotnet`.

## SectionDef / ResolvedSections (FR-003..FR-006, FR-028)

| Campo | Tipo |
|---|---|
| `id` | string estable (`data-section` en la página) |
| `step` | `'summary' \| 'map' \| 'proposals' \| 'findings' \| 'plan'` |
| `title` | string (español) |
| `appliesTo` | `'all' \| ('java'\|'csharp'\|'vb'\|'dotnet')[]` |
| `items(data)` | `SectionItem[]` |

`resolveSections(step, profile, data)` → `{ visible: {def, items}[], empty: string[] }`; `visible` solo si aplica y `items.length > 0`; `empty` = títulos aplicables sin elementos (orden del registro). Catálogo: [contracts/ui-sections.md](./contracts/ui-sections.md).

## AnalysisData (agregado de presentación)

`{ graph: DependencyGraph, architecture: ConsolidatedArchitecture, contracts: EntrypointsDocument | null, status: AnalysisStatus }`.

## GraphView (FR-017..FR-021)

- `edgeTypes(edge) = edge.type.split(',').map(trim).filter(Boolean)`; `legend(edges) → {type, count}[]` ordenado por nombre.
- `visibleEdges(edges, enabled:Set)`: una arista es visible si alguno de sus tipos está habilitado.
- `strokeWidth(weight, maxWeight) = 1 + 5 × sqrt(weight / maxWeight)` (1–6 px; `maxWeight ≤ 0` → 1).
- `groupKey(component, mode, proposals)`: `layer` → etiqueta de capa (D3); `proposal` → nombre de la propuesta que contiene el componente, si no "Sin propuesta".
- `SEVERITY_ORDER = CRITICAL > ERROR > WARNING > INFO`; `meetsSeverity(component, min)`.

## InferenceScenario (FR-022..FR-027)

| Campo | Tipo |
|---|---|
| `params` | `InferenceParam[]` = `{ path, label, min, max, step, defaultValue }` |
| `values` | `Record<path, number>` |
| `minViability` | `'Alta' \| 'Media' \| 'Baja' \| null` |
| `config` | `InferenceConfig` construido solo con los valores distintos del default (`toInferenceConfig`) |
| `architecture` | `ConsolidatedArchitecture` recalculada o `null` (original) |
| `error` | mensaje del motor o `null` |

Parámetros (FR-022): `viability.thresholds.high`, `viability.thresholds.medium`, `viability.weights.cohesion`, `viability.weights.coupling`, `viability.weights.data`, `evidence.evidenceThreshold`, `clustering.largeClusterRatio` (+ `minViability`).

## EditedProposal (FR-026)

`{ proposalId, components: string[], score: ScoreProposalResponse | null, error: string | null }`. Mover un componente lo quita de su propuesta y lo añade a la destino; ambas quedan marcadas como editadas y se re-puntúan.

## ModernizationPlan (FR-033..FR-035)

`{ profile, project, analysisId, finishedAt, totals, severityCounts, stages: Stage[], supportLibraries, warnings, parameters }`; `Stage = { index, title, viability, proposals: PlanItem[] }`; `PlanItem = { name, viability, score?, components, cohesion, coupling, tables, sensitive, secrets, criticalIssues, actions, rationale, entrypoint }`. Orden: viabilidad Alta→Media→Baja, `external_coupling` ascendente, `name` ascendente. Etapas vacías se omiten.

## HistoryEntry (FR-036)

Vista pública de 007 (`publicJob`) + `technology: TechnologyProfile['technology'] | null` + `label` (solo completados, calculado una vez y cacheado por id).

## Comparison (FR-038)

`{ a: Totals, b: Totals, delta: Totals, onlyInA: string[], onlyInB: string[] }`, `Totals = { components, loc, edges, proposals: {Alta, Media, Baja}, issues: {CRITICAL, ERROR, WARNING, INFO} }`; `delta = b − a`; listas ordenadas.

## LlmSelection (FR-039, FR-040)

`{ provider: 'gemini' | 'anthropic', model: string }`; `template: 'java-spring-jee' | 'aspnet-core' | 'vb-desktop'`.
