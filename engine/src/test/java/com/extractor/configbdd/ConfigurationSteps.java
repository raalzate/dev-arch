package com.extractor.configbdd;

import com.extractor.inference.config.InferenceConfig;
import com.extractor.inference.config.InferenceConfigLoader;
import com.extractor.mcp.McpServerMain;
import com.extractor.testsupport.ProductLayout;
import com.extractor.testsupport.RegressionBaselines;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.cucumber.java.en.And;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

import java.nio.file.Files;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Steps of configuration.feature (US2, TS-005..TS-013). */
public class ConfigurationSteps {

    @Given("a configuration file containing every default inference parameter")
    public void defaultsFile() {
        Support.writeConfig("defaults.json", InferenceConfigLoader.toJson(InferenceConfig.defaults()));
    }

    @Given("a configuration file declaring only {string} = {double} and {string} = {double}")
    public void partialFile(String a, double va, String b, double vb) {
        ObjectNode root = Support.MAPPER.createObjectNode();
        Support.put(root, a, va);
        Support.put(root, b, vb);
        Support.writeConfig("partial.json", root.toString());
    }

    @Given("a configuration file declaring an unknown parameter {string}")
    public void unknownFile(String dotted) {
        ObjectNode root = Support.MAPPER.createObjectNode();
        Support.put(root, dotted, 0.8);
        Support.writeConfig("unknown.json", root.toString());
    }

    @Given("^a configuration file that (does not exist|is not valid JSON)$")
    public void unusableFile(String problem) {
        if (problem.equals("does not exist")) {
            World.configFile = World.tmp.resolve("missing-config.json");
        } else {
            Support.writeConfig("broken.json", "{ \"viability\": ");
        }
    }

    @Given("^an inline configuration (\\{.*\\})$")
    public void inlineConfiguration(String json) {
        World.inlineConfig = json;
    }

    @When("the demo project {string} is analyzed from the command line with that configuration file")
    public void cliWithFile(String project) {
        Support.cli(Support.demo(project), Support.newDir("cli"), "--config=" + World.configFile);
        assertEquals(0, World.cli.exitCode(), World.cli.stderr());
    }

    @When("the demo project {string} is analyzed from the command line with that configuration file into an empty output directory")
    public void cliWithFileIntoEmpty(String project) {
        Support.cli(Support.demo(project), Support.newDir("cli"), "--config=" + World.configFile);
    }

    @When("the demo project {string} is analyzed with the analyze_project tool with the same configuration given inline")
    public void mcpSameInline(String project) throws Exception {
        Support.mcpAnalyze(Support.demo(project), Support.newDir("mcp"),
                Support.object(Files.readString(World.configFile)), null);
        assertFalse(Support.isError(World.result), Support.text(World.result));
    }

    @When("the demo project {string} is analyzed with the analyze_project tool with the same configuration given as configPath")
    public void mcpSamePath(String project) {
        Support.mcpAnalyze(Support.demo(project), Support.newDir("mcp"), null, World.configFile.toString());
        assertFalse(Support.isError(World.result), Support.text(World.result));
    }

    @When("the demo project {string} is analyzed with the analyze_project tool with that inline configuration into an empty output directory")
    public void mcpInlineIntoEmpty(String project) {
        Support.mcpAnalyze(Support.demo(project), Support.newDir("mcp"), Support.object(World.inlineConfig), null);
    }

    @When("the demo project {string} is analyzed with the analyze_project tool with that configuration file as configPath")
    public void mcpWithPath(String project) {
        Support.mcpAnalyze(Support.demo(project), Support.newDir("mcp"), null, World.configFile.toString());
    }

    @When("the analyze_project tool is called on the demo project {string} with both the inline configuration and the configuration file")
    public void mcpBoth(String project) {
        Support.mcpAnalyze(Support.demo(project), Support.newDir("mcp"), Support.object(World.inlineConfig),
                World.configFile.toString());
    }

    @When("^the demo project \"([^\"]*)\" is analyzed with the analyze_project tool with the inline configuration (\\{.*\\})$")
    public void mcpInline(String project, String json) {
        Support.mcpAnalyze(Support.demo(project), Support.newDir("mcp"), Support.object(json), null);
        assertFalse(Support.isError(World.result), Support.text(World.result));
    }

    @Given("the server mode with analysis reuse enabled")
    public void reuseEnabled() {
        World.server = McpServerMain.createService(8);
    }

    @Then("the three documents are byte-identical to the analysis without configuration")
    public void identicalToDefault() {
        List<String> docs = last();
        Map<String, String> baseline = RegressionBaselines.load((String) World.value);
        for (int i = 0; i < 3; i++) {
            String name = RegressionBaselines.DOCUMENTS.get(i);
            assertEquals(baseline.get(name), docs.get(i), name);
        }
    }

    @Then("every proposal has viability {string}")
    public void everyProposalHas(String viability) {
        JsonNode proposals = Support.json(World.architecture).path("proposals");
        assertTrue(proposals.size() > 0, "no proposals");
        proposals.forEach(p -> assertEquals(viability, p.path("viability").asText(), p.path("name").asText()));
    }

    @Then("the dependency graph and the entrypoints documents are byte-identical to the analysis without configuration")
    public void graphAndEntrypointsUnchanged() {
        Map<String, String> baseline = RegressionBaselines.load((String) World.value);
        assertEquals(baseline.get(RegressionBaselines.DOCUMENTS.get(0)), last().get(0));
        assertEquals(baseline.get(RegressionBaselines.DOCUMENTS.get(2)), last().get(2));
    }

