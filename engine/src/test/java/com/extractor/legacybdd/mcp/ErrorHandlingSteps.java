package com.extractor.legacybdd.mcp;

import com.extractor.schema.DemoOutputs;
import com.fasterxml.jackson.databind.JsonNode;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Error handling and edge cases (TS-022..TS-027). */
public class ErrorHandlingSteps {

    /** Frames, causes and thread dumps of a Java stack trace. */
    private static final List<Pattern> STACK_TRACE = List.of(
            Pattern.compile("(?m)^\\s*at [\\w$.<>]+\\([^)]*\\)"),
            Pattern.compile("\\tat "),
            Pattern.compile("(?m)^Caused by: "),
            Pattern.compile("Exception in thread"),
            Pattern.compile("\\.java:\\d+\\)"),
            Pattern.compile("(?m)^\\s*\\.\\.\\. \\d+ more"));
    /** A bare exception class name ("java.lang.NullPointerException", "com.x.FooException: ..."). */
    private static final Pattern EXCEPTION_NAME = Pattern.compile("\\b(?:[a-z]\\w*\\.)+[A-Z]\\w*(?:Exception|Error)\\b");
    /** JVM internals: platform class names, modules and class loaders. */
    private static final Pattern JVM_INTERNALS = Pattern.compile("\\bjava\\.(?:lang|io|nio|util)\\.|\\bmodule java\\.|"
            + "\\bloader '");

    // ---- TS-022 ----------------------------------------------------------------------------------------------

    @When("any tool is invoked with input that causes an internal error")
    public void internalErrors() throws IOException {
        Path project = Support.demo("java-standar");
        // analyze_project: the output directory is an existing regular file, writing the documents fails.
        Path blocker = Support.newDir("blocker-").resolve("not-a-directory");
        Files.writeString(blocker, "x", StandardCharsets.UTF_8);
        World.errorResponses.put("analyze_project (output directory is a file)",
                World.server.callTool("analyze_project", Calls.args(project, blocker)));
        // Every tool: arguments that break the handler (no schema validation happens before it).
        for (String tool : Support.TOOLS) {
            Map<String, Object> wrongType = new LinkedHashMap<>();
            wrongType.put("projectPath", 42);
            wrongType.put("componentId", "x");
            World.errorResponses.put(tool + " (projectPath is a number)", World.server.callTool(tool, wrongType));
            World.errorResponses.put(tool + " (projectPath missing)",
                    World.server.callTool(tool, Map.of("componentId", "x")));
        }
    }

    @Then("the response has isError true")
    public void responsesAreErrors() {
        assertFalse(World.errorResponses.isEmpty());
        World.errorResponses.forEach((probe, response) -> {
            assertTrue(response.has("result"), probe + ": JSON-RPC error instead of a tool error: " + response);
            assertTrue(Support.isError(response), probe + ": " + response);
        });
    }

    @Then("the response contains a human-readable error message")
    public void humanReadable() {
        World.errorResponses.forEach((probe, response) -> {
            String text = Support.text(response).trim();
            assertFalse(text.isBlank(), probe);
            assertTrue(text.split("\\s+").length >= 3, probe + ": not a sentence: " + text);
            assertFalse(text.endsWith(": null") || "null".equals(text), probe + ": " + text);
            assertFalse(EXCEPTION_NAME.matcher(text).find(), probe + ": exposes exception class names: " + text);
            assertFalse(JVM_INTERNALS.matcher(text).find(), probe + ": exposes JVM internals: " + text);
        });
    }

    @Then("the response does not contain Java stack trace information")
    public void noStackTrace() {
        World.errorResponses.forEach((probe, response) -> {
            String all = response.toString() + "\n" + Support.text(response);
            for (Pattern p : STACK_TRACE) {
                assertFalse(p.matcher(all).find(), probe + ": stack trace (" + p + ") in " + all);
            }
            assertFalse(all.contains("at com.extractor"), probe + ": " + all);
        });
        assertTrue(World.server.isAlive(), "the server must survive internal errors");
    }

    // ---- TS-023 ----------------------------------------------------------------------------------------------

