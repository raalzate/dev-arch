package com.extractor.configbdd;

import com.extractor.mcp.McpServerMain;
import com.extractor.service.AnalysisService;
import com.extractor.testsupport.ProductLayout;
import com.extractor.testsupport.RegressionBaselines;
import com.fasterxml.jackson.databind.JsonNode;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

import java.nio.file.Files;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Steps of regression.feature (US3, TS-001..TS-004, TS-049). */
public class RegressionSteps {

    private String spotbugs;

    @Given("the regression baseline of the demo project {string}")
    public void theRegressionBaseline(String project) {
        Support.demo(project);
        World.baseline = RegressionBaselines.load(project);
    }

    @When("the demo project {string} is analyzed from the command line without configuration")
    public void cliWithoutConfiguration(String project) {
        Support.cli(Support.demo(project), Support.newDir("cli"));
        assertEquals(0, World.cli.exitCode(), World.cli.stderr());
    }

    @When("the demo project {string} is analyzed with the analyze_project tool without configuration")
    public void mcpWithoutConfiguration(String project) {
        assertFalse(Support.isError(Support.mcpAnalyze(Support.demo(project), Support.newDir("mcp"), null, null)),
                Support.text(World.result));
    }

    @Then("the {string}, {string} and {string} documents are byte-identical to the baseline")
    public void documentsEqualTheBaseline(String graph, String architecture, String entrypoints) {
        List<String> docs = World.analyses.get(World.analyses.size() - 1);
        assertEquals(List.of(graph, architecture, entrypoints), RegressionBaselines.DOCUMENTS);
        for (int i = 0; i < docs.size(); i++) {
            String name = RegressionBaselines.DOCUMENTS.get(i);
            assertEquals(World.baseline.get(name), docs.get(i), name + " of " + World.value);
        }
    }

    @Given("the server-mode tool registry without the inference tools enabled")
    public void registryWithoutInferenceTools() {
        World.inferenceTools = false;
    }

    @When("the inference tools are enabled")
    public void inferenceToolsEnabled() {
        World.inferenceTools = true;
    }

    private static List<String> toolNames() {
        return McpServerMain.createToolSpecs(new AnalysisService(), World.inferenceTools, null).stream()
                .map(s -> s.tool().name()).toList();
    }

    @Then("it registers exactly the tools {string}, {string}, {string}, {string} and {string}")
    public void registersExactly(String a, String b, String c, String d, String e) {
        assertEquals(List.of(a, b, c, d, e), toolNames());
        assertEquals(toolNames(), com.extractor.mcp.McpToolSpecs.of(new AnalysisService()).stream()
                .map(s -> s.tool().name()).toList());
    }

    @Then("it registers those five tools plus {string} and {string}")
    public void registersPlus(String a, String b) {
        List<String> names = toolNames();
        assertEquals(7, names.size());
        assertEquals(List.of(a, b), names.subList(5, 7));
    }

    @Then("the graph, architecture and entrypoints documents declare schema_version {string}")
    public void declareSchemaVersion(String version) {
        List<String> docs = World.analyses.get(World.analyses.size() - 1);
        assertEquals(version, Support.json(docs.get(0)).path("meta").path("schema_version").asText());
        for (String doc : docs.subList(1, 3)) {
            JsonNode meta = Support.json(doc).path("meta");
            assertEquals(version, meta.path("schema_version").asText());
        }
    }

    @Given("the SpotBugs exclude filter of the engine")
    public void spotbugsFilter() throws Exception {
        spotbugs = Files.readString(ProductLayout.get().engineRoot().resolve("spotbugs-exclude.xml"));
    }

    @Then("it contains no exclusion tagged for feature 008")
    public void noFeature008Exclusion() {
        assertFalse(spotbugs.contains("feature 008"), "spotbugs-exclude.xml still mentions feature 008");
    }

    @Then("it has no exclusion for {string}, {string} or {string}")
    public void noExclusionFor(String a, String b, String c) {
        for (String cls : List.of(a, b, c)) {
            assertFalse(Pattern.compile("<Class name=\"[\\w.]*\\." + cls + "\"").matcher(spotbugs).find(), cls);
        }
    }

    @Then("the continuous integration Checkstyle limit is not above {int} allowed violations")
    public void checkstyleLimit(int limit) throws Exception {
        String workflow = Files.readString(ProductLayout.get().ciWorkflow());
        Matcher m = Pattern.compile("maxAllowedViolations=(\\d+)").matcher(workflow);
        assertTrue(m.find(), "no Checkstyle limit in " + ProductLayout.get().ciWorkflow());
        assertTrue(Integer.parseInt(m.group(1)) <= limit, "limit " + m.group(1));
    }
}
