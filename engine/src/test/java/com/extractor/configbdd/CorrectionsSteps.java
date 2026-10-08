package com.extractor.configbdd;

import com.extractor.inference.Cluster;
import com.extractor.inference.ClusterConsolidator;
import com.extractor.inference.InferenceEngine;
import com.extractor.model.DependencyGraph;
import com.extractor.service.GraphSource;
import com.extractor.testsupport.SyntheticGraph;
import com.fasterxml.jackson.databind.JsonNode;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Steps of corrections.feature (US7, TS-039..TS-047). */
public class CorrectionsSteps {

    private DependencyGraph graph;
    private List<Cluster> clusters;
    private ClusterConsolidator consolidator;
    private final List<String> architectures = new ArrayList<>();

    private static JsonNode response() {
        return Support.json(Support.text(World.result));
    }

    @Then("the proposal grouping cluster {int} reports data_jaccard {double}")
    public void dataJaccardOfCluster(int cluster, double value) {
        boolean found = false;
        for (JsonNode p : response().path("proposals")) {
            List<Integer> ids = new ArrayList<>();
            p.path("clusters").forEach(c -> ids.add(c.asInt()));
            if (ids.contains(cluster)) {
                assertEquals(value, p.path("metrics").path("data_jaccard").asDouble());
                found = true;
            }
        }
        assertTrue(found, "no proposal groups cluster " + cluster);
    }

    @Then("no proposal reports data_jaccard {double}")
    public void noDataJaccard(double value) {
        response().path("proposals")
                .forEach(p -> assertNotEquals(value, p.path("metrics").path("data_jaccard").asDouble()));
    }

    @Then("there is no support library named {string}")
    public void noSupportLibrary(String name) {
        response().path("support_libraries").forEach(l -> assertNotEquals(name, l.path("name").asText()));
    }

    @Then("the proposals together contain all {int} components of the graph")
    public void allComponents(int count) {
        Set<String> ids = new HashSet<>();
        response().path("proposals").forEach(p -> p.path("components").forEach(c -> ids.add(c.asText())));
        assertEquals(count, ids.size());
        assertEquals(count, response().path("project_metadata").path("total_components").asInt());
    }

    @Given("the dependency graph {string}")
    public void theGraph(String name) {
        graph = name.startsWith("demo ")
                ? GraphSource.fromPath(Support.store(name.substring("demo ".length()), true)).graph()
                : SyntheticGraph.build();
    }

    @When("its clusters are consolidated with the default configuration")
    public void consolidate() {
        clusters = new InferenceEngine().analyze(graph).getCandidates();
        consolidator = new ClusterConsolidator(clusters, graph.getComponents());
        consolidator.consolidate();
    }

    @Then("every source cluster of every consolidated group has the same support-library status as the root cluster of its group")
    public void sameStatusAsRoot() {
        Map<Integer, Set<Integer>> groups = consolidator.groupsByRoot();
        assertFalse(groups.isEmpty());
        groups.forEach((root, group) -> group.forEach(id -> assertEquals(consolidator.isSupportCluster(root),
                consolidator.isSupportCluster(id), "cluster " + id + " of root " + root)));
    }

    @Then("the support-library status of every consolidated group computed over all its members equals that of its root cluster")
    public void groupStatusEqualsRoot() {
        consolidator.groupsByRoot().forEach((root, group) -> assertEquals(consolidator.isSupportCluster(root),
                consolidator.isSupportGroup(group), "group of root " + root));
    }

    @Then("^the proposals group the clusters (\\[.*\\]), (\\[.*\\]) and (\\[.*\\]) separately$")
    public void groupsSeparately(String a, String b, String c) {
        assertEquals(List.of(compact(a), compact(b), compact(c)), clusterLists());
    }

    @Then("^there is exactly one proposal and it groups the clusters (\\[.*\\])$")
    public void exactlyOne(String ids) {
        assertEquals(List.of(compact(ids)), clusterLists());
    }

    private static String compact(String list) {
        return list.replace(" ", "");
    }

    private static List<String> clusterLists() {
        List<String> out = new ArrayList<>();
        response().path("proposals").forEach(p -> {
            List<Integer> ids = new ArrayList<>();
            p.path("clusters").forEach(c -> ids.add(c.asInt()));
            out.add(new TreeSet<>(ids).toString().replace(" ", ""));
        });
        return out;
    }

    @Then("no proposal name contains {string}")
    public void noName(String text) {
        JsonNode proposals = response().path("proposals");
        assertTrue(proposals.size() > 0);
        proposals.forEach(p -> assertFalse(p.path("name").asText().contains(text), p.path("name").asText()));
    }

    @When("it is re-inferred with {string} = {double} and with the default configuration")
    public void reinferBoth(String parameter, double value) {
        com.fasterxml.jackson.databind.node.ObjectNode config = Support.MAPPER.createObjectNode();
        Support.put(config, parameter, value);
        Support.reinfer(World.graphPath, config.toString(), null);
        assertFalse(Support.isError(World.result), Support.text(World.result));
        architectures.add(Support.text(World.result));
        Support.reinfer(World.graphPath, null, null);
        assertFalse(Support.isError(World.result), Support.text(World.result));
        architectures.add(Support.text(World.result));
    }

    @Then("the two architectures group the components differently")
    public void groupedDifferently() {
        assertNotEquals(components(architectures.get(0)), components(architectures.get(1)));
    }

    private static Set<Set<String>> components(String architecture) {
        Set<Set<String>> out = new HashSet<>();
        JsonNode a = Support.json(architecture);
        a.path("proposals").forEach(p -> {
            Set<String> ids = new TreeSet<>();
            p.path("components").forEach(c -> ids.add(c.asText()));
            out.add(ids);
        });
        return out;
    }
}
