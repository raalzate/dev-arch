package com.extractor.runtimebdd;

import com.extractor.mcp.McpServerMain;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import io.modelcontextprotocol.spec.McpSchema;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** TS-048, TS-049, TS-060 (progress and absence of warning metadata). */
public class ProgressSteps {

    @Given("the engine server mode is started")
    public void serverStarted() {
        World.server = McpServerMain.createService();
    }

    @When("a full analysis of the demo project {string} is requested with a progress token")
    public void analyzeWithToken(String demo) {
        World.project = Engine.copyDemo(demo);
        World.serverOut = Engine.newDir("out");
        World.notifications = new ArrayList<>();
        World.result = Engine.analyze(World.server, World.project, World.serverOut, null, "progress-1",
                World.notifications);
        assertFalse(World.result.isError(), Engine.text(World.result));
    }

    @When("a full analysis of the demo project {string} is requested without a progress token")
    public void analyzeWithoutToken(String demo) {
        World.project = Engine.copyDemo(demo);
        World.serverOut = Engine.newDir("out");
        List<McpSchema.ProgressNotification> reference = new ArrayList<>();
        World.firstResult = Engine.analyze(World.server, World.project, World.serverOut, null, "ref", reference);
        assertEquals(4, reference.size(), "reference request with a token must receive the 4 phases");
        World.firstDocs = Engine.documents(World.serverOut);
        World.notifications = new ArrayList<>();
        World.result = Engine.analyze(World.server, World.project, World.serverOut, null, null, World.notifications);
        assertFalse(World.result.isError(), Engine.text(World.result));
    }

    @When("a full analysis of the demo project {string} is requested")
    public void analyzePlain(String demo) {
        World.project = Engine.copyDemo(demo);
        World.serverOut = Engine.newDir("out");
        World.result = Engine.analyze(World.server, World.project, World.serverOut, null);
        assertFalse(World.result.isError(), Engine.text(World.result));
    }

    @Then("exactly {int} progress notifications arrive before the result")
    public void exactlyNotifications(int count) {
        assertEquals(count, World.notifications.size(), World.notifications.toString());
        assertTrue(World.result != null && !World.result.isError());
    }

    @Then("their messages are {string}, {string}, {string} and {string} in that order")
    public void messagesInOrder(String a, String b, String c, String d) {
        assertEquals(List.of(a, b, c, d),
                World.notifications.stream().map(McpSchema.ProgressNotification::message).toList());
    }

    @Then("their progress values are {int}, {int}, {int} and {int} out of a total of {int}")
    public void progressValues(int a, int b, int c, int d, int total) {
        assertEquals(List.of((double) a, (double) b, (double) c, (double) d),
                World.notifications.stream().map(McpSchema.ProgressNotification::progress).toList());
        for (McpSchema.ProgressNotification n : World.notifications) {
            assertEquals((double) total, n.total());
            assertEquals("progress-1", n.progressToken());
        }
    }

    @Then("no progress notification arrives")
    public void noNotification() {
        assertTrue(World.notifications.isEmpty(), World.notifications.toString());
    }

    @Then("the result and the three output documents are byte-identical to those of a request with a progress token")
    public void identicalToTokenRequest() {
        assertEquals(Engine.text(World.firstResult), Engine.text(World.result));
        assertEquals(World.firstResult.meta(), World.result.meta());
        List<String> docs = Engine.documents(World.serverOut);
        assertTrue(docs.stream().allMatch(d -> d != null && !d.isEmpty()));
        assertEquals(World.firstDocs, docs);
    }

    @Then("the tool result has no warning metadata")
    public void noWarningMetadata() {
        assertNull(Engine.warnings(World.result), String.valueOf(World.result.meta()));
    }
}
