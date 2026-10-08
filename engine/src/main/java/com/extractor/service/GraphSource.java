package com.extractor.service;

import com.extractor.model.ApiEndpoint;
import com.extractor.model.DependencyGraph;
import com.extractor.model.SchemaVersion;
import com.extractor.model.SecretLocation;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Loads a stored dependency graph by path or by analysis id (008, research
 * D6) together with the project metadata of its sibling architecture.
 */
public final class GraphSource {

    /** Environment variable / system property with the jobs directory. */
    public static final String JOBS_DIR = "STATIC_INFERENCE_JOBS_DIR";

    /** Accepted analysis ids: no separators nor path components. */
    private static final Pattern JOB_ID =
            Pattern.compile("^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$");

    /** Lenient reader (the deprecated {@code interface} duplicate). */
    private static final ObjectMapper MAPPER = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES,
                    false);

    /** Suffix of a graph document. */
    private static final String JSON = ".json";

    private GraphSource() {
    }

    /**
     * Jobs directory configured for the server, or null.
     *
     * @return the directory or null
     */
    public static Path configuredJobsDir() {
        String value = System.getProperty(JOBS_DIR);
        if (value == null || value.isBlank()) {
            value = System.getenv(JOBS_DIR);
        }
        return value == null || value.isBlank() ? null : Path.of(value);
    }

    /**
     * Graph of a web analysis: {@code <jobsDir>/<id>/out/output.json}.
     *
     * @param jobId   analysis id
     * @param jobsDir jobs directory, null when not configured
     * @return the loaded graph
     */
    public static LoadedGraph fromJob(final String jobId,
            final Path jobsDir) {
        if (jobsDir == null) {
            throw new IllegalArgumentException("jobId requires " + JOBS_DIR
                    + "; pass graphPath instead");
        }
        if (jobId == null || !JOB_ID.matcher(jobId).matches()) {
            throw new IllegalArgumentException("Invalid jobId '" + jobId
                    + "'");
        }
        Path graph = jobsDir.resolve(jobId).resolve("out")
                .resolve("output.json");
        try {
            Path realJobs = jobsDir.toRealPath();
            if (!Files.isRegularFile(graph)
                    || !graph.toRealPath().startsWith(realJobs)) {
                throw new IllegalArgumentException("Analysis '" + jobId
                        + "' has no dependency graph");
            }
        } catch (IOException e) {
            throw new IllegalArgumentException("Analysis '" + jobId
                    + "' has no dependency graph");
        }
        return fromPath(graph);
    }

    /**
     * Graph stored at a path.
     *
     * @param graphPath the graph document
     * @return the loaded graph
     */
    public static LoadedGraph fromPath(final Path graphPath) {
        String name = graphPath.toString();
        if (!Files.exists(graphPath)) {
            throw new IllegalArgumentException("Graph file '" + name
                    + "' does not exist");
        }
        JsonNode tree;
        try {
            tree = MAPPER.readTree(graphPath.toFile());
        } catch (IOException e) {
            throw notAGraph(name, e.getMessage());
        }
        if (tree == null || !tree.isObject()
                || !tree.path("components").isArray()) {
            throw notAGraph(name, "no components array");
        }
        String version = tree.path("meta").path("schema_version").asText(null);
        if (!SchemaVersion.CURRENT.equals(version)) {
            throw new IllegalArgumentException("Graph file '" + name
                    + "' declares schema_version '" + version
                    + "'; supported: " + SchemaVersion.CURRENT);
        }
        DependencyGraph graph = toGraph((ObjectNode) tree, name);
        List<String> warnings = new ArrayList<>();
        Map<String, String> dependencies = new LinkedHashMap<>();
        List<SecretLocation> secrets = new ArrayList<>();
        Path sibling = sibling(graphPath);
        if (!readProjectMetadata(sibling, dependencies, secrets)) {
            warnings.add("Project metadata not found next to the graph ('"
                    + (sibling == null ? "-" : sibling.getFileName())
                    + "'): external_dependencies limited to component"
                    + " dependencies and secrets_locations omitted");
        }
        return new LoadedGraph(graph, dependencies, secrets, warnings,
                graphPath);
    }

    /**
     * Converts the tree; only the endpoints of the API contracts are kept
     * (the inference reads nothing else from them).
     *
     * @param tree graph tree
     * @param name file name for messages
     * @return the graph
     */
    private static DependencyGraph toGraph(final ObjectNode tree,
            final String name) {
        ObjectNode copy = tree.deepCopy();
        JsonNode endpoints = copy.path("api_contracts").path("endpoints");
        copy.remove("api_contracts");
        try {
            DependencyGraph graph = MAPPER.treeToValue(copy,
                    DependencyGraph.class);
            if (graph.getEdges() == null) {
                graph.setEdges(new ArrayList<>());
            }
            DependencyGraph.ApiContracts contracts =
                    new DependencyGraph.ApiContracts();
            if (endpoints.isArray()) {
                contracts.setEndpoints(MAPPER.convertValue(endpoints,
                        new TypeReference<List<ApiEndpoint>>() { }));
            }
            graph.setApiContracts(contracts);
            return graph;
        } catch (JsonProcessingException | IllegalArgumentException e) {
            throw notAGraph(name, e.getMessage());
        }
    }

    /**
     * Reads the project metadata of the sibling architecture.
     *
     * @param sibling      architecture document, may be null
     * @param dependencies receives the external dependencies
     * @param secrets      receives the secret locations
     * @return false when the document is missing or unusable
     */
    private static boolean readProjectMetadata(final Path sibling,
            final Map<String, String> dependencies,
            final List<SecretLocation> secrets) {
        if (sibling == null || !Files.isRegularFile(sibling)) {
            return false;
        }
        try {
            JsonNode metadata = MAPPER.readTree(sibling.toFile())
                    .path("project_metadata");
            if (!metadata.isObject()) {
                return false;
            }
            dependencies.putAll(MAPPER.convertValue(
                    metadata.path("external_dependencies"),
                    new TypeReference<Map<String, String>>() { }));
            JsonNode locations = metadata.path("secrets_locations");
            if (locations.isArray()) {
                secrets.addAll(MAPPER.convertValue(locations,
                        new TypeReference<List<SecretLocation>>() { }));
            }
            return true;
        } catch (IOException | IllegalArgumentException e) {
            dependencies.clear();
            secrets.clear();
            return false;
        }
    }

    /**
     * Architecture written next to a graph by the same analysis.
     *
     * @param graphPath the graph document
     * @return {@code <name>_architecture.json}, or null
     */
    static Path sibling(final Path graphPath) {
        Path file = graphPath.getFileName();
        if (file == null || !file.toString().endsWith(JSON)) {
            return null;
        }
        String base = file.toString();
        base = base.substring(0, base.length() - JSON.length());
        return graphPath.resolveSibling(base + "_architecture" + JSON);
    }

    /**
     * Error of a file that is not a dependency graph.
     *
     * @param name   file name
     * @param detail reason
     * @return the exception
     */
    private static IllegalArgumentException notAGraph(final String name,
            final String detail) {
        String first = detail == null ? "unreadable" : detail.split("\n")[0];
        return new IllegalArgumentException("Graph file '" + name
                + "' is not a dependency graph: " + first);
    }
}
