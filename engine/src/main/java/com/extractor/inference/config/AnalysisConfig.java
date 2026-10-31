package com.extractor.inference.config;

import java.util.List;

/**
 * Extended static analysis of the .NET analyzer (024-extended-static-analysis).
 *
 * @param extended           {@code auto} (Visual Basic only), {@code on} or {@code off}
 * @param rules              ids of the official analyzer rules to evaluate (empty = versioned list)
 * @param duplicateMinTokens minimum normalized tokens of a duplicated method
 * @param sarif              SARIF 2.1.0 reports to merge (paths relative to the analyzed project)
 * @param layerSuppressions  {@code Layer:RULE} entries removed for that fine layer
 * @param referenceAssemblies directory of .NET Framework reference assemblies for the VB
 *                           Adhoc fallback (025), or null for the host runtime assemblies
 */
public record AnalysisConfig(String extended, List<String> rules, int duplicateMinTokens,
        List<String> sarif, List<String> layerSuppressions, String referenceAssemblies) {

    /** Immutable copies. */
    public AnalysisConfig {
        rules = List.copyOf(rules);
        sarif = List.copyOf(sarif);
        layerSuppressions = List.copyOf(layerSuppressions);
    }

    /**
     * Whether the section must be forwarded to the .NET analyzer.
     *
     * @return true when any value differs from the defaults
     */
    public boolean affectsAnalyzer() {
        return !equals(InferenceConfig.defaults().analysis());
    }
}
