package com.extractor.service;

import com.extractor.model.DependencyGraph;
import com.extractor.model.SecretLocation;

import java.util.List;
import java.util.Map;

/**
 * Everything the inference reads (008, FR-001): no file-system access is
 * needed beyond this value.
 *
 * @param graph               the dependency graph
 * @param projectDependencies dependencies declared by the project
 * @param secretsLocations    redacted secret locations
 */
public record InferenceInput(DependencyGraph graph,
        Map<String, String> projectDependencies,
        List<SecretLocation> secretsLocations) {

    /**
     * Input of an extraction result.
     *
     * @param extraction the extraction result
     * @return the inference input
     */
    public static InferenceInput of(final ExtractionResult extraction) {
        return new InferenceInput(extraction.graph(),
                extraction.projectDependencies(),
                extraction.secretsLocations());
    }
}
