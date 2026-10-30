# Data Model: 024
## Configuración nueva
| Campo | Tipo | Default | Preset legacy-desktop |
|---|---|---|---|
| `analysis.extended` | auto\|on\|off | auto | — |
| `analysis.rules` | string[] | [] (= lista versionada) | — |
| `analysis.duplicateMinTokens` | int ≥ 10 | 30 | — |
| `analysis.sarif` | string[] | [] | — |
| `analysis.layerSuppressions` | string[] `Capa:REGLA` | [] | Presentación:HIGH_CYCLOMATIC_COMPLEXITY, Presentación:UNUSED_PUBLIC_MEMBER, Reportes:UNUSED_PUBLIC_MEMBER |
| `viability.maintainabilityWeight` | [0,1] | 0 | 0.10 |
## Salida (contrato 1.0.0 sin cambio)
- `code_issues[]`: `pattern` = `CAxxxx` | `UNUSED_PUBLIC_MEMBER` | `DUPLICATED_CODE` | regla SARIF; `type` ∈ enum cerrado; `message` = `[categoría]` `[CWE-nnn]` `[source:tool]` + texto.
- `annotations`: `Maintainability:<0-100>`.
## `schema/extended-rules.json`
`{"version":"1","package":"Microsoft.CodeAnalysis.NetAnalyzers 8.0.0","rules":[{"id":"CA2200","category":"reliability","cwe":null},{"id":"CA5351","category":"security","cwe":"CWE-327"},…]}`
