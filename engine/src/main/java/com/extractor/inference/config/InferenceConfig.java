package com.extractor.inference.config;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.databind.JsonNode;

import java.util.Objects;

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
 * @param dataAccess     data access (020)
 * @param debt           legacy debt rules (021)
 * @param integrations   outbound integrations (022)
 * @param dependencies   external dependencies (022)
 * @param inference      inference-wide parameters and preset (023)
 * @param analysis       extended static analysis of the .NET analyzer (024)
 * @param overrides      the user's explicit configuration tree (never serialized;
 *                       null when the configuration is the defaults), kept so a
 *                       preset can be layered beneath it (023, FR-002)
 */
public record InferenceConfig(DetectionConfig detection,
        ClusteringConfig clustering, EvidenceConfig evidence,
        ConsolidationConfig consolidation, ViabilityConfig viability,
        RecommendationConfig recommendation, NamingConfig naming,
        DataAccessConfig dataAccess, DebtConfig debt,
        IntegrationsConfig integrations, DependenciesConfig dependencies,
        InferenceSection inference, AnalysisConfig analysis,
        @JsonIgnore JsonNode overrides) {

    /**
     * The same configuration remembering the explicit user tree.
     *
     * @param tree the user's partial configuration
     * @return a copy with {@code overrides = tree}
     */
    public InferenceConfig withOverrides(final JsonNode tree) {
        return new InferenceConfig(detection, clustering, evidence, consolidation,
                viability, recommendation, naming, dataAccess, debt, integrations,
                dependencies, inference, analysis, tree);
    }

    /** Equality ignores {@code overrides}: two configurations with the same values are equal. */
    @Override
    public boolean equals(final Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof InferenceConfig other)) {
            return false;
        }
        return Objects.equals(detection, other.detection)
                && Objects.equals(clustering, other.clustering)
                && Objects.equals(evidence, other.evidence)
                && Objects.equals(consolidation, other.consolidation)
                && Objects.equals(viability, other.viability)
                && Objects.equals(recommendation, other.recommendation)
                && Objects.equals(naming, other.naming)
                && Objects.equals(dataAccess, other.dataAccess)
                && Objects.equals(debt, other.debt)
                && Objects.equals(integrations, other.integrations)
                && Objects.equals(dependencies, other.dependencies)
                && Objects.equals(inference, other.inference)
                && Objects.equals(analysis, other.analysis);
    }

    @Override
    public int hashCode() {
        return Objects.hash(detection, clustering, evidence, consolidation, viability,
                recommendation, naming, dataAccess, debt, integrations, dependencies,
                inference, analysis);
    }

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
