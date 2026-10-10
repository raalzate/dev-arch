package com.extractor.legacybdd.mcp;

import com.fasterxml.jackson.databind.JsonNode;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** US-002 (TS-007..TS-014): the granular tools over the MCP server. */
public class GranularToolsSteps {

    /** Viability ordering of the contract: Alta &gt; Media &gt; Baja. */
    private static final List<String> VIABILITY = List.of("Baja", "Media", "Alta");
    /** Keys that belong to clustering / quality metrics, never to API contracts. */
    private static final Set<String> NOT_CONTRACT_KEYS = Set.of("proposals", "clusters", "components", "edges",
            "cbo", "lcom", "loc", "cohesion", "coupling", "viability", "metrics", "complexity_avg",
            "complexity_max", "code_issues", "support_libraries", "project_metadata");

    private JsonNode unfiltered;
    private String minViability;

    @When("the agent invokes {string} with a valid path")
    @When("the agent invokes {string} with a valid project path")
    public void invokeWithValidPath(String tool) {
        Calls.success(tool, Support.demo("java-standar"), Map.of());
    }

    @Then("the response contains only REST endpoints and messaging schemas")
    public void onlyEndpointsAndSchemas() {
        JsonNode body = World.body;
        Set<String> keys = keys(body);
        assertTrue(Set.of("endpoints", "schemas", "meta").containsAll(keys), "unexpected sections: " + keys);
        assertTrue(keys.containsAll(Set.of("endpoints", "schemas")), keys.toString());
        // meta is the versioning envelope of the 1.0.0 contract (005), nothing else
        if (body.has("meta")) {
            assertEquals(Set.of("schema_version"), keys(body.get("meta")), body.get("meta").toString());
        }
        assertTrue(body.get("endpoints").size() > 0, "java-standar exposes REST endpoints");
        for (JsonNode endpoint : body.get("endpoints")) {
            assertFalse(endpoint.path("path").asText().isBlank(), endpoint.toString());
            assertFalse(endpoint.path("method").asText().isBlank(), endpoint.toString());
        }
        assertTrue(body.get("schemas").isObject());
        JsonNode graph = Calls.query("get_dependency_graph", Calls.args(World.project, null));
        assertEquals(graph.get("api_contracts"), body, "get_api_contracts must return the graph's contracts");
    }

    @Then("the response does not contain clustering or quality metrics")
    public void noClusteringOrMetrics() {
        List<String> found = new ArrayList<>();
        collectKeys(World.body, NOT_CONTRACT_KEYS, found);
        assertEquals(List.of(), found);
    }

    @When("the agent invokes {string} with a minimum viability of {string}")
    public void invokeWithMinViability(String tool, String viability) {
        Path project = Support.demo("jee-architecture-master");
        minViability = viability;
        unfiltered = Calls.query(tool, Calls.args(project, null));
        Calls.success(tool, project, Map.of("minViability", viability));
    }

    @Then("the response contains only proposals that meet or exceed {string} viability")
    public void onlyProposalsAtLeast(String viability) {
        assertEquals(minViability, viability);
        int min = VIABILITY.indexOf(viability);
        assertTrue(min >= 0, viability);
        JsonNode proposals = World.body.path("proposals");
        assertTrue(proposals.size() > 0, "jee-architecture-master has a proposal of viability " + viability);
        List<String> expected = new ArrayList<>();
        for (JsonNode p : unfiltered.path("proposals")) {
            if (VIABILITY.indexOf(p.path("viability").asText()) >= min) {
                expected.add(p.path("id").asText());
            }
        }
        List<String> actual = new ArrayList<>();
        for (JsonNode p : proposals) {
            assertTrue(VIABILITY.indexOf(p.path("viability").asText()) >= min, p.path("viability").asText());
            actual.add(p.path("id").asText());
        }
        assertEquals(expected, actual);
        assertTrue(unfiltered.path("proposals").size() > actual.size(), "the filter must have removed proposals");
    }

