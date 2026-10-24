package com.extractor.testsupport;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Stream;

/**
 * Locates the directories of the dev-arch product for the engine tests (006-devarch-monorepo, research D3).
 * <p>
 * Since 006 the engine lives in {@code <product>/engine} while the contract ({@code schema/}), the
 * specifications, the governance documents and the skills live one level up, at the product root (014: the root of
 * the dev-arch repository), next to the CI workflow. Tests only change <em>where</em> they look for files through this
 * class, never what they assert.
 * <p>
 * Rules (each root): explicit system property &gt; upward search from the working directory &gt; error naming
 * the property.
 * <ul>
 *   <li>{@link #engineRoot()}: {@code -Dengine.root}, else the first ancestor with {@code pom.xml} and
 *       {@code src/test/dotnet}.</li>
 *   <li>{@link #productRoot()}: {@code -Dproduct.root}, else the first ancestor with {@code schema/VERSION}.</li>
 *   <li>{@link #ciWorkflow()}: {@code -Ddevarch.ci.workflow} when the file exists, else the first
 *       {@code .github/workflows/dev-arch.yml} above the product, else {@code <product>/.github/workflows/ci.yml}.</li>
 * </ul>
 */
public final class ProductLayout {

    /** System property overriding the engine root (Maven base directory). */
    public static final String ENGINE_ROOT_PROPERTY = "engine.root";
    /** System property overriding the product root (the repository root). */
    public static final String PRODUCT_ROOT_PROPERTY = "product.root";
    /** System property overriding the CI workflow file. */
    public static final String CI_WORKFLOW_PROPERTY = "devarch.ci.workflow";

    /** Product areas that did not exist in the original engine repository (web app, containers, 006 harness). */
    private static final Set<String> NON_ENGINE_REPOSITORY_AREAS = Set.of("web", "docker", "tests", "node_modules");

    private static final String MONOREPO_WORKFLOW = ".github/workflows/dev-arch.yml";
    private static final String PRODUCT_WORKFLOW = ".github/workflows/ci.yml";

    private final Function<String, String> properties;
    private final Path userDir;

    /**
     * @param properties property lookup (system properties in production use)
     * @param userDir    working directory the upward searches start from
     */
    public ProductLayout(Function<String, String> properties, Path userDir) {
        this.properties = properties;
        this.userDir = userDir.toAbsolutePath().normalize();
    }

    /** Layout of the running JVM (system properties and {@code user.dir}). */
    public static ProductLayout get() {
        return new ProductLayout(System::getProperty, Path.of(System.getProperty("user.dir")));
    }

    /** Engine root: Maven base directory holding {@code pom.xml}, {@code target/} and {@code test-for-demo/}. */
    public Path engineRoot() {
        Path configured = configured(ENGINE_ROOT_PROPERTY);
        if (configured != null) {
            return configured;
        }
        for (Path current = userDir; current != null; current = current.getParent()) {
            if (Files.isRegularFile(current.resolve("pom.xml")) && Files.isDirectory(current.resolve("src/test/dotnet"))) {
                return current;
            }
        }
        throw new IllegalStateException("engine root (pom.xml + src/test/dotnet) not found above " + userDir
                + "; set -D" + ENGINE_ROOT_PROPERTY);
    }

    /** Product root: holds {@code schema/}, {@code specs/}, {@code docs/}, {@code skills/} and the governance files. */
    public Path productRoot() {
        Path configured = configured(PRODUCT_ROOT_PROPERTY);
        if (configured != null) {
            return configured;
        }
        for (Path current = userDir; current != null; current = current.getParent()) {
            if (Files.isRegularFile(current.resolve("schema").resolve("VERSION"))) {
                return current;
            }
        }
        throw new IllegalStateException("product root (schema/VERSION) not found above " + userDir
                + "; set -D" + PRODUCT_ROOT_PROPERTY);
    }

    /** CI workflow definition of the product. */
    public Path ciWorkflow() {
        Path configured = configured(CI_WORKFLOW_PROPERTY);
        if (configured != null && Files.isRegularFile(configured)) {
            return configured;
        }
        Path product = productRoot();
        for (Path current = product; current != null; current = current.getParent()) {
            Path candidate = current.resolve(MONOREPO_WORKFLOW);
            if (Files.isRegularFile(candidate)) {
                return candidate;
            }
        }
        Path fallback = product.resolve(PRODUCT_WORKFLOW);
        if (Files.isRegularFile(fallback)) {
            return fallback;
        }
        throw new IllegalStateException("CI workflow (" + MONOREPO_WORKFLOW + " above " + product + ", or "
                + fallback + ") not found; set -D" + CI_WORKFLOW_PROPERTY);
    }

    /**
     * Resolves a path of the original engine repository layout: the product root first (contract, specs,
     * docs, skills), then the engine root ({@code MCP.md}, {@code pom.xml}, {@code src/...}). When neither
     * exists the product location is returned, so callers report the missing file as before.
     */
    public Path find(String relative) {
        return findIn(productRoot(), engineRoot(), relative);
    }

    /** Same as {@link #find(String)} inside a copy of the product rooted at {@code productCopy}. */
    public Path findIn(Path productCopy, String relative) {
        Path engineRelative = enginePathInsideProduct();
        return findIn(productCopy, productCopy.resolve(engineRelative), relative);
    }

    /**
     * Walks the files of the product that formed the original engine repository (everything but the areas
     * added by the product: web, docker, acceptance tests and installed packages).
     */
    public Stream<Path> walkEngineRepository() {
        Path product = productRoot();
        try {
            return Files.walk(product).filter(p -> {
                Path relative = product.relativize(p);
                return relative.getNameCount() == 0
                        || !NON_ENGINE_REPOSITORY_AREAS.contains(relative.getName(0).toString());
            });
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private Path enginePathInsideProduct() {
        Path product = productRoot();
        Path engine = engineRoot();
        return engine.startsWith(product) ? product.relativize(engine) : Path.of("engine");
    }

    private static Path findIn(Path product, Path engine, String relative) {
        Path inProduct = product.resolve(relative);
        if (Files.exists(inProduct)) {
            return inProduct;
        }
        Path inEngine = engine.resolve(relative);
        return Files.exists(inEngine) ? inEngine : inProduct;
    }

    private Path configured(String property) {
        String value = properties.apply(property);
        return value == null || value.isBlank() ? null : Path.of(value).toAbsolutePath().normalize();
    }
}
