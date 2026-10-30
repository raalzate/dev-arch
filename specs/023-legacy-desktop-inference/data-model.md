# Data Model: 023
## Configuración nueva
| Campo | Tipo | Default | Preset legacy-desktop |
|---|---|---|---|
| `inference.preset` | auto\|none\|legacy-desktop | auto | — |
| `inference.presentationInCohesion` | boolean | true | false |
| `viability.debtWeight` | [0,1] | 0 | 0.15 |
| `viability.weights` | — | 0.5/0.35/0.15 | 0.40/0.30/0.15 |
| `evidence.weights` | — | 0.25/0.35/0.30/0.10 | table 0.40, call 0.30, token 0.20, event 0.10 |
| `consolidation.domainMergeMaxSize` | int | 50 | 120 |
| `consolidation.maxMergedSizeWithoutSimilarity` | int | 40 | 120 |
| `naming.strategy` | tokens\|domain | tokens | domain |
| `recommendation.supportNamespaces` | string[] | [] | Common, Commons, Shared, Utils, Utilities |
| `recommendation.minReferencingDomains` | int ≥ 0 | 0 | 3 |
| `dataAccess.entityHeuristic` | boolean | false | true |
## Índice de deuda
`issues = Σ w(sev)`, w = CRITICAL 8, ERROR 4, WARNING 2, INFO 0.5; `density = issues / max(1, loc/100)`; `base = 1 − 1/(1 + density/10)`; `eol = min(0.3, 0.1 × #Dependency:eol:*)`; `cc = complexity_max > 15 ? 0.1 : 0`; `score = min(1, base + eol + cc)`, 3 decimales (`Locale.ROOT`). Propuesta: `Σ score×max(loc,1) / Σ max(loc,1)`.
## Texto
- `summary` += `\nPreset de inferencia: legacy-desktop` (cuando aplica)
- `rationale` += `Deuda técnica: 0.412` y `Mayor deuda: A (0.800), B (0.600), C (0.300)` (cuando `debtWeight > 0`)
