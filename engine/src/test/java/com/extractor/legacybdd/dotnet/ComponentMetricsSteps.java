package com.extractor.legacybdd.dotnet;

import com.extractor.mcp.McpCalls;
import com.extractor.schema.DemoOutputs;
import com.extractor.schema.SchemaRegistry;
import com.extractor.service.AnalysisService;
import com.extractor.testsupport.RegressionBaselines;
import com.fasterxml.jackson.databind.JsonNode;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Steps of {@code component-metrics.feature} (US-004). */
public class ComponentMetricsSteps {

    /** Fixture with one class per architectural layer. */
    private static final String LAYERS_FIXTURE = "layers";

    /**
     * Example rows → classes of the {@code layers} fixture and the source fragment that makes each class match
     * the row description.
     */
    private static final Map<String, Map<String, String>> COMPONENTS_BY_TYPE = Map.of(
            "ASP.NET Core controller with [ApiController]",
            Map.of("Catalog.Controllers.BooksController", "[ApiController]"),
            "Business service class (*Service)",
            Map.of("Catalog.Services.BookService", "class BookService"),
            "Repository or DbContext class",
            Map.of("Catalog.Data.BookRepository", "class BookRepository",
                    "Catalog.Data.CatalogDbContext", ": DbContext"),
            "Helper or Extensions class",
            Map.of("Catalog.Common.TitleHelper", "class TitleHelper",
                    "Catalog.Common.StringExtensions", "class StringExtensions"));

    // ---------------------------------------------------------------- TS-031

    @Given("a .NET component that has been analyzed")
    public void aDotNetComponentThatHasBeenAnalyzed() {
        LegacyDotnet.requireAnalyzer();
        LegacyWorld.project = LegacyDotnet.demo(DotnetAnalysisSteps.DOTNET_DEMO);
        LegacyWorld.run = LegacyDotnet.engine(LegacyWorld.project);
        String componentId = null;
        for (JsonNode component : LegacyWorld.run.graph().path("components")) {
            if (!component.path("is_interface").asBoolean() && !component.path("tables_used").isEmpty()
                    && "Datos".equals(component.path("layer").asText())) {
                componentId = component.path("id").asText();
                break;
            }
        }
        assertTrue(componentId != null, "no data-layer component with tables in " + LegacyWorld.project);
        LegacyWorld.data.put("componentId", componentId);
    }

    @When("{string} is invoked for that component")
    public void isInvokedForThatComponent(String tool) {
        String componentId = LegacyWorld.get("componentId");
        McpCalls.Response response = new McpCalls(new AnalysisService()).call(tool,
                Map.of("projectPath", LegacyWorld.project.toString(), "componentId", componentId));
        assertFalse(response.error(), tool + " failed: " + response.text());
        LegacyWorld.data.put("tool", tool);
        LegacyWorld.data.put("metricsText", response.text());
    }

    @Then("the result contains {string}, {string}, {string}, {string}, and {string} fields")
    public void theResultContainsFields(String cbo, String lcom, String loc, String layer, String tables) {
        JsonNode metrics = LegacyDotnet.json(LegacyWorld.<String>get("metricsText"));
        assertEquals(LegacyWorld.<String>get("componentId"), metrics.path("id").asText(), "component id");
        assertTrue(metrics.path(cbo).isInt(), cbo + ": " + metrics.path(cbo));
        assertTrue(metrics.path(lcom).isNumber(), lcom + ": " + metrics.path(lcom));
        assertTrue(metrics.path(loc).isInt() && metrics.path(loc).asInt() > 0, loc + ": " + metrics.path(loc));
        assertTrue(Set.of("Controlador", "Negocio", "Datos", "Compartida").contains(metrics.path(layer).asText()),
                layer + ": " + metrics.path(layer));
        assertTrue(metrics.path(tables).isArray() && !metrics.path(tables).isEmpty(),
                tables + ": " + metrics.path(tables));
        JsonNode analyzed = LegacyWorld.run.component(metrics.path("id").asText());
        for (String field : List.of(cbo, lcom, loc, layer, tables)) {
            assertEquals(analyzed.path(field), metrics.path(field), field + " of the tool vs the dependency graph");
        }
    }

    @Then("the schema matches the schema used for Java components")
    public void theSchemaMatchesTheJavaSchema() {
        String tool = LegacyWorld.get("tool");
        String dotnetText = LegacyWorld.get("metricsText");
        LegacyDotnet.assertValid("mcp/" + tool + ".response", dotnetText, ".NET " + tool);
        LegacyDotnet.assertValid(SchemaRegistry.COMPONENT, dotnetText, ".NET component");

        Path javaProject = LegacyDotnet.demo("java-standar");
        JsonNode javaGraph = LegacyDotnet.json(RegressionBaselines.load("java-standar").get(DemoOutputs.GRAPH));
        String javaId = null;
        for (JsonNode component : javaGraph.path("components")) {
            if (component.path("cbo").isInt() && component.path("lcom").isNumber()) {
                javaId = component.path("id").asText();
                break;
            }
        }
        assertTrue(javaId != null, "no Java component with metrics in the stored reference");
        McpCalls.Response java = new McpCalls(new AnalysisService()).call(tool,
                Map.of("projectPath", javaProject.toString(), "componentId", javaId));
        assertFalse(java.error(), tool + " failed for Java: " + java.text());
        LegacyDotnet.assertValid("mcp/" + tool + ".response", java.text(), "Java " + tool);

        JsonNode dotnet = LegacyDotnet.json(dotnetText);
        JsonNode javaComponent = LegacyDotnet.json(java.text());
        assertEquals(DotnetAnalysisSteps.fieldNames(javaComponent), DotnetAnalysisSteps.fieldNames(dotnet),
                "properties of the Java and .NET component metrics");
        for (String field : List.of("cbo", "lcom", "loc", "layer", "tables_used")) {
            assertEquals(javaComponent.path(field).getNodeType(), dotnet.path(field).getNodeType(),
                    "JSON type of " + field);
        }
    }

    // ---------------------------------------------------------------- TS-032

    @Given("a .NET component identified as {string}")
    public void aDotNetComponentIdentifiedAs(String componentType) {
        LegacyDotnet.requireAnalyzer();
        Map<String, String> components = COMPONENTS_BY_TYPE.get(componentType);
        assertTrue(components != null, "no fixture component for '" + componentType + "'");
        Path project = LegacyDotnet.fixture(LAYERS_FIXTURE);
        for (Map.Entry<String, String> entry : components.entrySet()) {
            String simple = DotnetAnalysisSteps.simpleName(entry.getKey());
            List<Path> files = LegacyDotnet.sources(project, ".cs").stream()
                    .filter(p -> p.getFileName().toString().equals(simple + ".cs")).toList();
            assertEquals(1, files.size(), "source of " + entry.getKey());
            assertTrue(LegacyDotnet.read(files.get(0)).contains(entry.getValue()),
                    entry.getKey() + " must contain " + entry.getValue());
        }
        LegacyWorld.project = project;
        LegacyWorld.data.put("layerComponents", components.keySet());
    }

    @When("the layer classifier processes it")
    public void theLayerClassifierProcessesIt() {
        LegacyWorld.run = LegacyDotnet.engine(LegacyWorld.project);
    }

    @Then("the component is assigned to the {string} layer")
    public void theComponentIsAssignedToTheLayer(String layer) {
        Set<String> components = LegacyWorld.get("layerComponents");
        for (String id : components) {
            assertEquals(layer, LegacyWorld.run.component(id).path("layer").asText(), "layer of " + id);
        }
    }
}
