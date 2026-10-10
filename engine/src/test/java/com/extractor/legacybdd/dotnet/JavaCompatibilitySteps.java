package com.extractor.legacybdd.dotnet;

import com.extractor.mcp.McpCalls;
import com.extractor.mcp.McpServerMain;
import com.extractor.schema.DemoOutputs;
import com.extractor.service.AnalysisCache;
import com.extractor.service.AnalysisService;
import com.extractor.testsupport.RegressionBaselines;
import com.fasterxml.jackson.databind.JsonNode;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Steps of {@code java-backward-compatibility.feature} (US-005). The previous version is the stored regression
 * baseline {@code src/test/resources/baseline-v1.2.0/java-standar} (the most recent stored reference of the
 * engine; the 1.1.0 baseline predates the deliberate contract evolution of 005).
 */
public class JavaCompatibilitySteps {

    private static final String JAVA_PROJECT = "java-standar";
    private static final List<String> TOOLS = List.of("analyze_project", "get_dependency_graph",
            "get_architecture_proposal", "get_component_metrics", "get_api_contracts");

    @Given("an existing Java project that was analyzed with the previous version")
    public void anExistingJavaProjectAnalyzedWithThePreviousVersion() {
        for (String document : RegressionBaselines.DOCUMENTS) {
            Path stored = RegressionBaselines.dir(JAVA_PROJECT).resolve(document);
            assertTrue(Files.isRegularFile(stored), "stored reference missing: " + stored);
        }
        LegacyWorld.project = LegacyDotnet.demo(JAVA_PROJECT);
    }

    // ---------------------------------------------------------------- TS-041

    @Given("the Java project analysis result from the previous version is stored")
    public void theJavaProjectAnalysisResultIsStored() {
        Map<String, String> baseline = RegressionBaselines.load(JAVA_PROJECT);
        assertFalse(LegacyDotnet.json(baseline.get(DemoOutputs.GRAPH)).path("components").isEmpty(),
                "stored reference has no components");
        LegacyWorld.data.put("baseline", baseline);
    }

    @When("the same Java project is analyzed with the new version that includes .NET support")
    public void theSameJavaProjectIsAnalyzedWithTheNewVersion() {
        LegacyWorld.run = LegacyDotnet.analyzeFresh(LegacyWorld.project);
    }

    @Then("the result is identical to the stored reference result")
    public void theResultIsIdenticalToTheStoredReference() {
        Map<String, String> baseline = LegacyWorld.get("baseline");
        assertEquals(baseline.get(DemoOutputs.GRAPH), LegacyWorld.run.graphJson(), DemoOutputs.GRAPH);
        assertEquals(baseline.get(DemoOutputs.ARCHITECTURE), LegacyWorld.run.architectureJson(),
                DemoOutputs.ARCHITECTURE);
        assertEquals(baseline.get(DemoOutputs.ENTRYPOINTS), LegacyWorld.run.entrypointsJson(),
                DemoOutputs.ENTRYPOINTS);
    }

    // ---------------------------------------------------------------- TS-042

    @Given("the CLI is invoked with the existing Java arguments")
    public void theCliIsInvokedWithTheExistingJavaArguments() {
        Path out = LegacyDotnet.scratch("cli-java");
        LegacyWorld.data.put("cliOut", out);
        LegacyWorld.data.put("cliArgs", List.of(LegacyWorld.project.toString(),
                out.resolve(DemoOutputs.GRAPH).toString()));
    }

    @When("executed with the new version")
    public void executedWithTheNewVersion() {
        List<String> args = LegacyWorld.get("cliArgs");
        LegacyWorld.data.put("cliRun", LegacyDotnet.cli(LegacyDotnet.scratch("cli-java-work"), Map.of(), args));
    }

    @Then("the CLI behavior is identical to the current version")
    public void theCliBehaviorIsIdentical() {
        LegacyDotnet.ChildRun run = LegacyWorld.get("cliRun");
        assertEquals(0, run.exitCode(), "CLI exit code; stderr:\n" + LegacyDotnet.abbreviate(run.stderr()));
        Path out = LegacyWorld.get("cliOut");
        Map<String, String> baseline = RegressionBaselines.load(JAVA_PROJECT);
        for (String document : RegressionBaselines.DOCUMENTS) {
            Path written = out.resolve(document);
            assertTrue(Files.isRegularFile(written), "CLI did not write " + written);
            assertEquals(baseline.get(document), LegacyDotnet.read(written), document + " written by the CLI");
        }
        int components = LegacyDotnet.json(baseline.get(DemoOutputs.GRAPH)).path("components").size();
        assertTrue(run.stdout().contains("Componentes encontrados: " + components),
                "CLI summary must report " + components + " components:\n" + LegacyDotnet.abbreviate(run.stdout()));
    }

