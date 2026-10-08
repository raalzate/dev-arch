package com.extractor.configbdd;

import com.extractor.inference.Cluster;
import com.extractor.inference.InferenceEngine;
import com.extractor.schema.SchemaRegistry;
import com.extractor.service.GraphSource;
import com.fasterxml.jackson.databind.JsonNode;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import io.modelcontextprotocol.spec.McpSchema;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Steps of score-proposal.feature (US4, TS-023..TS-028). */
public class ScoreProposalSteps {

    private final List<JsonNode> scoredProposals = new ArrayList<>();
    private List<String> mergedList;
    private Map<String, String> filesBefore;

    private static Map<String, String> files() throws Exception {
        Map<String, String> out = new HashMap<>();
        try (Stream<Path> walk = Files.walk(World.stored)) {
            for (Path p : walk.filter(Files::isRegularFile).toList()) {
                out.put(p.toString(), Files.readString(p));
            }
        }
        return out;
    }

    @When("score_proposal is called with the components of every stored proposal that has no filtered infrastructure component")
    public void scoreEligible() throws Exception {
        List<Cluster> clusters = new InferenceEngine().analyze(GraphSource.fromPath(World.graphPath).graph())
                .getCandidates();
        for (JsonNode p : Support.json(World.storedArchitecture).path("proposals")) {
            Set<String> members = new HashSet<>();
            p.path("clusters").forEach(id -> clusters.stream().filter(c -> c.getClusterId() == id.asInt())
                    .forEach(c -> members.addAll(c.getMembers())));
            List<String> components = new ArrayList<>();
            p.path("components").forEach(c -> components.add(c.asText()));
            if (members.equals(new HashSet<>(components))) {
                McpSchema.CallToolResult r = Support.score(components, null);
                assertFalse(Support.isError(r), Support.text(r));
                scoredProposals.add(p);
            }
        }
    }

    @Then("each response has the viability and the rationale of its proposal")
    public void sameViabilityAndRationale() {
        assertEquals(scoredProposals.size(), World.results.size());
        for (int i = 0; i < scoredProposals.size(); i++) {
            JsonNode expected = scoredProposals.get(i);
            JsonNode actual = Support.json(Support.text(World.results.get(i)));
            assertEquals(expected.path("viability"), actual.path("viability"), expected.path("name").asText());
            assertEquals(expected.path("rationale"), actual.path("rationale"), expected.path("name").asText());
        }
    }

    @Then("at least one proposal was scored")
    public void atLeastOneScored() {
        assertTrue(!scoredProposals.isEmpty());
    }

    @When("score_proposal is called with the components of the first two stored proposals merged into one list")
    public void scoreMerged() {
        List<List<String>> proposals = Support.storedProposalComponents();
        mergedList = new ArrayList<>(proposals.get(0));
        mergedList.addAll(proposals.get(1));
        assertFalse(Support.isError(Support.score(mergedList, null)), Support.text(World.result));
    }

    @Then("the response validates against the score_proposal response schema")
    public void validatesScore() {
        assertEquals(List.of(), SchemaRegistry.get().validate("mcp/score_proposal.response",
                Support.text(World.result)));
    }

    @Then("the response has a name, a viability, a score, the metrics cohesion_adjusted, external_coupling, data_cohesion, internal_edge_density, size and cluster_count, the components, the clusters, a rationale and recommended actions")
    public void completeEvaluation() {
        JsonNode r = Support.json(Support.text(World.result));
        assertFalse(r.path("name").asText().isBlank());
        assertTrue(List.of("Alta", "Media", "Baja").contains(r.path("viability").asText()));
        assertTrue(r.path("score").isNumber());
        for (String m : List.of("cohesion_adjusted", "external_coupling", "data_cohesion", "internal_edge_density",
                "size", "cluster_count")) {
            assertTrue(r.path("metrics").path(m).isNumber(), m);
        }
        assertTrue(r.path("components").size() > 0);
        assertTrue(r.path("clusters").size() > 0);
        assertTrue(r.path("rationale").size() > 0);
        assertTrue(r.path("recommended_actions").size() > 0);
    }

    @Then("the response components are the sorted union of both proposals")
    public void sortedUnion() {
        List<String> actual = new ArrayList<>();
        Support.json(Support.text(World.result)).path("components").forEach(c -> actual.add(c.asText()));
        assertEquals(new ArrayList<>(new TreeSet<>(mergedList)), actual);
    }

    @When("score_proposal is called with the components {string}, {string} and one existing component")
    public void scoreUnknown(String a, String b) {
        Support.score(List.of(a, b, Support.storedProposalComponents().get(0).get(0)), null);
    }

    @When("score_proposal is called with no components")
    public void scoreEmpty() {
        Support.score(List.of(), null);
    }

    @When("score_proposal is called with the components of the first stored proposal, each listed twice")
    public void scoreTwiceListed() {
        List<String> once = Support.storedProposalComponents().get(0);
        List<String> twice = new ArrayList<>(once);
        twice.addAll(once);
        assertFalse(Support.isError(Support.score(twice, null)), Support.text(World.result));
    }

    @Then("the response is identical to scoring the components of the first stored proposal once")
    public void identicalToOnce() {
        String twice = Support.text(World.result);
        assertEquals(Support.text(Support.score(Support.storedProposalComponents().get(0), null)), twice);
    }

    @When("^score_proposal is called with the components of the first stored proposal and the configuration (\\{.*\\})$")
    public void scoreWithConfig(String config) {
        assertFalse(Support.isError(Support.score(Support.storedProposalComponents().get(0), config)),
                Support.text(World.result));
    }

    @Then("the response viability is {string}")
    public void responseViability(String viability) {
        assertEquals(viability, Support.json(Support.text(World.result)).path("viability").asText());
    }

    @When("score_proposal is called twice with the components of the first stored proposal")
    public void scoreTwice() throws Exception {
        filesBefore = files();
        Support.score(Support.storedProposalComponents().get(0), null);
        Support.score(Support.storedProposalComponents().get(0), null);
    }

    @Then("the files of the stored analysis are unchanged")
    public void filesUnchanged() throws Exception {
        assertEquals(filesBefore, files());
    }
}
