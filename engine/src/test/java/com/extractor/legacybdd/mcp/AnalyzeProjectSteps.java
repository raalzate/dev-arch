package com.extractor.legacybdd.mcp;

import com.fasterxml.jackson.databind.JsonNode;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** US-001 (TS-001..TS-006): analyze_project over the MCP server. */
public class AnalyzeProjectSteps {

    /** Lower bound of the long-running analysis (TS-004). */
    private static final Duration LONG_ANALYSIS = Duration.ofSeconds(30);
    /** Classes of the first generated monolith (about 35-40 s of analysis on a developer laptop). */
    private static final int INITIAL_CLASSES = 6000;
    private static final int PACKAGES = 30;
    private static final int MAX_ATTEMPTS = 3;

    private Instant callStart;

    // ---- TS-001 ----------------------------------------------------------------------------------------------

    @When("the agent invokes {string} with a valid path to a Java project")
    public void invokeWithValidPathDefaultOutput(String tool) {
        // Own copy: without outputDir the documents are written into the project root.
        World.project = Support.freshDemo("java-standar", Support.newDir("ts001-"));
        callStart = Instant.now().minusSeconds(1);
        JsonNode response = Calls.call(tool, Calls.args(World.project, null));
        assertFalse(Support.isError(response), Support.text(response));
    }

    @Then("the response contains a structured result with dependency graph, microservice proposals, and API contracts")
    public void structuredResult() {
        JsonNode body = World.body;
        int components = body.path("componentCount").asInt(-1);
        assertTrue(components > 0, body.toString());
        assertTrue(body.path("edgeCount").asInt(-1) > 0, body.toString());
        assertTrue(body.path("proposalCount").asInt(-1) > 0, body.toString());
        assertTrue(body.path("endpointCount").asInt(-1) > 0, body.toString());
        // The counts describe the graph, proposals and contracts the tool produced.
        JsonNode graph = document(body, "output.json");
        assertEquals(components, graph.path("components").size());
        assertEquals(body.path("edgeCount").asInt(), graph.path("edges").size());
        assertEquals(body.path("proposalCount").asInt(),
                document(body, "output_architecture.json").path("proposals").size());
        assertEquals(body.path("endpointCount").asInt(),
                document(body, "output_entrypoints.json").path("endpoints").size());
        assertFalse(body.path("summary").asText().isBlank());
    }

    @Then("the corresponding output files are generated on disk")
    public void outputFilesOnDisk() throws IOException {
        JsonNode files = World.body.path("filesGenerated");
        assertEquals(Support.DOCUMENTS.size(), files.size(), files.toString());
        for (String name : Support.DOCUMENTS) {
            Path expected = World.project.resolve(name); // default output directory: the project root
            assertTrue(Files.isRegularFile(expected), expected + " missing");
            assertTrue(files.toString().contains(name), name + " not reported in " + files);
            FileTime modified = Files.getLastModifiedTime(expected);
            assertTrue(modified.toInstant().isAfter(callStart), name + " was not written by this call");
            Support.readJson(expected);
        }
        for (JsonNode file : files) {
            assertEquals(World.project.toRealPath(), Path.of(file.asText()).toRealPath().getParent());
        }
    }

    // ---- TS-002 / TS-003 -------------------------------------------------------------------------------------

    @When("the agent invokes {string} with a path that does not exist")
    public void invokeWithMissingPath(String tool) {
        World.project = Support.scratch().resolve("missing-" + UUID.randomUUID());
        World.argument = World.project.toString();
        Calls.call(tool, Calls.args(World.project, Support.newDir("out-")));
    }

    @When("the agent invokes {string} with a path that contains no Java source files")
    public void invokeWithoutJavaSources(String tool) throws IOException {
        World.project = Support.newDir("no-java-");
        Files.writeString(World.project.resolve("README.md"), "# Documentation only\n", StandardCharsets.UTF_8);
        World.argument = World.project.toString();
        Calls.call(tool, Calls.args(World.project, Support.newDir("out-")));
    }