    @When("the agent invokes {string} on a project with some unparseable Java files")
    public void invokeWithUnparseable(String tool) throws IOException {
        Path project = Support.freshDemo("java-standar", Support.newDir("ts023-"));
        Path sourceDir;
        try (Stream<Path> walk = Files.walk(project.resolve("src/main/java"))) {
            sourceDir = walk.filter(p -> p.toString().endsWith(".java")).map(Path::getParent).sorted()
                    .findFirst().orElseThrow();
        }
        String pkg = project.resolve("src/main/java").relativize(sourceDir).toString().replace('/', '.');
        Files.writeString(sourceDir.resolve("BrokenOne.java"),
                "package " + pkg + ";\npublic class BrokenOne { void x( { int = ; }\n", StandardCharsets.UTF_8);
        Files.writeString(sourceDir.resolve("BrokenTwo.java"),
                "package " + pkg + ";\npublic class BrokenTwo extends {{{ \n", StandardCharsets.UTF_8);
        World.projects = List.of(project.relativize(sourceDir.resolve("BrokenOne.java")),
                project.relativize(sourceDir.resolve("BrokenTwo.java")));
        Calls.success(tool, project, Map.of());
    }

    @Then("the analysis completes with partial results")
    public void partialResults() {
        assertTrue(World.body.path("componentCount").asInt() > 0, World.body.toString());
        JsonNode graph = Support.readJson(World.outputDir.resolve("output.json"));
        Set<String> ids = new HashSet<>();
        graph.path("components").forEach(c -> ids.add(c.path("id").asText()));
        JsonNode clean = Calls.query("get_dependency_graph", Calls.args(Support.demo("java-standar"), null));
        List<String> missing = new ArrayList<>();
        clean.path("components").forEach(c -> {
            if (!ids.contains(c.path("id").asText())) {
                missing.add(c.path("id").asText());
            }
        });
        assertEquals(List.of(), missing, "components of the parseable files must still be reported");
    }

    @Then("the response includes warnings indicating which files could not be parsed")
    public void warningsListFiles() {
        JsonNode warnings = World.response.path("result").path("_meta").path("static-inference/warnings");
        assertTrue(warnings.isArray() && warnings.size() > 0, "no warnings in " + World.response.path("result"));
        for (Path broken : World.projects) {
            String rel = broken.toString().replace('\\', '/');
            boolean listed = false;
            for (JsonNode w : warnings) {
                listed |= w.asText().contains(rel);
            }
            assertTrue(listed, rel + " not reported in " + warnings);
        }
    }

    // ---- TS-024 / TS-025 -------------------------------------------------------------------------------------

    @When("the agent invokes {string} with a project path containing spaces")
    public void invokeWithSpaces(String tool) throws IOException {
        Path parent = Files.createDirectories(Support.newDir("ts024-").resolve("my legacy projects"));
        Path project = Support.freshDemo("java-standar", parent);
        assertTrue(project.toString().contains(" "));
        World.response = null;
        World.project = project;
        World.outputDir = Files.createDirectories(parent.resolve("analysis output"));
        Calls.call(tool, Calls.args(project, World.outputDir));
    }

    @Then("the analysis completes successfully")
    public void completesSuccessfully() {
        assertFalse(Support.isError(World.response), Support.text(World.response));
        JsonNode reference = Calls.query("get_dependency_graph", Calls.args(Support.demo("java-standar"), null));
        assertEquals(reference.path("components").size(), World.body.path("componentCount").asInt());
        for (String document : Support.DOCUMENTS) {
            assertTrue(Files.isRegularFile(World.outputDir.resolve(document)), document);
        }
    }

    @When("the agent invokes {string} with an output directory that does not exist")
    public void invokeWithMissingOutputDir(String tool) {
        World.project = Support.demo("java-standar");
        World.outputDir = Support.newDir("ts025-").resolve("not/yet/created");
        assertFalse(Files.exists(World.outputDir));
        Calls.call(tool, Calls.args(World.project, World.outputDir));
    }

