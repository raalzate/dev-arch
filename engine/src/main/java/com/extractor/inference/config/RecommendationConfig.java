package com.extractor.inference.config;

import java.util.List;

/**
 * Proposal assembly parameters ({@code MicroserviceRecommendationEngine}).
 *
 * @param supportRatio           infrastructure share of a support group
 * @param infrastructureKeywords infrastructure words (simple name)
 * @param dataJaccardMode        {@value #LEGACY} (fixed value) or
 *                               {@value #DATA_COHESION}
 * @param legacyDataJaccard      fixed {@code data_jaccard} of a proposal
 *                               with tables in legacy mode
 */
public record RecommendationConfig(double supportRatio,
        List<String> infrastructureKeywords, String dataJaccardMode,
        double legacyDataJaccard) {

    /** Fixed {@code data_jaccard} (1.2.0 behaviour). */
    public static final String LEGACY = "legacy";

    /** {@code data_jaccard} = data cohesion of the viability score. */
    public static final String DATA_COHESION = "data_cohesion";

    /**
     * Immutable copy of the list.
     *
     * @param supportRatio           support share
     * @param infrastructureKeywords infrastructure words
     * @param dataJaccardMode        data Jaccard mode
     * @param legacyDataJaccard      legacy data Jaccard
     */
    public RecommendationConfig {
        infrastructureKeywords = List.copyOf(infrastructureKeywords);
    }

    /**
     * Whether {@code data_jaccard} is the data cohesion of the score.
     *
     * @return true in {@value #DATA_COHESION} mode
     */
    public boolean computedDataJaccard() {
        return DATA_COHESION.equals(dataJaccardMode);
    }
}
