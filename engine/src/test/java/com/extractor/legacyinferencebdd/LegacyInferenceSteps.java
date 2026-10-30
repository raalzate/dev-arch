package com.extractor.legacyinferencebdd;

import com.extractor.inference.ConsolidatedArchitecture;
import com.extractor.inference.DebtIndex;
import com.extractor.inference.MicroserviceProposal;
import com.extractor.inference.config.InferenceConfigLoader;
import com.extractor.model.CodeIssue;
import com.extractor.model.Component;
import com.extractor.model.DependencyGraph;
import com.extractor.model.Edge;
import com.extractor.service.InferenceInput;
import com.extractor.service.InferenceService;
import com.extractor.service.ProposalScorer;
import com.extractor.storedprocsbdd.StoredProceduresSteps;
import com.extractor.testsupport.ProductLayout;
import io.cucumber.datatable.DataTable;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** TS-001..TS-014 of 023: preset, domain names, support libraries, debt index (engine side). */
public class LegacyInferenceSteps {

    private MicroserviceProposal lastProposal;
    private Double rememberedScore;
    private double debtIndex;

    // ------------------------------------------------------------------ graph

    @Given("a dependency graph from the table with source {string}:")
    public void graphFromTable(String source, DataTable table) {
        List<Component> components = new ArrayList<>();
        List<Edge> edges = new ArrayList<>();
        Map<String, Component> byId = new java.util.LinkedHashMap<>();
        for (Map<String, String> row : table.asMaps()) {
            String id = row.get("id").trim();
            Component c = new Component(id);
            c.setLayer(row.get("layer").trim());
            c.setDomain(id.contains(".") ? id.substring(0, id.lastIndexOf('.')) : "");
            c.setLoc(Integer.parseInt(row.get("loc").trim()));
            for (String f : split(row.get("files"), ",")) {
                c.addFile(f);
            }
            c.setTablesUsed(new ArrayList<>(split(row.get("tables_used"), ";")));
            c.setAnnotations(new ArrayList<>(split(row.get("annotations"), ",")));
            c.setCallsOut(new ArrayList<>(split(row.get("calls_out"), ",")));
            List<CodeIssue> issues = new ArrayList<>();
            for (String sev : split(row.get("issues"), ",")) {
                issues.add(issue(sev));
            }
            c.setCodeIssues(issues);
            components.add(c);
            byId.put(id, c);
        }
        for (Component c : components) {
            for (String to : c.getCallsOut()) {
                edges.add(new Edge(c.getId(), to, 1, "CALL"));
                Component target = byId.get(to);
                if (target != null) {
                    List<String> in = new ArrayList<>(target.getCallsIn() == null ? List.of() : target.getCallsIn());
                    in.add(c.getId());
                    target.setCallsIn(in);
                }
            }
        }
        DependencyGraph graph = new DependencyGraph(components, edges);
        DependencyGraph.Meta meta = new DependencyGraph.Meta();
        meta.setSource(source);
        graph.setMeta(meta);
        StoredProceduresSteps.graph = graph;
        StoredProceduresSteps.architecture = null;
        lastProposal = null;
    }

    private static List<String> split(String cell, String separator) {
        if (cell == null) {
            return List.of();
        }
        return Arrays.stream(cell.split(Pattern.quote(separator)))
                .map(String::trim).filter(s -> !s.isEmpty()).toList();
    }

    private static CodeIssue issue(String severity) {
        return new CodeIssue(CodeIssue.Type.CODE_STYLE, CodeIssue.Severity.valueOf(severity),
                severity + " issue", 1, "TEST_" + severity);
    }

    private static ConsolidatedArchitecture architecture() {
        assertNotNull(StoredProceduresSteps.architecture, "no architecture inferred yet");
        return StoredProceduresSteps.architecture;
    }

    private MicroserviceProposal proposalContaining(String component) {
        lastProposal = architecture().getProposals().stream()
                .filter(p -> p.getComponentNames().contains(component))
                .findFirst()
                .orElseThrow(() -> new AssertionError(component + " is in no proposal; proposals: " + describe()));
        return lastProposal;
    }

    private String describe() {
        StringBuilder sb = new StringBuilder();
        for (MicroserviceProposal p : architecture().getProposals()) {
            sb.append("\n  ").append(p.getId()).append(' ').append(p.getName()).append(' ')
                    .append(p.getComponentNames());
        }
        for (ConsolidatedArchitecture.SupportLibrary s : architecture().getSupportLibraries()) {
            sb.append("\n  support ").append(s.getId()).append(' ').append(s.getName()).append(' ')
                    .append(s.getComponentNames());
        }
        return sb.toString();
    }

    // ------------------------------------------------------------------ summary and names

    @Then("the architecture summary contains {string}")
    public void summaryContains(String text) {
        assertTrue(architecture().getSummary().contains(text),
                "summary must contain '" + text + "':\n" + architecture().getSummary());
    }

    @Then("the architecture summary does not contain {string}")
    public void summaryDoesNotContain(String text) {
        assertFalse(architecture().getSummary().contains(text),
                "summary must not contain '" + text + "':\n" + architecture().getSummary());
    }

    @Then("no proposal rationale starts with {string}")
    public void noRationaleStartsWith(String prefix) {
        for (MicroserviceProposal p : architecture().getProposals()) {
            for (String line : p.getRationale()) {
                assertFalse(line.startsWith(prefix), p.getName() + " has rationale line '" + line + "'");
            }
        }
    }

    @Then("the proposal containing {string} is named {string}")
    public void proposalNamed(String component, String name) {
        assertEquals(name, proposalContaining(component).getName(), "proposals: " + describe());
    }