    @When("the agent invokes {string} with a valid component identifier")
    @When("the agent invokes {string} with a valid project path and component ID")
    public void invokeWithComponent(String tool) {
        Path project = Support.demo("legacy-erp");
        JsonNode graph = Calls.query("get_dependency_graph", Calls.args(project, null));
        TreeSet<String> candidates = new TreeSet<>();
        for (JsonNode c : graph.path("components")) {
            if (!c.path("lcom").isNull() && c.path("tables_used").size() > 0) {
                candidates.add(c.path("id").asText());
            }
        }
        assertFalse(candidates.isEmpty(), "legacy-erp has a component with LCOM and tables");
        World.componentId = candidates.first();
        World.argument = graph.toString();
        Calls.success(tool, project, Map.of("componentId", World.componentId));
    }

    @Then("the response contains CBO, LCOM, layer, and tables for that component")
    public void componentMetrics() {
        JsonNode body = World.body;
        assertEquals(World.componentId, body.path("id").asText());
        JsonNode expected = null;
        for (JsonNode c : Support.parse(World.argument).path("components")) {
            if (World.componentId.equals(c.path("id").asText())) {
                expected = c;
            }
        }
        assertNotNull(expected);
        assertTrue(body.path("cbo").isIntegralNumber(), body.toString());
        assertTrue(body.path("lcom").isNumber(), body.toString());
        assertFalse(body.path("layer").asText().isBlank(), body.toString());
        assertTrue(body.path("tables_used").isArray() && body.path("tables_used").size() > 0, body.toString());
        for (String field : List.of("cbo", "lcom", "layer", "tables_used")) {
            assertEquals(expected.get(field), body.get(field), field);
        }
    }

    @Then("the response contains {string} as a list")
    public void containsList(String field) {
        JsonNode value = World.body.get(field);
        assertTrue(value != null && value.isArray(), field + " in " + keys(World.body));
        assertTrue(value.size() > 0, field + " is empty");
    }

    @Then("the response contains {string} as a map")
    public void containsMap(String field) {
        JsonNode value = World.body.get(field);
        assertTrue(value != null && value.isObject(), field + " in " + keys(World.body));
    }

    @Then("the response contains {string}")
    public void containsField(String field) {
        JsonNode value = World.body.get(field);
        assertTrue(value != null && !value.isNull(), field + " in " + keys(World.body));
        assertFalse(value.isContainerNode() && value.isEmpty(), field + " is empty");
    }

    @Then("^the response contains (\"[^\"]+\"(?:, \"[^\"]+\")+)$")
    public void containsFields(String list) {
        Matcher m = Pattern.compile("\"([^\"]+)\"").matcher(list);
        while (m.find()) {
            String field = m.group(1);
            assertTrue(World.body.has(field), field + " in " + keys(World.body));
            assertFalse(World.body.get(field).isNull(), field + " is null");
        }
        assertEquals(World.componentId, World.body.path("id").asText());
    }

    @When("the agent invokes {string} with a non-existent component ID")
    public void invokeWithUnknownComponent(String tool) {
        Path project = Support.demo("legacy-erp");
        World.argument = Calls.query("get_dependency_graph", Calls.args(project, null)).toString();
        World.componentId = "com.acme.erp.DoesNotExist" + System.nanoTime();
        Map<String, Object> args = Calls.args(project, null);
        args.put("componentId", World.componentId);
        Calls.call(tool, args);
    }

    @Then("the error message contains the component ID and lists available components")
    public void errorListsComponents() {
        String text = Support.text(World.response);
        assertTrue(text.contains(World.componentId), text);
        JsonNode components = Support.parse(World.argument).path("components");
        assertTrue(components.size() > 0);
        for (JsonNode c : components) {
            assertTrue(text.contains(c.path("id").asText()), c.path("id").asText() + " not listed in: " + text);
        }
    }

    private static Set<String> keys(JsonNode node) {
        Set<String> keys = new TreeSet<>();
        node.fieldNames().forEachRemaining(keys::add);
        return keys;
    }

    private static void collectKeys(JsonNode node, Set<String> forbidden, List<String> found) {
        if (node.isObject()) {
            for (Iterator<Map.Entry<String, JsonNode>> it = node.fields(); it.hasNext();) {
                Map.Entry<String, JsonNode> e = it.next();
                if (forbidden.contains(e.getKey())) {
                    found.add(e.getKey());
                }
                collectKeys(e.getValue(), forbidden, found);
            }
        } else if (node.isArray()) {
            node.forEach(child -> collectKeys(child, forbidden, found));
        }
    }
}
