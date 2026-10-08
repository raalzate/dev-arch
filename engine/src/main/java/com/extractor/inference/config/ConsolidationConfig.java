package com.extractor.inference.config;

import java.util.List;

/**
 * Cluster consolidation parameters ({@code ClusterConsolidator}).
 *
 * @param genericNames                   names never used for the merge by
 *                                       domain name
 * @param domainMergeMaxSize             maximum size of a merge by name
 * @param significantInfrastructureRatio infrastructure share of a group
 *                                       that marks it as infrastructure
 * @param supportRatio                   infrastructure share of a support
 *                                       cluster
 * @param maxMergedSizeWithoutSimilarity maximum merged size without a high
 *                                       token similarity
 * @param highTokenSimilarity            token similarity that lifts the
 *                                       size guard
 * @param separationCallDensity          call density below which two strong
 *                                       candidates stay apart
 * @param separationTableJaccard         table Jaccard below which two strong
 *                                       candidates stay apart
 * @param strongCandidate                definition of a strong candidate
 * @param infrastructureKeywords         infrastructure words (simple name)
 */
public record ConsolidationConfig(List<String> genericNames,
        int domainMergeMaxSize, double significantInfrastructureRatio,
        double supportRatio, int maxMergedSizeWithoutSimilarity,
        double highTokenSimilarity, double separationCallDensity,
        double separationTableJaccard, StrongCandidate strongCandidate,
        List<String> infrastructureKeywords) {

    /**
     * Immutable copies of the lists.
     *
     * @param genericNames                   generic names
     * @param domainMergeMaxSize             maximum size of a merge by name
     * @param significantInfrastructureRatio infrastructure share
     * @param supportRatio                   support share
     * @param maxMergedSizeWithoutSimilarity size guard
     * @param highTokenSimilarity            similarity lifting the guard
     * @param separationCallDensity          separation call density
     * @param separationTableJaccard         separation table Jaccard
     * @param strongCandidate                strong candidate definition
     * @param infrastructureKeywords         infrastructure words
     */
    public ConsolidationConfig {
        genericNames = List.copyOf(genericNames);
        infrastructureKeywords = List.copyOf(infrastructureKeywords);
    }

    /**
     * A cluster that is a strong microservice candidate.
     *
     * @param minCohesion minimum cohesion
     * @param maxCoupling coupling must be below this value
     * @param minSize     minimum number of members
     */
    public record StrongCandidate(double minCohesion, double maxCoupling,
            int minSize) {
    }
}
