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
 * @param strategy             {@value #TOKENS} (1.2.0 names) or {@value #DOMAIN}
 *                             (namespace domain of the members, 023)
 */
public record NamingConfig(double infrastructureRatio,
        Map<String, String> infrastructureLabels, List<String> roleKeywords,
        List<String> excludeTokens, int minTokenLength, String strategy) {

    /** Names from the most frequent domain tokens (1.2.0 behaviour). */
    public static final String TOKENS = "tokens";

    /** Names from the namespace domain shared by the members (023). */
    public static final String DOMAIN = "domain";

    /**
     * Immutable copies keeping the order of the labels.
     *
     * @param infrastructureRatio  infrastructure share
     * @param infrastructureLabels infrastructure labels
     * @param roleKeywords         role words
     * @param excludeTokens        excluded tokens
     * @param minTokenLength       minimum token length
     * @param strategy             naming strategy
     */
    public NamingConfig {
        infrastructureLabels = Collections.unmodifiableMap(
                new LinkedHashMap<>(infrastructureLabels));
        roleKeywords = List.copyOf(roleKeywords);
        excludeTokens = List.copyOf(excludeTokens);
    }

    /**
     * Whether proposals are named by their namespace domain.
     *
     * @return true in {@value #DOMAIN} mode
     */
    public boolean domainStrategy() {
        return DOMAIN.equals(strategy);
    }
}
