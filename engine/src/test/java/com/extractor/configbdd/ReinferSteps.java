package com.extractor.configbdd;

import com.extractor.schema.DemoOutputs;
import com.extractor.schema.SchemaRegistry;
import com.extractor.testsupport.RegressionBaselines;
import com.extractor.testsupport.SyntheticGraph;
import com.fasterxml.jackson.databind.JsonNode;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Steps of reinfer.feature (US1, TS-014..TS-022) and shared re-inference steps. */
public class ReinferSteps {

    private String jobGraphResponse;

    @Given("the server mode with the inference tools enabled")
    public void inferenceTools() {
        World.inferenceTools = true;
    }

    @Given("the stored analysis of the demo project {string} in a folder without its sources")
    public void storedAnalysis(String project) {
        Support.store(project, true);
    }

    @Given("the stored graph of the demo project {string} alone in a folder")
    public void storedGraphAlone(String project) {
        Support.store(project, false);
    }

    @When("reinfer_architecture is called with the graphPath of that analysis and no configuration")
    public void reinferDefault() {
        ok(Support.reinfer(World.graphPath, null, null));
    }

    @When("^reinfer_architecture is called with the graphPath of that analysis and the configuration (\\{.*\\})$")
    public void reinferWith(String config) {
        ok(Support.reinfer(World.graphPath, config, null));
    }

    @When("^reinfer_architecture is called twice with the graphPath of that analysis and the configuration (\\{.*\\})$")
    public void reinferTwice(String config) {
        ok(Support.reinfer(World.graphPath, config, null));
        ok(Support.reinfer(World.graphPath, config, null));
    }

    @When("reinfer_architecture is called with the graphPath of that analysis and minViability {string}")
    public void reinferMin(String min) {
        Support.reinfer(World.graphPath, null, min);
    }

    @When("reinfer_architecture is called with the graphPath {string}")
    public void reinferPath(String path) {
        Support.reinfer(Path.of(path), null, null);
    }

    @When("reinfer_architecture is called with the graphPath of that file")
    public void reinferFile() {
        Support.reinfer(World.graphPath, null, null);
    }

    @When("reinfer_architecture is called with jobId {string}")
    public void reinferJob(String job) {
        Support.call("reinfer_architecture", new HashMap<>(Map.of("jobId", job)));
    }

    @When("reinfer_architecture is called with jobId {string} and no configuration")
    public void reinferJobDefault(String job) {
        ok(Support.call("reinfer_architecture", new HashMap<>(Map.of("jobId", job))));
        jobGraphResponse = Support.text(World.result);
    }

    @When("reinfer_architecture is called with neither graphPath nor jobId")
    public void reinferNothing() {
        Support.call("reinfer_architecture", new HashMap<>());
    }

    private static void ok(io.modelcontextprotocol.spec.McpSchema.CallToolResult r) {
        assertFalse(Support.isError(r), Support.text(r));
    }

    @Then("the response is byte-identical to the stored {string}")
    public void identicalToStored(String name) {
        assertEquals(DemoOutputs.ARCHITECTURE, name);
        assertEquals(World.storedArchitecture, Support.text(World.result));
    }

    @Then("the response has no warnings")
    public void noWarnings() {
        assertEquals(List.of(), Support.warnings(World.result));
    }

    @Then("no proposal has viability {string} or {string}")
    public void noProposalWith(String a, String b) {
        Support.json(Support.text(World.result)).path("proposals").forEach(p -> {
            assertFalse(p.path("viability").asText().equals(a) || p.path("viability").asText().equals(b));
        });
    }

    @Then("the response validates against the reinfer_architecture response schema")
    public void validatesReinfer() {
        assertEquals(List.of(), SchemaRegistry.get().validate("mcp/reinfer_architecture.response",
                Support.text(World.result)));
    }

    private static int groups(String architecture) {
        JsonNode a = Support.json(architecture);
        return a.path("proposals").size() + a.path("support_libraries").size();
    }

    @Then("the number of proposals plus support libraries is at least that of the stored architecture")
    public void atLeastAsManyGroups() {
        assertTrue(groups(Support.text(World.result)) >= groups(World.storedArchitecture));
    }

    @Then("there is at least one proposal")
    public void atLeastOne() {
        assertTrue(Support.json(Support.text(World.result)).path("proposals").size() > 0);
    }

    @Given("a deterministic synthetic dependency graph of {int} components stored on disk")
    public void synthetic(int components) {
        World.graphPath = SyntheticGraph.write(World.tmp.resolve("synthetic"));
        assertEquals(components, SyntheticGraph.build().getComponents().size());
        World.inferenceTools = true;
    }