    @Then("{string} belongs to a support library, not to a proposal")
    public void belongsToSupport(String component) {
        boolean inProposal = architecture().getProposals().stream()
                .anyMatch(p -> p.getComponentNames().contains(component));
        boolean inSupport = architecture().getSupportLibraries().stream()
                .anyMatch(s -> s.getComponentNames().contains(component));
        assertFalse(inProposal, component + " must not be in a proposal: " + describe());
        assertTrue(inSupport, component + " must be in a support library: " + describe());
    }

    @Then("the proposal containing {string} also contains {string}")
    public void alsoContains(String component, String other) {
        MicroserviceProposal p = proposalContaining(component);
        assertTrue(p.getComponentNames().contains(other),
                p.getName() + " must contain " + other + ": " + describe());
    }

    @Then("that proposal has a cohesion computed without presentation members")
    public void cohesionWithoutPresentation() {
        MicroserviceProposal p = lastProposal;
        assertNotNull(p, "no proposal selected");
        double without = p.getMetrics().getCohesionAvg();
        // Same graph and configuration but counting the presentation members.
        String json = StoredProceduresSteps.lastConfigJson == null ? "{}" : StoredProceduresSteps.lastConfigJson;
        com.fasterxml.jackson.databind.node.ObjectNode tree = (com.fasterxml.jackson.databind.node.ObjectNode)
                readTree(json);
        tree.with("inference").put("presentationInCohesion", true);
        ConsolidatedArchitecture with = new InferenceService().infer(
                new InferenceInput(StoredProceduresSteps.graph, Map.of(), List.of()),
                InferenceConfigLoader.fromJson(tree));
        MicroserviceProposal same = with.getProposals().stream()
                .filter(q -> q.getComponentNames().containsAll(p.getComponentNames()))
                .findFirst().orElseThrow(() -> new AssertionError("proposal not found when counting presentation"));
        assertNotEquals(same.getMetrics().getCohesionAvg(), without,
                "cohesion must differ when presentation members are excluded (" + without + ")");
    }

    private static com.fasterxml.jackson.databind.JsonNode readTree(String json) {
        try {
            return new com.fasterxml.jackson.databind.ObjectMapper().readTree(json);
        } catch (IOException e) {
            throw new IllegalArgumentException(e);
        }
    }

    // ------------------------------------------------------------------ debt

    @Then("the proposal containing {string} has a rationale line matching {string}")
    public void rationaleMatching(String component, String regex) {
        MicroserviceProposal p = proposalContaining(component);
        Pattern pattern = Pattern.compile(regex);
        assertTrue(p.getRationale().stream().anyMatch(l -> pattern.matcher(l).matches()),
                "no rationale line matches " + regex + ": " + p.getRationale());
    }

    @Then("that proposal has a rationale line starting with {string}")
    public void rationaleStartingWith(String prefix) {
        assertNotNull(lastProposal, "no proposal selected");
        assertTrue(lastProposal.getRationale().stream().anyMatch(l -> l.startsWith(prefix)),
                "no rationale line starts with '" + prefix + "': " + lastProposal.getRationale());
    }

    @When("the viability score of the proposal containing {string} is remembered")
    public void rememberScore(String component) {
        rememberedScore = scoreOf(component);
    }

    @Then("the viability score of the proposal containing {string} is lower than remembered")
    public void scoreLower(String component) {
        assertNotNull(rememberedScore, "no score remembered");
        double now = scoreOf(component);
        assertTrue(now < rememberedScore, "score " + now + " must be lower than " + rememberedScore);
    }

    /** Score of the proposal through the proposal scorer with the last configuration (008 tool). */
    private double scoreOf(String component) {
        MicroserviceProposal p = proposalContaining(component);
        String json = StoredProceduresSteps.lastConfigJson == null ? "{}" : StoredProceduresSteps.lastConfigJson;
        return new ProposalScorer().score(StoredProceduresSteps.graph, p.getComponentNames(),
                InferenceConfigLoader.fromText(json)).score();
    }

    @When("the debt index is computed for a component with loc {int}, issues {string}, {int} end-of-life dependencies and complexity max {int}")
    public void computeDebt(int loc, String issues, int eol, int cc) {
        Component c = new Component("Acme.Debt.Sample");
        c.setLoc(loc);
        List<CodeIssue> list = new ArrayList<>();
        for (String sev : split(issues, ",")) {
            list.add(issue(sev));
        }
        c.setCodeIssues(list);
        List<String> annotations = new ArrayList<>();
        for (int i = 0; i < eol; i++) {
            annotations.add(DebtIndex.EOL_PREFIX + "Legacy.Dependency" + i);
        }
        c.setAnnotations(annotations);
        c.setComplexityMax(cc);
        debtIndex = DebtIndex.of(c);
    }

    @Then("the debt index is {double}")
    public void debtIndexIs(double expected) {
        assertEquals(expected, debtIndex, 0.0005);
    }

    // ------------------------------------------------------------------ docs

    @Then("the product document {string} mentions each of:")
    public void documentMentions(String document, DataTable table) throws IOException {
        Path doc = ProductLayout.get().productRoot().resolve(document);
        assertTrue(Files.exists(doc), doc + " must exist");
        String content = Files.readString(doc);
        List<String> missing = new ArrayList<>();
        for (Map<String, String> row : table.asMaps()) {
            if (!content.contains(row.get("text"))) {
                missing.add(row.get("text"));
            }
        }
        assertEquals(List.of(), missing, "texts missing in " + document);
    }
}