    @Then("the response is an MCP error with isError true")
    public void mcpError() {
        assertTrue(World.response.has("result"), "expected a tool error result, got: " + World.response);
        assertTrue(Support.isError(World.response),
                "isError must be true; response was: " + StdioServer.tail(World.response.toString()));
        assertFalse(Support.text(World.response).isBlank(), "error without message");
    }

    @Then("the error message clearly indicates the path does not exist")
    public void errorPathDoesNotExist() {
        String text = Support.text(World.response);
        assertTrue(text.contains(World.argument), text);
        assertTrue(text.toLowerCase().contains("does not exist"), text);
    }

    @Then("the error message indicates no Java source files were found")
    public void errorNoJavaSources() {
        String text = Support.text(World.response);
        assertTrue(text.toLowerCase().contains("no java source files"), text);
    }

    // ---- TS-004 ----------------------------------------------------------------------------------------------

    @When("the analysis takes more than {int} seconds")
    public void longAnalysis(int seconds) {
        assertEquals(LONG_ANALYSIS.toSeconds(), seconds);
        int classes = INITIAL_CLASSES;
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            World.project = generateMonolith(classes);
            World.outputDir = Support.newDir("out-");
            World.progressToken = "ts004-" + attempt;
            World.pingsDuringAnalysis = new ArrayList<>();
            List<JsonNode> seenAtResponse = new ArrayList<>();
            long start = System.nanoTime();
            CompletableFuture<JsonNode> call = World.server.callToolAsync("analyze_project",
                    Calls.args(World.project, World.outputDir), Map.of("progressToken", World.progressToken))
                    .thenApply(r -> {
                        seenAtResponse.addAll(progressOf(World.progressToken));
                        return r;
                    });
            // While the analysis runs, the connection must keep serving the agent.
            while (!call.isDone()) {
                sleep(Duration.ofSeconds(5));
                if (!call.isDone()) {
                    JsonNode pong = World.server.request("ping", null, Duration.ofMinutes(5));
                    if (!call.isDone()) {
                        World.pingsDuringAnalysis.add(pong);
                    }
                }
            }
            JsonNode response = StdioServer.await(call, Duration.ofMinutes(10), "long analyze_project");
            World.elapsedNanos = System.nanoTime() - start;
            Calls.record(response);
            World.responses = List.of(response);
            World.notificationsAtResponse = seenAtResponse;
            if (Duration.ofNanos(World.elapsedNanos).compareTo(LONG_ANALYSIS) > 0) {
                return;
            }
            // Faster machine: grow the monolith so the premise of the scenario holds.
            double factor = 1.5 * LONG_ANALYSIS.toNanos() / Math.max(1, World.elapsedNanos);
            classes = (int) Math.ceil(classes * Math.max(1.5, factor));
        }
    }

    @Then("the server maintains the connection active and notifies progress to the agent")
    public void connectionActiveAndProgress() {
        Duration elapsed = Duration.ofNanos(World.elapsedNanos);
        assertTrue(elapsed.compareTo(LONG_ANALYSIS) > 0, "analysis took only " + elapsed);
        assertFalse(Support.isError(World.response), Support.text(World.response));
        assertEquals(World.generatedClasses, World.body.path("componentCount").asInt());
        List<JsonNode> progress = World.notificationsAtResponse;
        assertTrue(progress.size() >= 2, "progress notifications before the result: " + progress);
        double previous = 0;
        for (JsonNode n : progress) {
            double value = n.path("params").path("progress").asDouble();
            assertTrue(value > previous, "progress must increase: " + progress);
            previous = value;
        }
        JsonNode last = progress.get(progress.size() - 1).path("params");
        assertEquals(last.path("total").asDouble(), last.path("progress").asDouble(), 0.0, last.toString());
        assertFalse(World.pingsDuringAnalysis.isEmpty(), "no ping answered while the analysis was running");
        World.pingsDuringAnalysis.forEach(p -> assertTrue(p.has("result"), p.toString()));
        assertTrue(World.server.isAlive());
        JsonNode after = World.server.request("ping", null, Duration.ofSeconds(30));
        assertTrue(after.has("result"), "connection lost after the long analysis: " + after);
    }

    // ---- TS-005 / TS-006 -------------------------------------------------------------------------------------

    @When("the agent invokes {string} with a valid Java project path")
    @When("the agent invokes {string} with a valid project path and an output directory")
    public void invokeWithOutputDir(String tool) {
        Calls.success(tool, Support.demo("java-standar"), Map.of());
    }

    @Then("the response contains {string} as an integer")
    public void containsInteger(String field) {
        JsonNode value = World.body.get(field);
        assertTrue(value != null && value.isIntegralNumber(), field + " in " + World.body);
    }

    @Then("the response contains {string} as a list of file paths")
    public void containsFileList(String field) {
        JsonNode value = World.body.get(field);
        assertTrue(value != null && value.isArray() && value.size() > 0, field + " in " + World.body);
        for (JsonNode file : value) {
            assertTrue(file.isTextual(), file.toString());
            Path path = Path.of(file.asText());
            assertTrue(path.isAbsolute() && Files.isRegularFile(path), file.asText());
        }
    }

    @Then("the response contains {string} as a string")
    public void containsString(String field) {
        JsonNode value = World.body.get(field);
        assertTrue(value != null && value.isTextual() && !value.asText().isBlank(), field + " in " + World.body);
    }

    @Then("the files {string}, {string}, and {string} are created in the output directory")
    public void filesCreated(String first, String second, String third) {
        List<String> reported = new ArrayList<>();
        World.body.path("filesGenerated").forEach(f -> reported.add(f.asText()));
        for (String name : List.of(first, second, third)) {
            Path file = World.outputDir.resolve(name);
            assertTrue(Files.isRegularFile(file), file + " not created");
            assertTrue(reported.contains(file.toString()), file + " not in " + reported);
            assertFalse(Files.exists(World.project.resolve(name)), name + " written into the project instead");
            Support.readJson(file);
        }
    }

    // ---- helpers ---------------------------------------------------------------------------------------------

    private static JsonNode document(JsonNode body, String name) {
        for (JsonNode file : body.path("filesGenerated")) {
            if (Path.of(file.asText()).getFileName().toString().equals(name)) {
                return Support.readJson(Path.of(file.asText()));
            }
        }
        throw new AssertionError(name + " not in filesGenerated " + body.path("filesGenerated"));
    }

    private static List<JsonNode> progressOf(String token) {
        List<JsonNode> out = new ArrayList<>();
        for (JsonNode n : World.server.notifications()) {
            if ("notifications/progress".equals(n.path("method").asText())
                    && token.equals(n.path("params").path("progressToken").asText())) {
                out.add(n);
            }
        }
        return out;
    }

    /** Generates a Maven project with {@code classes} interdependent Spring services. */
    private static Path generateMonolith(int classes) {
        Path root = Support.newDir("monolith-");
        try {
            Files.writeString(root.resolve("pom.xml"), "<project><modelVersion>4.0.0</modelVersion>"
                    + "<groupId>com.big</groupId><artifactId>big</artifactId><version>1</version></project>\n");
            for (int i = 0; i < classes; i++) {
                String pkg = "m" + (i % PACKAGES);
                Path dir = Files.createDirectories(root.resolve("src/main/java/com/big").resolve(pkg));
                StringBuilder src = new StringBuilder("package com.big.").append(pkg).append(";\n")
                        .append("@org.springframework.stereotype.Service\npublic class C").append(i).append(" {\n");
                int dep = (i * 7 + 1) % classes;
                for (int k = 1; k <= 3; k++) {
                    int j = (i * 7 + k) % classes;
                    src.append("  private com.big.m").append(j % PACKAGES).append(".C").append(j).append(" f")
                            .append(j).append(";\n");
                }
                for (int k = 0; k < 8; k++) {
                    src.append("  public int m").append(k).append("(int x) { int s = 0; for (int a = 0; a < x; a++)")
                            .append(" { s += a * ").append(k).append("; if (s > 100) { s -= 3; } } return s + (f")
                            .append(dep).append(" == null ? 0 : 1); }\n");
                }
                src.append("}\n");
                Files.writeString(dir.resolve("C" + i + ".java"), src, StandardCharsets.UTF_8);
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        World.generatedClasses = classes;
        return root;
    }

    private static void sleep(Duration duration) {
        try {
            TimeUnit.MILLISECONDS.sleep(duration.toMillis());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
    }
}
