package com.extractor.inference.config;

import com.fasterxml.jackson.annotation.JsonIgnore;

/**
 * Every parameter of the inference, grouped by stage (FR-004).
 *
 * @param detection      project type detection
 * @param clustering     initial clustering
 * @param evidence       inter-cluster evidence
 * @param consolidation  cluster consolidation
 * @param viability      viability score and rationale
 * @param recommendation proposal assembly
 * @param naming         name generation
 */
public record InferenceConfig(DetectionConfig detection,
        ClusteringConfig clustering, EvidenceConfig evidence,
        ConsolidationConfig consolidation, ViabilityConfig viability,
        RecommendationConfig recommendation, NamingConfig naming,
        DataAccessConfig dataAccess) {

    /**
     * The 1.2.0 values (FR-005).
     *
     * @return the default configuration
     */
    public static InferenceConfig defaults() {
        return InferenceConfigLoader.defaults();
    }

    /**
     * Whether this configuration equals the defaults.
     *
     * @return true when every parameter has its default value
     */
    @JsonIgnore
    public boolean isDefault() {
        return equals(defaults());
    }
}
