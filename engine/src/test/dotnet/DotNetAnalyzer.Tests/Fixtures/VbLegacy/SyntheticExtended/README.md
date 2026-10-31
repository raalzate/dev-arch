# SyntheticExtended (synthetic VB.NET legacy fixture)

Synthetic, redistributable fixture written for feature 024-extended-static-analysis. It exercises the official
analyzer rules of the versioned list (`schema/extended-rules.json`: rethrow, weak hash, catch-all, culture, ignored
results), dead public members (positive `Dead/Orphans.vb`, negative `Dead/Helpers.vb`), duplicated methods
(`Dup/CopyA.vb` = `Dup/CopyB.vb`, `Dup/Unique.vb` differs), a form and a controller with high complexity (layer
suppressions), a `SqlCommand` query that only resolves with .NET Framework reference assemblies (025), and a SARIF 2.1.0 sample (`reports/sonar.sarif`) with one duplicate and one unmatched result. All
names are fictitious; it is not a real system and is not derived from any real code base.
