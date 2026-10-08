package com.extractor.testsupport;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Locating rules of the dev-arch product layout used by the engine tests (006-devarch-monorepo, research D3):
 * explicit property &gt; upward search &gt; error naming the property.
 */
class ProductLayoutTest {

    @TempDir
    Path tmp;

    private Path monorepo;
    private Path product;
    private Path engine;
    private final Map<String, String> props = new HashMap<>();

    @BeforeEach
    void createLayout() throws IOException {
        monorepo = tmp.resolve("mono repo");
        product = monorepo.resolve("apps").resolve("dev-arch");
        engine = product.resolve("engine");
        Files.createDirectories(engine.resolve("src/test/dotnet"));
        Files.writeString(engine.resolve("pom.xml"), "<project/>");
        Files.createDirectories(product.resolve("schema"));
        Files.writeString(product.resolve("schema/VERSION"), "1.0.0\n");
    }

    private ProductLayout layout(Path userDir) {
        return new ProductLayout(props::get, userDir);
    }

    @Test
    void engineRoot_isFoundUpwardsFromTheWorkingDirectory() throws IOException {
        Path nested = Files.createDirectories(engine.resolve("src/test/java"));
        assertEquals(engine, layout(nested).engineRoot());
        assertEquals(engine, layout(engine).engineRoot());
    }

    @Test
    void productRoot_isTheFirstAncestorHoldingSchemaVersion() {
        assertEquals(product, layout(engine).productRoot());
    }

    @Test
    void explicitProperties_winOverTheUpwardSearch() throws IOException {
        Path otherEngine = Files.createDirectories(tmp.resolve("other-engine"));
        Path otherProduct = Files.createDirectories(tmp.resolve("other-product"));
        props.put(ProductLayout.ENGINE_ROOT_PROPERTY, otherEngine.toString());
        props.put(ProductLayout.PRODUCT_ROOT_PROPERTY, otherProduct.toString());
        assertEquals(otherEngine, layout(engine).engineRoot());
        assertEquals(otherProduct, layout(engine).productRoot());
    }

    @Test
    void missingRoots_failNamingTheProperty() throws IOException {
        Path elsewhere = Files.createDirectories(tmp.resolve("elsewhere"));
        IllegalStateException engineError = assertThrows(IllegalStateException.class,
                () -> layout(elsewhere).engineRoot());
        assertTrue(engineError.getMessage().contains("-D" + ProductLayout.ENGINE_ROOT_PROPERTY),
                engineError.getMessage());
        IllegalStateException productError = assertThrows(IllegalStateException.class,
                () -> layout(elsewhere).productRoot());
        assertTrue(productError.getMessage().contains("-D" + ProductLayout.PRODUCT_ROOT_PROPERTY),
                productError.getMessage());
    }

    @Test
    void find_prefersTheProductRootThenTheEngineRoot() throws IOException {
        Files.createDirectories(product.resolve("docs"));
        Files.writeString(product.resolve("docs/SCHEMA.md"), "policy");
        Files.writeString(engine.resolve("MCP.md"), "mcp");
        Files.writeString(product.resolve("README.md"), "product");
        Files.writeString(engine.resolve("README.md"), "engine");

        ProductLayout layout = layout(engine);
        assertEquals(product.resolve("docs/SCHEMA.md"), layout.find("docs/SCHEMA.md"));
        assertEquals(engine.resolve("MCP.md"), layout.find("MCP.md"));
        assertEquals(product.resolve("README.md"), layout.find("README.md"));
        assertEquals(product.resolve("missing.md"), layout.find("missing.md"));
    }

    @Test
    void findIn_mapsEngineRelativePathsInsideACopyOfTheProduct() throws IOException {
        Path copy = tmp.resolve("copy");
        Files.createDirectories(copy.resolve("engine/src/main/java"));
        Files.createDirectories(copy.resolve("schema/1.0.0"));
        ProductLayout layout = layout(engine);
        assertEquals(copy.resolve("engine/src/main/java"), layout.findIn(copy, "src/main/java"));
        assertEquals(copy.resolve("schema/1.0.0"), layout.findIn(copy, "schema/1.0.0"));
    }

    @Test
    void ciWorkflow_prefersTheMonorepoWorkflowThenTheProductOne() throws IOException {
        Path productCi = product.resolve(".github/workflows/ci.yml");
        Files.createDirectories(productCi.getParent());
        Files.writeString(productCi, "name: product");
        assertEquals(productCi, layout(engine).ciWorkflow());

        Path monorepoCi = monorepo.resolve(".github/workflows/dev-arch.yml");
        Files.createDirectories(monorepoCi.getParent());
        Files.writeString(monorepoCi, "name: monorepo");
        assertEquals(monorepoCi, layout(engine).ciWorkflow());

        Path explicit = tmp.resolve("explicit.yml");
        Files.writeString(explicit, "name: explicit");
        props.put(ProductLayout.CI_WORKFLOW_PROPERTY, explicit.toString());
        assertEquals(explicit, layout(engine).ciWorkflow());
    }

    @Test
    void ciWorkflow_missingEverywhere_failsNamingTheProperty() {
        IllegalStateException error = assertThrows(IllegalStateException.class, () -> layout(engine).ciWorkflow());
        assertTrue(error.getMessage().contains("-D" + ProductLayout.CI_WORKFLOW_PROPERTY), error.getMessage());
    }

    @Test
    void walkEngineRepository_skipsProductAreasThatWereNotPartOfTheEngineRepository() throws IOException {
        Files.createDirectories(product.resolve("web/src/lib"));
        Files.writeString(product.resolve("web/src/lib/types.ts"), "export interface Component {}");
        Files.createDirectories(product.resolve("schema/generated"));
        Files.writeString(product.resolve("schema/generated/types.ts"), "export interface Component {}");
        try (var files = layout(engine).walkEngineRepository()) {
            var ts = files.filter(p -> p.toString().endsWith(".ts")).map(p -> product.relativize(p).toString())
                    .toList();
            assertEquals(java.util.List.of("schema/generated/types.ts".replace('/', java.io.File.separatorChar)), ts);
        }
    }

    @Test
    void get_usesSystemPropertiesAndTheCurrentWorkingDirectory() {
        ProductLayout layout = ProductLayout.get();
        assertTrue(Files.isRegularFile(layout.engineRoot().resolve("pom.xml")));
        assertTrue(Files.isRegularFile(layout.productRoot().resolve("schema/VERSION")));
    }
}
