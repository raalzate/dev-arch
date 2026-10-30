package com.extractor.desktopbdd;

import com.extractor.inference.ConsolidatedArchitecture;
import com.extractor.inference.LegacyEntrypoint;
import com.extractor.inference.MicroserviceProposal;
import com.extractor.inference.config.InferenceConfig;
import com.extractor.model.Component;
import com.extractor.model.DependencyGraph;
import com.extractor.service.InferenceInput;
import com.extractor.service.InferenceService;
import io.cucumber.datatable.DataTable;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** TS-020, TS-021: batch entry points of proposals (021). Configuration and bridge steps come from storedprocsbdd. */
public class DesktopIdentitySteps {

    private DependencyGraph graph;
    private ConsolidatedArchitecture architecture;
    private LegacyEntrypoint entrypoint;

    @Given("a dependency graph with the annotated components:")
    public void annotatedGraph(DataTable table) {
        List<Component> components = new ArrayList<>();
        for (Map<String, String> row : table.asMaps()) {
            Component c = new Component(row.get("id"));
            c.setLayer(row.get("layer"));
            c.setDomain(row.get("id").substring(0, row.get("id").lastIndexOf('.')));
            c.setLoc(30);
            String annotations = row.get("annotations") == null ? "" : row.get("annotations");
            c.setAnnotations(new ArrayList<>(Arrays.stream(annotations.split(","))
                    .map(String::trim).filter(s -> !s.isEmpty()).toList()));
            components.add(c);
        }
        graph = new DependencyGraph(components, new ArrayList<>());
    }

    @When("the architecture is inferred with the default configuration")
    public void inferDefault() {
        architecture = new InferenceService().infer(new InferenceInput(graph, Map.of(), List.of()),
                InferenceConfig.defaults());
    }

    @Then("the proposal containing {string} has a legacy entry point of type {string}")
    public void entryPointType(String component, String type) {
        MicroserviceProposal proposal = architecture.getProposals().stream()
                .filter(p -> p.getComponentNames().contains(component)).findFirst()
                .orElseThrow(() -> new AssertionError(component + " is in no proposal"));
        entrypoint = proposal.getLegacyEntrypoint();
        assertNotNull(entrypoint, "proposal " + proposal.getName() + " has no legacy entry point");
        assertEquals(type, entrypoint.getType());
    }

    @Then("that entry point names {string} as primary entry class")
    public void primaryEntryClass(String id) {
        assertEquals(id, entrypoint.getPrimaryEntryClass());
    }

    @Then("that entry point has no primary entry class")
    public void noPrimaryEntryClass() {
        assertNull(entrypoint.getPrimaryEntryClass());
    }

    @Then("that entry point exposes exactly the operations {string}")
    public void exposedOperations(String csv) {
        assertEquals(Arrays.stream(csv.split(",")).map(String::trim).toList(), entrypoint.getExposedOperations());
    }

    @Then("that entry point description contains {string}")
    public void descriptionContains(String text) {
        assertTrue(entrypoint.getDescription() != null && entrypoint.getDescription().contains(text),
                "description was: " + entrypoint.getDescription());
    }
}
