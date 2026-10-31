package com.extractor.inference.config;

import java.util.List;

/**
 * External dependency and end-of-life detection of the .NET analyzer (022-external-integrations).
 *
 * @param enabled {@code auto} (Visual Basic compilations only), {@code on} or {@code off}
 * @param eol     name prefixes added to the versioned end-of-life list ({@code schema/eol-dependencies.json})
 */
public record DependenciesConfig(String enabled, List<String> eol) {

    public DependenciesConfig {
        eol = List.copyOf(eol);
    }

    /** @return true when the analyzer must receive the section */
    public boolean affectsAnalyzer() {
        return !equals(InferenceConfig.defaults().dependencies());
    }
}
