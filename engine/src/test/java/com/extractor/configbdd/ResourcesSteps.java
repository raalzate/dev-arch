package com.extractor.configbdd;

import com.extractor.inference.config.InferenceConfig;
import com.extractor.inference.config.InferenceConfigLoader;
import com.extractor.mcp.McpResources;
import com.extractor.testsupport.ProductLayout;
import com.fasterxml.jackson.databind.JsonNode;
import io.cucumber.datatable.DataTable;
import io.cucumber.java.After;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import io.modelcontextprotocol.server.McpServerFeatures;
import org.junit.jupiter.api.Assumptions;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Steps of resources.feature (US5, TS-029..TS-032). */
public class ResourcesSteps {

    private List<McpServerFeatures.SyncResourceSpecification> registry;
    private final Map<String, String> contents = new HashMap<>();
    private StdioMcp stdio;
    private JsonNode response;

    @After
    public void stop() {
        if (stdio != null) {
            stdio.close();
        }
    }

    @Given("the server-mode resource registry")
    public void registry() {
        registry = McpResources.specs();
    }

    @Then("it lists the resources:")
    public void listsResources(DataTable table) {
        List<List<String>> expected = new ArrayList<>(table.asLists().subList(1, table.height()));
        List<List<String>> actual = registry.stream()
                .map(s -> List.of(s.resource().uri(), s.resource().mimeType())).toList();
        assertEquals(expected, actual);
    }

    @Then("every listed resource has a name and a description")
    public void namesAndDescriptions() {
        registry.forEach(s -> {
            assertFalse(s.resource().name() == null || s.resource().name().isBlank());
            assertFalse(s.resource().description() == null || s.resource().description().isBlank());
        });
    }

    @When("each resource is read")
    public void readEach() {
        registry.forEach(s -> contents.put(s.resource().uri(), McpResources.read(s.resource().uri())));
    }

    private static String productFile(String relative) throws Exception {
        return Files.readString(ProductLayout.get().productRoot().resolve(relative), StandardCharsets.UTF_8);
    }

    @Then("{string} is byte-identical to {string}")
    public void identicalTo(String uri, String file) throws Exception {
        assertEquals(productFile(file), contents.get(uri));
    }

    @Then("{string} equals the default inference configuration applied by the engine")
    public void defaultsResource(String uri) {
        assertEquals(InferenceConfig.defaults(), InferenceConfigLoader.fromText(contents.get(uri)));
    }

    @Then("{string} declares schema_version {string} and contains every schema file of {string}")
    public void schemaBundle(String uri, String version, String dir) throws Exception {
        JsonNode bundle = Support.json(contents.get(uri));
        assertEquals(version, bundle.path("schema_version").asText());
        Path root = ProductLayout.get().productRoot().resolve(dir);
        List<String> files;
        try (Stream<Path> walk = Files.walk(root)) {
            files = walk.filter(p -> p.toString().endsWith(".schema.json"))
                    .map(p -> root.relativize(p).toString().replace('\\', '/')).sorted().toList();
        }
        List<String> listed = new ArrayList<>();
        bundle.path("schemas").fieldNames().forEachRemaining(listed::add);
        assertEquals(files, listed);
        for (String f : files) {
            assertEquals(Support.json(Files.readString(root.resolve(f))), bundle.path("schemas").path(f), f);
        }
    }

    @Given("the server mode started over stdio")
    public void stdioServer() throws Exception {
        stdio = StdioMcp.classpath();
    }

    @Given("the server mode started over stdio from the packaged engine archive")
    public void stdioJar() throws Exception {
        Path jar = ProductLayout.get().engineRoot().resolve("target/java-dependency-extractor.jar");
        Assumptions.assumeTrue(Files.isRegularFile(jar), "engine archive not built: " + jar);
        stdio = StdioMcp.jar(jar);
    }

    @When("the resource {string} is read")
    public void readOverStdio(String uri) throws Exception {
        response = stdio.request("resources/read", "{\"uri\":\"" + uri + "\"}");
    }

    @Then("the response is an error whose message contains {string}")
    public void errorResponse(String text) {
        assertTrue(response.has("error"), response.toString());
        assertTrue(response.path("error").path("message").asText().contains(text), response.toString());
    }

    @Then("its text is byte-identical to {string}")
    public void textIdentical(String file) throws Exception {
        assertEquals(productFile(file), response.path("result").path("contents").get(0).path("text").asText());
    }
}
