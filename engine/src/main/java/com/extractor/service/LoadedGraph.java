package com.extractor.service;

import com.extractor.model.DependencyGraph;
import com.extractor.model.SecretLocation;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;

/**
 * A stored dependency graph ready to be re-inferred (008, FR-012..FR-016).
 *
 * @param graph               the dependency graph
 * @param projectDependencies dependencies from the sibling architecture
 * @param secretsLocations    secret locations from the sibling architecture
 * @param warnings            missing project metadata, if any
 * @param source              the graph file
 */
public record LoadedGraph(DependencyGraph graph,
        Map<String, String> projectDependencies,
        List<SecretLocation> secretsLocations, List<String> warnings,
        Path source) {

    /**
     * Inference input of the stored graph.
     *
     * @return the input
     */
    public InferenceInput input() {
        return new InferenceInput(graph, projectDependencies,
                secretsLocations);
    }
}
