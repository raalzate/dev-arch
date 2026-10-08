package com.extractor.runtimebdd;

import com.extractor.mcp.McpServerMain;
import com.extractor.schema.SchemaRegistry;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** TS-059, TS-061 (warnings exposed in both modes without changing the outputs). */
public class WarningsSteps {

    @Given("a copy of the demo project {string} with a Java source file that cannot be parsed")
    public void copyWithBrokenFile(String demo) throws IOException {
        World.project = Engine.copyDemo(demo);
        Path dir;
        try (Stream<Path> walk = Files.walk(World.project)) {
            dir = walk.filter(p -> p.toString().endsWith(".java") && p.toString().contains("src/main"))
                    .sorted().findFirst().orElseThrow().getParent();
        }
        Path broken = dir.resolve("BrokenByScenario.java");
        Files.writeString(broken, "package broken;\npublic class BrokenByScenario { void x( { int = ; }\n");
        World.brokenFile = World.project.relativize(broken).toString().replace('\\', '/');
    }

    @Given("an empty project folder containing only a {string} file")
    public void emptyProject(String file) throws IOException {
        World.project = Engine.newDir("empty");
        Files.writeString(World.project.resolve(file), "# nothing to analyze\n");
    }

    @When("it is analyzed in server mode")
    public void serverMode() {
        if (World.server == null) {
            World.server = McpServerMain.createService();
        }
        World.serverOut = Engine.newDir("server-out");
        World.result = Engine.analyze(World.server, World.project, World.serverOut, null);
    }

    @Then("the tool result metadata lists a warning naming that file by its path relative to the project")
    public void warningNamesFile() {
        assertFalse(World.result.isError(), Engine.text(World.result));
        List<String> warnings = Engine.warnings(World.result);
        assertNotNull(warnings, "no warning metadata");
        assertTrue(warnings.stream().anyMatch(w -> w.contains(World.brokenFile)), warnings.toString());
        assertTrue(warnings.stream().noneMatch(w -> w.contains(World.project.toString())),
                "warnings must use paths relative to the project: " + warnings);
    }

    @Then("the tool result content validates against the analyze_project response contract {string}")
    public void responseValidates(String version) {
        SchemaRegistry registry = SchemaRegistry.get();
        assertEquals(version, registry.version());
        assertEquals(List.of(), registry.validate("mcp/analyze_project.response", Engine.text(World.result)));
    }

    @When("it is analyzed in command-line mode")
    public void cliMode() {
        World.cliOut = Engine.newDir("cli-out");
        World.cli = Engine.cli(World.project, World.cliOut, null);
        assertEquals(0, World.cli.exitCode(), World.cli.stderr());
    }

    @Then("the command error output contains a line starting with {string} naming that file")
    public void cliWarningLine(String prefix) {
        assertTrue(World.cli.stderr().lines().anyMatch(l -> l.startsWith(prefix) && l.contains(World.brokenFile)),
                World.cli.stderr());
        assertFalse(World.cli.stdout().contains(prefix), "warnings go to the error output only");
    }

    @Then("both modes produce byte-identical output documents declaring the contract version {string}")
    public void identicalWithVersion(String version) throws IOException {
        List<String> server = Engine.documents(World.serverOut);
        assertEquals(server, Engine.documents(World.cliOut));
        ObjectMapper mapper = new ObjectMapper();
        for (String doc : server) {
            assertEquals(version, mapper.readTree(doc).path("meta").path("schema_version").asText());
        }
    }

    @Then("the analysis succeeds with {int} components")
    public void componentsCount(int count) throws IOException {
        assertFalse(World.result.isError(), Engine.text(World.result));
        assertEquals(count, new ObjectMapper().readTree(Engine.text(World.result)).path("componentCount").asInt());
    }

    @Then("the tool result metadata lists the warning {string}")
    public void listsWarning(String text) {
        List<String> warnings = Engine.warnings(World.result);
        assertNotNull(warnings, "no warning metadata");
        assertTrue(warnings.stream().anyMatch(w -> w.contains(text)), warnings.toString());
    }
}
