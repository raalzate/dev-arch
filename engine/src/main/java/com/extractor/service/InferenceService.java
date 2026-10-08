package com.extractor.service;

import com.extractor.inference.ConsolidatedArchitecture;
import com.extractor.inference.InferenceEngine;
import com.extractor.inference.MicroserviceCandidates;
import com.extractor.inference.MicroserviceRecommendationEngine;
import com.extractor.inference.config.InferenceConfig;
import com.extractor.model.ApiEndpoint;
import com.extractor.model.DependencyGraph;

import java.util.List;

/**
 * Inference stage (008, FR-001): clustering, consolidation, naming and
 * viability over an already extracted graph. Pure: it never reads the file
 * system, so it can run on a stored graph.
 */
public final class InferenceService {

    /**
     * Infers the consolidated architecture.
     *
     * @param input  graph and project-level data
     * @param config inference configuration
     * @return the consolidated architecture
     */
    public ConsolidatedArchitecture infer(final InferenceInput input,
            final InferenceConfig config) {
        DependencyGraph graph = input.graph();
        MicroserviceCandidates candidates =
                new InferenceEngine(config).analyze(graph);
        return new MicroserviceRecommendationEngine(config).assemble(
                candidates, graph.getComponents(),
                input.projectDependencies(), input.secretsLocations(),
                endpoints(graph));
    }

    /**
     * Endpoints of the graph (none when the graph has no API contracts).
     *
     * @param graph the graph
     * @return the endpoints
     */
    static List<ApiEndpoint> endpoints(final DependencyGraph graph) {
        if (graph.getApiContracts() == null
                || graph.getApiContracts().getEndpoints() == null) {
            return List.of();
        }
        return graph.getApiContracts().getEndpoints();
    }
}
