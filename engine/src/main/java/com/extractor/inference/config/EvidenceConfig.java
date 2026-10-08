package com.extractor.inference.config;

import java.util.List;

/**
 * Inter-cluster evidence parameters ({@code InterClusterGraph}).
 *
 * @param weights                weights of the four signals
 * @param edgeThreshold          evidence score above which an edge exists
 * @param callDensitySaturation  share of the internal calls that saturates
 *                               the call density
 * @param strongSignals          thresholds of the strong signals
 * @param evidenceThreshold      minimum evidence score of a merge candidate
 * @param minStrongSignals       minimum strong signals of a merge candidate
 * @param roleKeywords           role words that enable token extraction
 *                               (iteration order preserved)
 * @param excludeTokens          tokens ignored by the token similarity
 * @param minPackageTokenLength  minimum length of a package token
 * @param eventPublisherKeywords words of publisher components
 * @param eventConsumerKeywords  words of consumer components
 */
public record EvidenceConfig(Weights weights, double edgeThreshold,
        double callDensitySaturation, StrongSignals strongSignals,
        double evidenceThreshold, int minStrongSignals,
        List<String> roleKeywords, List<String> excludeTokens,
        int minPackageTokenLength, List<String> eventPublisherKeywords,
        List<String> eventConsumerKeywords) {

    /**
     * Immutable copies of the lists.
     *
     * @param weights                weights of the four signals
     * @param edgeThreshold          edge threshold
     * @param callDensitySaturation  call density saturation
     * @param strongSignals          strong signal thresholds
     * @param evidenceThreshold      evidence threshold
     * @param minStrongSignals       minimum strong signals
     * @param roleKeywords           role words
     * @param excludeTokens          excluded tokens
     * @param minPackageTokenLength  minimum package token length
     * @param eventPublisherKeywords publisher words
     * @param eventConsumerKeywords  consumer words
     */
    public EvidenceConfig {
        roleKeywords = List.copyOf(roleKeywords);
        excludeTokens = List.copyOf(excludeTokens);
        eventPublisherKeywords = List.copyOf(eventPublisherKeywords);
        eventConsumerKeywords = List.copyOf(eventConsumerKeywords);
    }

    /**
     * Weights of the evidence score.
     *
     * @param table weight of the table Jaccard
     * @param call  weight of the call density
     * @param token weight of the token similarity
     * @param event weight of the (binary) event links
     */
    public record Weights(double table, double call, double token,
            double event) {
    }

    /**
     * Thresholds above which a signal counts as strong.
     *
     * @param table table Jaccard threshold
     * @param call  call density threshold
     * @param token token similarity threshold
     */
    public record StrongSignals(double table, double call, double token) {
    }
}