    @Then("the proposals group the same clusters as the analysis without configuration")
    public void sameClusters() {
        String baseline = RegressionBaselines.load((String) World.value).get(RegressionBaselines.DOCUMENTS.get(1));
        assertEquals(clusters(baseline), clusters(last().get(1)));
    }

    static List<String> clusters(String architecture) {
        List<String> out = new ArrayList<>();
        Support.json(architecture).path("proposals").forEach(p -> out.add(p.path("clusters").toString()));
        return out;
    }

    @Then("both analyses produce byte-identical documents")
    public void lastTwoIdentical() {
        int n = World.analyses.size();
        assertEquals(World.analyses.get(n - 2), World.analyses.get(n - 1));
        assertNotNull(World.analyses.get(n - 1).get(0));
    }

    @Then("the tool reports an error containing {string}")
    public void toolError(String message) {
        assertTrue(Support.isError(World.result), "not an error: " + Support.text(World.result));
        assertTrue(Support.text(World.result).contains(message), Support.text(World.result));
    }

    @Then("no document is written to the output directory")
    public void noDocuments() {
        Support.documents(World.outDir).forEach(d -> assertEquals(null, d));
    }

    @Then("the command exits with code {int}")
    public void exitCode(int code) {
        assertEquals(code, World.cli.exitCode());
    }

    @And("the error output contains {string}")
    public void errorOutput(String text) {
        assertTrue(World.cli.stderr().contains(text), World.cli.stderr());
    }

    @Then("the second analysis reports every proposal with viability {string}")
    public void secondAnalysis(String viability) {
        Support.json(World.analyses.get(1).get(1)).path("proposals")
                .forEach(p -> assertEquals(viability, p.path("viability").asText()));
    }

    @Then("the third analysis is byte-identical to the first")
    public void thirdEqualsFirst() {
        assertEquals(World.analyses.get(0), World.analyses.get(2));
    }

    @Given("the default inference configuration")
    public void theDefaults() {
        World.value = InferenceConfig.defaults();
    }

    /** Rows {@code | `path` | type | default | range | stage | effect |} of the parameter table. */
    private static Map<String, String> guideTable() throws Exception {
        String guide = Files.readString(ProductLayout.get().engineRoot().resolve("CONFIGURATION.md"));
        Map<String, String> rows = new LinkedHashMap<>();
        Matcher m = Pattern.compile("(?m)^\\| `([a-zA-Z]+\\.[a-zA-Z.]+)` \\| [^|]+ \\| ([^|]+) \\|").matcher(guide);
        while (m.find()) {
            rows.put(m.group(1), m.group(2).trim());
        }
        return rows;
    }

    private static Map<String, JsonNode> leaves() {
        Map<String, JsonNode> out = new LinkedHashMap<>();
        collect("", Support.json(InferenceConfigLoader.toJson((InferenceConfig) World.value)), out);
        return out;
    }

    private static void collect(String prefix, JsonNode node, Map<String, JsonNode> out) {
        if (node.isObject() && !prefix.equals("naming.infrastructureLabels.")) {
            Iterator<Map.Entry<String, JsonNode>> it = node.fields();
            while (it.hasNext()) {
                Map.Entry<String, JsonNode> e = it.next();
                collect(prefix + e.getKey() + ".", e.getValue(), out);
            }
        } else {
            out.put(prefix.substring(0, prefix.length() - 1), node);
        }
    }

    @Then("it declares a value for every parameter listed in the parameter table of the configuration guide")
    public void everyListedParameter() throws Exception {
        Map<String, String> rows = guideTable();
        Map<String, JsonNode> leaves = leaves();
        assertEquals(new ArrayList<>(leaves.keySet()).stream().sorted().toList(),
                new ArrayList<>(rows.keySet()).stream().sorted().toList());
    }

    @Then("every listed default equals the value documented in the guide")
    public void defaultsMatchTheGuide() throws Exception {
        Map<String, String> rows = guideTable();
        Map<String, JsonNode> leaves = leaves();
        Map<String, String> mismatches = new HashMap<>();
        for (Map.Entry<String, JsonNode> e : leaves.entrySet()) {
            String documented = rows.get(e.getKey()).replace("`", "").trim();
            String actual = render(e.getValue());
            if (!documented.equals(actual)) {
                mismatches.put(e.getKey(), documented + " != " + actual);
            }
        }
        assertEquals(Map.of(), mismatches);
    }

    /** Guide notation: numbers as written by Java, strings bare, lists "a, b", maps "k→v, …". */
    static String render(JsonNode v) {
        if (v.isNumber()) {
            return v.isIntegralNumber() ? Long.toString(v.asLong()) : Double.toString(v.asDouble());
        }
        if (v.isTextual()) {
            return v.asText();
        }
        List<String> items = new ArrayList<>();
        if (v.isArray()) {
            v.forEach(x -> items.add(x.asText()));
            return items.isEmpty() ? "(vacía)" : String.join(", ", items);
        }
        v.fields().forEachRemaining(e -> items.add(e.getKey() + "→" + e.getValue().asText()));
        return String.join(", ", items);
    }

    private static List<String> last() {
        return World.analyses.get(World.analyses.size() - 1);
    }
}
