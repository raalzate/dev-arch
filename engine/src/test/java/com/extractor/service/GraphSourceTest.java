package com.extractor.service;

import com.extractor.inference.config.InferenceConfig;
import com.extractor.schema.DemoOutputs;
import com.extractor.testsupport.RegressionBaselines;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 008 FR-013..FR-016, SC-002: stored graphs re-infer to the stored architecture. */
class GraphSourceTest {

    @TempDir
    Path tmp;

    static List<String> projects() {
        return RegressionBaselines.PROJECTS;
    }

    private Path store(String project, boolean withArchitecture) throws Exception {
        Map<String, String> docs = RegressionBaselines.load(project);
        Path dir = Files.createDirectories(tmp.resolve(project));
        Files.writeString(dir.resolve(DemoOutputs.GRAPH), docs.get(DemoOutputs.GRAPH));
        if (withArchitecture) {
            Files.writeString(dir.resolve(DemoOutputs.ARCHITECTURE), docs.get(DemoOutputs.ARCHITECTURE));
        }
        return dir.resolve(DemoOutputs.GRAPH);
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("projects")
    void storedGraphReinfersToTheStoredArchitecture(String project) throws Exception {
        LoadedGraph loaded = GraphSource.fromPath(store(project, true));
        assertEquals(List.of(), loaded.warnings());
        String architecture = DemoOutputs.cliMapper().writeValueAsString(
                new InferenceService().infer(loaded.input(), InferenceConfig.defaults()));
        assertEquals(RegressionBaselines.load(project).get(DemoOutputs.ARCHITECTURE), architecture);
    }

    @Test
    void missingSiblingArchitectureIsAWarning() throws Exception {
        LoadedGraph loaded = GraphSource.fromPath(store("java-standar", false));
        assertTrue(loaded.warnings().get(0).startsWith("Project metadata not found next to the graph"));
        assertTrue(loaded.secretsLocations().isEmpty());
    }

    @Test
    void unusableReferences() throws Exception {
        assertEquals("Graph file '/nonexistent/output.json' does not exist", assertThrows(
                IllegalArgumentException.class, () -> GraphSource.fromPath(Path.of("/nonexistent/output.json")))
                .getMessage());
        Path notGraph = Files.writeString(tmp.resolve("x.json"), "{\"a\":1}");
        assertTrue(assertThrows(IllegalArgumentException.class, () -> GraphSource.fromPath(notGraph))
                .getMessage().contains("is not a dependency graph"));
        Path other = Files.writeString(tmp.resolve("v.json"), Files.readString(store("legacy-erp", false))
                .replace("\"schema_version\" : \"1.0.0\"", "\"schema_version\" : \"9.9.9\""));
        assertTrue(assertThrows(IllegalArgumentException.class, () -> GraphSource.fromPath(other))
                .getMessage().endsWith("declares schema_version '9.9.9'; supported: 1.0.0"));
        assertEquals("jobId requires STATIC_INFERENCE_JOBS_DIR; pass graphPath instead",
                assertThrows(IllegalArgumentException.class, () -> GraphSource.fromJob("a", null)).getMessage());
        assertEquals("Invalid jobId '../etc'",
                assertThrows(IllegalArgumentException.class, () -> GraphSource.fromJob("../etc", tmp)).getMessage());
        assertEquals("Analysis 'job-404' has no dependency graph",
                assertThrows(IllegalArgumentException.class, () -> GraphSource.fromJob("job-404", tmp)).getMessage());
    }

    @Test
    void jobIdResolvesInsideTheJobsDirectory() throws Exception {
        Path graph = store("java-standar", true);
        Path out = Files.createDirectories(tmp.resolve("jobs/job-0001/out"));
        Files.copy(graph, out.resolve("output.json"));
        Files.copy(graph.resolveSibling(DemoOutputs.ARCHITECTURE), out.resolve(DemoOutputs.ARCHITECTURE));
        assertEquals(List.of(), GraphSource.fromJob("job-0001", tmp.resolve("jobs")).warnings());
    }
}