    @Then("the system either creates the directory or reports a clear error")
    public void createsOrReports() {
        if (Support.isError(World.response)) {
            String text = Support.text(World.response);
            assertTrue(text.contains(World.outputDir.toString()), "unclear error: " + text);
            assertFalse(EXCEPTION_NAME.matcher(text).find(), text);
        } else {
            assertTrue(Files.isDirectory(World.outputDir), "directory not created");
            for (String document : Support.DOCUMENTS) {
                assertTrue(Files.isRegularFile(World.outputDir.resolve(document)), document);
            }
        }
    }

    // ---- TS-026 ----------------------------------------------------------------------------------------------

    @When("two agents invoke {string} simultaneously with different project paths")
    public void twoAgents(String tool) {
        Path base = Support.newDir("ts026-");
        World.projects = List.of(Support.freshDemo("java-standar", base), Support.freshDemo("legacy-erp", base));
        World.outputDirs = List.of(Support.newDir("out-a-"), Support.newDir("out-b-"));
        List<CompletableFuture<JsonNode>> calls = new ArrayList<>();
        for (int i = 0; i < 2; i++) {
            calls.add(World.server.callToolAsync(tool, Calls.args(World.projects.get(i), World.outputDirs.get(i)),
                    null));
        }
        World.responses = new ArrayList<>();
        for (CompletableFuture<JsonNode> call : calls) {
            World.responses.add(StdioServer.await(call, Duration.ofMinutes(5), tool));
        }
    }

    @Then("each receives independent results corresponding to its own project")
    public void independentResults() throws IOException {
        Set<String> previousIds = new HashSet<>();
        for (int i = 0; i < 2; i++) {
            JsonNode response = World.responses.get(i);
            assertFalse(Support.isError(response), Support.text(response));
            JsonNode body = Support.parse(Support.text(response));
            Path out = World.outputDirs.get(i);
            // Reference: the same project analyzed alone, in process, without any reuse.
            Path expected = Support.newDir("expected-");
            DemoOutputs.Artifacts reference = DemoOutputs.analyzeInto(World.projects.get(i), expected);
            assertEquals(Support.readJson(expected.resolve("output.json")).path("components").size(),
                    body.path("componentCount").asInt());
            for (String document : Support.DOCUMENTS) {
                assertTrue(body.path("filesGenerated").toString().contains(out.resolve(document).toString()));
                assertEquals(reference.byFileName(document), Support.read(out.resolve(document)),
                        document + " of " + World.projects.get(i).getFileName());
            }
            Set<String> ids = new HashSet<>();
            Support.readJson(out.resolve("output.json")).path("components").forEach(c -> ids.add(c.path("id")
                    .asText()));
            Set<String> shared = new HashSet<>(ids);
            shared.retainAll(previousIds);
            assertEquals(Set.of(), shared, "results mixed between projects");
            previousIds = ids;
        }
    }

    // ---- TS-027 ----------------------------------------------------------------------------------------------

    @Given("the same Java project")
    public void sameJavaProject() {
        World.project = Support.demo("java-standar");
    }

    @When("analyzed via CLI mode")
    public void analyzedViaCli() {
        World.cliOut = Support.newDir("ts027-cli-");
        World.run = Support.run(Support.jarCommand(List.of(World.project.toString(),
                World.cliOut.resolve("output.json").toString())), World.cliOut, Duration.ofMinutes(5));
        assertEquals(0, World.run.exitCode(), World.run.all());
    }

    @When("analyzed via MCP {string} tool")
    public void analyzedViaMcp(String tool) {
        World.server = Support.sharedServer();
        Path project = World.project;
        Calls.success(tool, project, Map.of());
    }

    @Then("both outputs contain identical dependency graph, architecture, and API contract data")
    public void identicalOutputs() {
        for (String document : Support.DOCUMENTS) {
            String cli = Support.read(World.cliOut.resolve(document));
            String mcp = Support.read(World.outputDir.resolve(document));
            assertTrue(cli.length() > 2, document);
            assertEquals(cli, mcp, document + " differs between CLI and MCP");
        }
    }
}
