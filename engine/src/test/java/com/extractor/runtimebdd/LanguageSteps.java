package com.extractor.runtimebdd;

import com.extractor.mcp.McpServerMain;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import io.modelcontextprotocol.spec.McpSchema;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** TS-050, TS-051, TS-052, TS-053, TS-054 (language choice in both modes). */
public class LanguageSteps {

    private static final Map<String, List<String>> REQUIRED = Map.of(
            "analyze_project", List.of("projectPath"),
            "get_dependency_graph", List.of("projectPath"),
            "get_architecture_proposal", List.of("projectPath"),
            "get_api_contracts", List.of("projectPath"),
            "get_component_metrics", List.of("projectPath", "componentId"));

    private static final Map<String, String> MARKERS = Map.of(
            "App.csproj", "<Project Sdk=\"Microsoft.NET.Sdk\"></Project>\n",
            "pom.xml", "<project><modelVersion>4.0.0</modelVersion></project>\n");

    @Given("a copy of the demo project {string} with an extra {string} marker file")
    public void copyWithMarker(String demo, String marker) throws IOException {
        World.project = Engine.copyDemo(demo);
        assertFalse(Files.exists(World.project.resolve(marker)), marker + " already exists");
        Files.writeString(World.project.resolve(marker), MARKERS.get(marker));
    }

    @When("it is analyzed in server mode with the language {string}")
    public void serverWithLanguage(String language) {
        if (World.server == null) {
            World.server = McpServerMain.createService();
        }
        World.serverOut = Engine.newDir("server-out");
        World.result = Engine.analyze(World.server, World.project, World.serverOut, language);
    }

    @When("it is analyzed in command-line mode with the option {string}")
    public void cliWithOption(String option) {
        World.cliOut = Engine.newDir("cli-out");
        World.cli = Engine.cli(World.project, World.cliOut, option);
        assertEquals(0, World.cli.exitCode(), World.cli.stderr());
    }

    @Then("both modes produce byte-identical output documents")
    public void bothModesIdentical() {
        assertFalse(World.result.isError(), Engine.text(World.result));
        List<String> server = Engine.documents(World.serverOut);
        assertTrue(server.stream().allMatch(d -> d != null && !d.isEmpty()));
        assertEquals(server, Engine.documents(World.cliOut));
    }

    @Then("the graph declares a {string} source")
    public void graphSource(String source) throws IOException {
        String graph = Engine.documents(World.serverOut).get(0);
        String declared = new ObjectMapper().readTree(graph).path("meta").path("source").asText();
        Set<String> expected = "Java".equals(source) ? Set.of("spoon") : Set.of("roslyn", "roslyn-fallback");
        assertTrue(expected.contains(declared), "meta.source is " + declared);
    }

    @Then("the tool result is an error whose message contains {string} and {string}")
    public void errorContains(String a, String b) {
        assertTrue(World.result.isError(), Engine.text(World.result));
        assertTrue(Engine.text(World.result).contains(a), Engine.text(World.result));
        assertTrue(Engine.text(World.result).contains(b), Engine.text(World.result));
    }

    @When("the demo project {string} is analyzed in command-line mode with {string}")
    public void cliWithAndWithoutOption(String demo, String option) {
        World.project = Engine.copyDemo(demo);
        World.cliOut = Engine.newDir("cli-option");
        World.cli = Engine.cli(World.project, World.cliOut, option);
        assertEquals(0, World.cli.exitCode(), World.cli.stderr());
        World.serverOut = Engine.newDir("cli-plain");
        assertEquals(0, Engine.cli(World.project, World.serverOut, null).exitCode());
    }

    @Then("the output documents are byte-identical to those produced by the command-line mode without the option")
    public void identicalWithoutOption() {
        List<String> plain = Engine.documents(World.serverOut);
        assertTrue(plain.stream().allMatch(d -> d != null && !d.isEmpty()));
        assertEquals(plain, Engine.documents(World.cliOut));
    }

    @When("the demo project {string} is analyzed in server mode with the language {string}")
    public void demoServerWithLanguage(String demo, String language) {
        World.project = Engine.copyDemo(demo);
        if (World.server == null) {
            World.server = McpServerMain.createService();
        }
        World.serverOut = Engine.newDir("server-out");
        World.result = Engine.analyze(World.server, World.project, World.serverOut, language);
    }

    @Then("the tool result is an error whose message is {string}")
    public void errorIs(String message) {
        assertTrue(World.result.isError(), Engine.text(World.result));
        assertEquals(message, Engine.text(World.result));
    }

    @When("the demo project {string} is analyzed in command-line mode with the option {string}")
    public void demoCliWithOption(String demo, String option) {
        World.project = Engine.copyDemo(demo);
        World.cliOut = Engine.newDir("cli-out");
        World.cli = Engine.cli(World.project, World.cliOut, option);
    }

    @Then("the command exits with code {int} and its error output contains {string}")
    public void exitAndError(int code, String text) {
        assertEquals(code, World.cli.exitCode(), World.cli.stdout() + World.cli.stderr());
        assertTrue(World.cli.stderr().contains(text), World.cli.stderr());
    }

    @Then("no output document is written")
    public void noOutputs() {
        for (Path dir : List.of(World.cliOut, World.serverOut, World.project)) {
            for (String doc : Engine.DOCS) {
                assertFalse(Files.exists(dir.resolve(doc)), dir.resolve(doc) + " exists");
            }
        }
    }

    @When("the tools are listed")
    public void listTools() {
        World.tools = Engine.tools(World.server);
    }

    @Then("the tools {string}, {string}, {string}, {string} and {string} declare an optional {string} input "
            + "with values {string}, {string} and {string}")
    public void toolsDeclare(String t1, String t2, String t3, String t4, String t5, String input, String v1,
            String v2, String v3) {
        List<String> names = List.of(t1, t2, t3, t4, t5);
        assertEquals(Set.copyOf(names), Set.copyOf(World.tools.stream().map(McpSchema.Tool::name).toList()));
        for (McpSchema.Tool tool : World.tools) {
            @SuppressWarnings("unchecked")
            Map<String, Object> prop = (Map<String, Object>) tool.inputSchema().properties().get(input);
            assertNotNull(prop, tool.name() + " has no " + input);
            assertEquals(List.of(v1, v2, v3), prop.get("enum"), tool.name());
            assertFalse(tool.inputSchema().required().contains(input), tool.name());
        }
    }

    @Then("their required inputs are unchanged")
    public void requiredUnchanged() {
        for (McpSchema.Tool tool : World.tools) {
            assertEquals(REQUIRED.get(tool.name()), tool.inputSchema().required(), tool.name());
        }
    }
}
