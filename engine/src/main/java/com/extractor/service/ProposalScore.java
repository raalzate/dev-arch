package com.extractor.service;

import com.extractor.model.DocumentMeta;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;

import java.util.List;

/**
 * Response of score_proposal (008, FR-018;
 * {@code schema/1.0.0/mcp/score_proposal.response.schema.json}).
 *
 * @param meta               contract metadata
 * @param name               suggested name
 * @param viability          Alta, Media or Baja
 * @param score              penalized score
 * @param metrics            terms of the score
 * @param components         unique sorted component ids
 * @param clusters           source cluster ids, ascending
 * @param rationale          explanation
 * @param recommendedActions recommended actions
 */
@JsonPropertyOrder({"meta", "name", "viability", "score", "metrics",
    "components", "clusters", "rationale", "recommended_actions"})
public record ProposalScore(@JsonProperty("meta") DocumentMeta meta,
        @JsonProperty("name") String name,
        @JsonProperty("viability") String viability,
        @JsonProperty("score") double score,
        @JsonProperty("metrics") Metrics metrics,
        @JsonProperty("components") List<String> components,
        @JsonProperty("clusters") List<Integer> clusters,
        @JsonProperty("rationale") List<String> rationale,
        @JsonProperty("recommended_actions")
        List<String> recommendedActions) {

    /**
     * Terms of the score.
     *
     * @param cohesionAdjusted    adjusted cohesion
     * @param externalCoupling    external coupling
     * @param dataCohesion        data cohesion
     * @param internalEdgeDensity internal edge density
     * @param size                members of the fragments
     * @param clusterCount        number of fragments
     */
    @JsonPropertyOrder({"cohesion_adjusted", "external_coupling",
        "data_cohesion", "internal_edge_density", "size", "cluster_count"})
    public record Metrics(
            @JsonProperty("cohesion_adjusted") double cohesionAdjusted,
            @JsonProperty("external_coupling") double externalCoupling,
            @JsonProperty("data_cohesion") double dataCohesion,
            @JsonProperty("internal_edge_density")
            double internalEdgeDensity,
            @JsonProperty("size") int size,
            @JsonProperty("cluster_count") int clusterCount) {
    }
}