    @Given("reinfer_architecture has been called once on it")
    public void warmUp() {
        ok(Support.reinfer(World.graphPath, null, null));
    }

    @When("reinfer_architecture is called {int} more times on it with no configuration")
    public void timed(int times) {
        World.results.clear();
        for (int i = 0; i < times; i++) {
            long start = System.nanoTime();
            ok(Support.reinfer(World.graphPath, null, null));
            World.durations.add(System.nanoTime() - start);
        }
        System.out.println("[008] reinfer_architecture 500 components (ms): "
                + World.durations.stream().map(d -> String.format("%.1f", d / 1e6)).toList());
    }

    @Then("each of the {int} calls answers in less than {int} seconds")
    public void eachFaster(int calls, int seconds) {
        assertEquals(calls, World.durations.size());
        World.durations.forEach(d -> assertTrue(d < seconds * 1_000_000_000L, d / 1e6 + " ms"));
    }

    @Then("the {int} responses are byte-identical")
    public void allIdentical(int n) {
        assertEquals(n, World.results.size());
        String first = Support.text(World.results.get(0));
        World.results.forEach(r -> assertEquals(first, Support.text(r)));
    }

    @Given("a jobs directory containing the stored analysis of the demo project {string} as job {string}")
    public void jobsDirectory(String project, String job) throws Exception {
        Path graph = Support.store(project, true);
        Path out = Files.createDirectories(World.tmp.resolve("jobs").resolve(job).resolve("out"));
        Files.copy(graph, out.resolve(DemoOutputs.GRAPH));
        Files.copy(graph.resolveSibling(DemoOutputs.ARCHITECTURE), out.resolve(DemoOutputs.ARCHITECTURE));
        World.value = out.resolve(DemoOutputs.GRAPH);
    }

    @Given("the server mode is started with that jobs directory")
    public void startedWithJobs() {
        World.jobsDir = World.tmp.resolve("jobs");
        World.inferenceTools = true;
    }

    @Then("the response is byte-identical to the response for the graphPath of that job")
    public void sameAsGraphPath() {
        ok(Support.reinfer((Path) World.value, null, null));
        assertEquals(Support.text(World.result), jobGraphResponse);
    }

    @Then("the response is an architecture document whose project metadata has no secrets locations")
    public void noSecrets() {
        JsonNode a = Support.json(Support.text(World.result));
        assertTrue(a.path("proposals").isArray());
        assertEquals(0, a.path("project_metadata").path("secrets_locations").size());
        assertEquals(List.of(), SchemaRegistry.get().validate("architecture", Support.text(World.result)));
    }

    @Then("the response warnings contain {string}")
    public void warningsContain(String text) {
        assertTrue(Support.warnings(World.result).stream().anyMatch(w -> w.contains(text)),
                String.valueOf(Support.warnings(World.result)));
    }

    @Given("no graph file")
    public void noGraphFile() {
        // nothing on disk
    }

    @Given("a file that is not a dependency graph")
    public void notAGraph() throws Exception {
        World.graphPath = Files.writeString(World.tmp.resolve("not-a-graph.json"), "{\"a\": 1}");
    }

    @Given("a dependency graph declaring schema_version {string}")
    public void otherVersion(String version) throws Exception {
        String graph = RegressionBaselines.load("legacy-erp").get(DemoOutputs.GRAPH)
                .replace("\"schema_version\" : \"1.0.0\"", "\"schema_version\" : \"" + version + "\"");
        World.graphPath = Files.writeString(World.tmp.resolve("other.json"), graph, StandardCharsets.UTF_8);
    }

    @Given("the server mode is started without a jobs directory")
    public void noJobsDir() {
        World.jobsDir = null;
    }

    @Given("an empty jobs directory configured for the server mode")
    public void emptyJobsDir() throws Exception {
        World.jobsDir = Files.createDirectories(World.tmp.resolve("empty-jobs"));
    }

    @Then("both responses are byte-identical")
    public void bothIdentical() {
        int n = World.results.size();
        assertEquals(Support.text(World.results.get(n - 2)), Support.text(World.results.get(n - 1)));
        assertFalse(Support.isError(World.results.get(n - 1)));
    }

    static List<String> proposalClusters(String architecture) {
        List<String> out = new ArrayList<>();
        Support.json(architecture).path("proposals").forEach(p -> out.add(p.path("clusters").toString()));
        return out;
    }
}
