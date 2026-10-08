package com.extractor.service;

import com.extractor.model.DependencyGraph;
import com.extractor.model.SecretLocation;

import java.util.List;
import java.util.Map;

/**
 * Output of the extraction stage (008, FR-001, FR-003): the dependency graph
 * plus the project-level data the inference needs and the graph does not
 * hold.
 *
 * @param graph               the dependency graph
 * @param projectDependencies dependencies declared by the build files
 * @param secretsLocations    redacted secret locations of the project
 * @param warnings            what was skipped or degraded
 */
public record ExtractionResult(DependencyGraph graph,
        Map<String, String> projectDependencies,
        List<SecretLocation> secretsLocations, List<String> warnings) {
}
