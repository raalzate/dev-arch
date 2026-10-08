package com.extractor.runtimebdd;

import com.extractor.service.AnalysisService;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import io.modelcontextprotocol.spec.McpSchema;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** TS-064 (decision A2): concurrent full analyses equal sequential ones. */
public class ConcurrencySteps {

    private static List<String> analyzeInto(AnalysisService service, Path project, String tag) {
        Path out = Engine.newDir(tag);
        McpSchema.CallToolResult r = Engine.analyze(service, project, out, null);
        assertFalse(r.isError(), Engine.text(r));
        List<String> docs = Engine.documents(out);
        assertTrue(docs.stream().allMatch(d -> d != null && !d.isEmpty()));
        return docs;
    }

    @When("the demo projects {string} and {string} are fully analyzed at the same time")
    public void concurrently(String first, String second) throws Exception {
        World.projects = List.of(Engine.copyDemo(first), Engine.copyDemo(second));
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            List<Callable<List<String>>> calls = new ArrayList<>();
            for (Path p : World.projects) {
                calls.add(() -> analyzeInto(World.server, p, "concurrent"));
            }
            List<Future<List<String>>> futures = pool.invokeAll(calls);
            for (int i = 0; i < futures.size(); i++) {
                World.docs.put("concurrent-" + i, futures.get(i).get());
            }
        } finally {
            pool.shutdownNow();
        }
    }

    @Then("the output documents of each project are byte-identical to those of a sequential analysis")
    public void equalToSequential() {
        for (int i = 0; i < World.projects.size(); i++) {
            List<String> sequential = analyzeInto(new AnalysisService(), World.projects.get(i), "sequential");
            World.docs.put("sequential-" + i, sequential);
            assertEquals(sequential, World.docs.get("concurrent-" + i), "project " + World.projects.get(i));
        }
    }

    @Then("two consecutive sequential analyses of each project are byte-identical")
    public void consecutiveIdentical() {
        for (int i = 0; i < World.projects.size(); i++) {
            List<String> again = analyzeInto(new AnalysisService(), World.projects.get(i), "again");
            assertEquals(World.docs.get("sequential-" + i), again, "project " + World.projects.get(i));
        }
    }
}
