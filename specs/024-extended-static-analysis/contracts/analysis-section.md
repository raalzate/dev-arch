# Contract: `analysis` section and extended issues (024, additive to 1.0.0)
Keys: `analysis.extended` (auto|on|off), `analysis.rules` (string[]), `analysis.duplicateMinTokens` (integer ≥ 10), `analysis.sarif` (string[]), `analysis.layerSuppressions` (string[] "Layer:RULE"), `viability.maintainabilityWeight` ([0,1]).
Issue conventions: `pattern` = rule id; `type` mapped to the closed enum; `message` prefixes `[category]`, `[CWE-nnn]`, `[source:<tool>]`. Annotation `Maintainability:<0-100>`.
Versioned rule list: `schema/extended-rules.json`.
