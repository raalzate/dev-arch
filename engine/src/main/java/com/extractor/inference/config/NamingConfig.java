package com.extractor.inference.config;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Name generation parameters ({@code MicroserviceNameGenerator}).
 *
 * @param infrastructureRatio  infrastructure share of an infrastructure name
 * @param infrastructureLabels infrastructure word → label
 * @param roleKeywords         role words, first match wins (ordered)
 * @param excludeTokens        tokens never used in a name
 * @param minTokenLength       minimum length of a name token
 */
public record NamingConfig(double infrastructureRatio,
        Map<String, String> infrastructureLabels, List<String> roleKeywords,
        List<String> excludeTokens, int minTokenLength) {

    /**
     * Immutable copies keeping the order of the labels.
     *
     * @param infrastructureRatio  infrastructure share
     * @param infrastructureLabels infrastructure labels
     * @param roleKeywords         role words
     * @param excludeTokens        excluded tokens
     * @param minTokenLength       minimum token length
     */
    public NamingConfig {
        infrastructureLabels = Collections.unmodifiableMap(
                new LinkedHashMap<>(infrastructureLabels));
        roleKeywords = List.copyOf(roleKeywords);
        excludeTokens = List.copyOf(excludeTokens);
    }
}
