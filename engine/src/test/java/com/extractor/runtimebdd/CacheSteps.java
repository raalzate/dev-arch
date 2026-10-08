package com.extractor.runtimebdd;

import com.extractor.mcp.McpServerMain;
import com.extractor.service.AnalysisCache;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import io.modelcontextprotocol.spec.McpSchema;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** TS-055, TS-056, TS-057, TS-058 (reuse of unchanged projects in server mode). */
public class CacheSteps {

    private static AnalysisCache cache() {
        AnalysisCache cache = World.server.reuseCache();
        assertTrue(cache != null && cache.capacity() > 0, "server mode must reuse analyses");
        return cache;
    }

    /** Full analysis of World.project into a fresh output directory; records hit/miss and duration. */
    private static List<String> fullAnalysis(String language) {
        long misses = cache().misses();
        World.serverOut = Engine.newDir("out");
        long start = System.nanoTime();
        World.result = Engine.analyze(World.server, World.project, World.serverOut, language);
        long elapsed = System.nanoTime() - start;
        assertFalse(World.result.isError(), Engine.text(World.result));
        World.lastWasMiss = cache().misses() > misses;
        if (World.firstResult == null) {
            World.firstNanos = elapsed;
        } else {
            World.secondNanos = elapsed;
        }
        return Engine.documents(World.serverOut);
    }

    private static void analyzeOnce(Path project) {
        World.project = project;
        World.firstResult = null;
        World.firstDocs = fullAnalysis(null);
        World.firstResult = World.result;
        World.firstOut = World.serverOut;
        assertTrue(World.lastWasMiss, "the first analysis must compute");
    }

    @Given("the demo project {string} has been fully analyzed once in this session")
    public void demoAnalyzedOnce(String demo) {
        analyzeOnce(Engine.copyDemo(demo));
    }

    @Given("a copy of the demo project {string} has been fully analyzed once in this session")
    public void copyAnalyzedOnce(String demo) {
        analyzeOnce(Engine.copyDemo(demo));
    }

    @When("the same project is fully analyzed again")
    public void sameAgain() {
        World.docs.put("second", fullAnalysis(null));
    }

    @Then("the analysis is served from the reuse cache")
    public void servedFromCache() {
        assertFalse(World.lastWasMiss, "expected a reuse hit");
    }

    @Then("the result and the output documents are byte-identical to the first ones")
    public void resultAndDocsIdentical() {
        assertEquals(Engine.text(World.firstResult).replace(World.firstDocsDir(), ""),
                Engine.text(World.result).replace(World.serverOut.toString(), ""));
        assertEquals(World.firstResult.meta(), World.result.meta());
        assertEquals(World.firstDocs, World.docs.get("second"));
    }

    @Then("the second query takes less than {int}% of the time of the first")
    public void fasterThan(int percent) {
        assertTrue(World.secondNanos * 100 < World.firstNanos * (long) percent,
                "first " + World.firstNanos / 1_000_000 + " ms, second " + World.secondNanos / 1_000_000 + " ms");
    }

    private static Path someJavaClass() throws IOException {
        try (Stream<Path> walk = Files.walk(World.project)) {
            return walk.filter(p -> p.toString().endsWith(".java") && p.toString().contains("src/main"))
                    .sorted().findFirst().orElseThrow();
        }
    }

    @When("a new Java class is added in that copy")
    public void addClass() throws IOException {
        Path dir = someJavaClass().getParent();
        String pkg = Files.readAllLines(someJavaClass()).stream().filter(l -> l.startsWith("package "))
                .findFirst().orElse("");
        Files.writeString(dir.resolve("AddedByScenario.java"), pkg + "\npublic class AddedByScenario { }\n");
    }

    @When("an existing Java class is deleted in that copy")
    public void deleteClass() throws IOException {
        Files.delete(someJavaClass());
    }

    @When("an existing Java class is modified with a newer modification time in that copy")
    public void modifyClass() throws IOException {
        Path file = someJavaClass();
        FileTime before = Files.getLastModifiedTime(file);
        String content = Files.readString(file);
        int brace = content.lastIndexOf('}');
        Files.writeString(file, content.substring(0, brace)
                + "    public int addedByScenario() { return 42; }\n}\n");
        Files.setLastModifiedTime(file, FileTime.fromMillis(before.toMillis() + 60_000));
    }

    @When("the copy is fully analyzed again")
    public void copyAgain() {
        World.docs.put("second", fullAnalysis(null));
    }

    @Then("the analysis is recomputed instead of reused")
    public void recomputed() {
        assertTrue(World.lastWasMiss, "expected a recomputation");
    }

    @Then("the result reflects the change")
    public void reflectsChange() {
        assertNotEquals(World.firstDocs.get(0), World.docs.get("second").get(0));
    }

    @Given("the engine server mode is started with a reuse capacity of {int} projects")
    public void serverWithCapacity(int capacity) {
        World.server = McpServerMain.createService(capacity);
    }

    @When("three different projects are fully analyzed in turn")
    public void threeProjects() {
        World.projects = List.of(Engine.copyDemo("java-standar"), Engine.copyDemo("java-standar"),
                Engine.copyDemo("java-standar"));
        for (Path p : World.projects) {
            World.project = p;
            fullAnalysis(null);
            assertTrue(World.lastWasMiss);
        }
    }

    @When("the first project is fully analyzed again")
    public void firstAgain() {
        World.project = World.projects.get(0);
        fullAnalysis(null);
    }

    @Then("the first project is recomputed instead of reused")
    public void firstRecomputed() {
        assertTrue(World.lastWasMiss, "the least recently used project must have been evicted");
    }

    @When("an analyzed project is analyzed again with a different language choice")
    public void otherLanguage() {
        World.project = World.projects.get(2);
        fullAnalysis("java");
    }

    @Then("it is recomputed instead of reused")
    public void itRecomputed() {
        assertTrue(World.lastWasMiss, "the language choice is part of the reuse key");
    }

    @When("its architecture proposal is requested with the minimum viability {string}")
    public void architectureWithMinViability(String level) {
        McpSchema.CallToolResult r = Engine.call(World.server, "get_architecture_proposal",
                Map.of("projectPath", World.project.toString(), "minViability", level));
        assertFalse(r.isError(), Engine.text(r));
    }

    @Then("the output documents are byte-identical to the first ones")
    public void docsIdentical() {
        assertEquals(World.firstDocs, World.docs.get("second"));
    }
}