    @Then("no new required arguments are introduced")
    public void noNewRequiredArgumentsAreIntroduced() {
        List<String> args = LegacyWorld.get("cliArgs");
        assertEquals(2, args.size(), "the legacy invocation uses exactly <project> <output>");
        LegacyDotnet.ChildRun usage = LegacyDotnet.cli(LegacyDotnet.scratch("cli-usage"), Map.of(),
                List.of(LegacyWorld.project.toString()));
        assertNotEquals(0, usage.exitCode(), "an incomplete invocation must be rejected with the usage");
        String usageLine = usage.stderr().lines().filter(l -> l.startsWith("Uso: ")).findFirst()
                .orElseThrow(() -> new AssertionError("usage line missing:\n" + usage.stderr()));
        Matcher placeholders = Pattern.compile("<[^>]+>").matcher(usageLine);
        int required = 0;
        while (placeholders.find()) {
            required++;
        }
        assertEquals(2, required, "required arguments of the usage line: " + usageLine);
    }

    // ---------------------------------------------------------------- TS-043

    @Given("the {int} MCP tools are invoked over a Java project")
    public void theMcpToolsAreInvokedOverAJavaProject(int count) {
        assertEquals(count, TOOLS.size());
        AnalysisService service = new AnalysisService(new AnalysisCache(4));
        List<String> registered = McpServerMain.createToolSpecs(service, false, null).stream()
                .map(spec -> spec.tool().name()).toList();
        assertTrue(registered.containsAll(TOOLS), "registered tools " + registered);
        LegacyWorld.data.put("mcpCalls", new McpCalls(service));
    }

    @When("used with the new version that includes .NET support")
    public void usedWithTheNewVersion() {
        McpCalls calls = LegacyWorld.get("mcpCalls");
        String project = LegacyWorld.project.toString();
        Path outDir = LegacyDotnet.scratch("mcp-java");
        String componentId = LegacyDotnet.json(RegressionBaselines.load(JAVA_PROJECT).get(DemoOutputs.GRAPH))
                .path("components").path(0).path("id").asText();
        Map<String, McpCalls.Response> responses = new LinkedHashMap<>();
        responses.put("analyze_project", calls.call("analyze_project",
                Map.of("projectPath", project, "outputDir", outDir.toString())));
        responses.put("get_dependency_graph", calls.call("get_dependency_graph", Map.of("projectPath", project)));
        responses.put("get_architecture_proposal",
                calls.call("get_architecture_proposal", Map.of("projectPath", project)));
        responses.put("get_component_metrics", calls.call("get_component_metrics",
                Map.of("projectPath", project, "componentId", componentId)));
        responses.put("get_api_contracts", calls.call("get_api_contracts", Map.of("projectPath", project)));
        for (Map.Entry<String, McpCalls.Response> entry : responses.entrySet()) {
            assertFalse(entry.getValue().error(), entry.getKey() + " failed: " + entry.getValue().text());
        }
        LegacyWorld.data.put("javaResponses", responses);
        LegacyWorld.data.put("javaOutDir", outDir);
        LegacyWorld.data.put("javaComponentId", componentId);
    }

    @Then("each tool response is identical to the response from the previous version")
    public void eachToolResponseIsIdentical() {
        Map<String, McpCalls.Response> responses = LegacyWorld.get("javaResponses");
        Map<String, String> baseline = RegressionBaselines.load(JAVA_PROJECT);
        JsonNode graph = LegacyDotnet.json(baseline.get(DemoOutputs.GRAPH));
        JsonNode architecture = LegacyDotnet.json(baseline.get(DemoOutputs.ARCHITECTURE));
        JsonNode entrypoints = LegacyDotnet.json(baseline.get(DemoOutputs.ENTRYPOINTS));

        assertEquals(graph, json(responses, "get_dependency_graph"), "get_dependency_graph");
        assertEquals(architecture, json(responses, "get_architecture_proposal"), "get_architecture_proposal");
        assertEquals(entrypoints, json(responses, "get_api_contracts"), "get_api_contracts");

        String componentId = LegacyWorld.get("javaComponentId");
        JsonNode storedComponent = null;
        for (JsonNode component : graph.path("components")) {
            if (componentId.equals(component.path("id").asText())) {
                storedComponent = component;
            }
        }
        assertEquals(storedComponent, json(responses, "get_component_metrics"), "get_component_metrics");

        Path outDir = LegacyWorld.get("javaOutDir");
        for (String document : RegressionBaselines.DOCUMENTS) {
            assertEquals(baseline.get(document), LegacyDotnet.read(outDir.resolve(document)),
                    document + " written by analyze_project");
        }
        JsonNode summary = json(responses, "analyze_project");
        assertEquals(graph.path("components").size(), summary.path("componentCount").asInt(), "componentCount");
        assertEquals(graph.path("edges").size(), summary.path("edgeCount").asInt(), "edgeCount");
        assertEquals(architecture.path("proposals").size(), summary.path("proposalCount").asInt(), "proposalCount");
        assertEquals(entrypoints.path("endpoints").size(), summary.path("endpointCount").asInt(), "endpointCount");
        assertEquals(architecture.path("summary"), summary.path("summary"), "summary");
    }

    private static JsonNode json(Map<String, McpCalls.Response> responses, String tool) {
        return LegacyDotnet.json(responses.get(tool).text());
    }
}
