package com.extractor.mcp;

import com.extractor.inference.config.InferenceConfig;
import com.extractor.inference.config.InferenceConfigLoader;
import com.extractor.model.SchemaVersion;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import io.modelcontextprotocol.server.McpServerFeatures;
import io.modelcontextprotocol.spec.McpError;
import io.modelcontextprotocol.spec.McpSchema;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.FileSystem;
import java.nio.file.FileSystemNotFoundException;
import java.nio.file.FileSystems;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.function.Supplier;
import java.util.stream.Stream;

/**
 * Read-only documentation resources of the server mode (008, FR-021),
 * served from the engine archive.
 */
public final class McpResources {

    /** URI of the algorithm guide. */
    public static final String ALGORITHMS = "static-inference://algorithms";

    /** URI of the configuration guide. */
    public static final String CONFIGURATION =
            "static-inference://configuration";

    /** URI of the default inference configuration. */
    public static final String DEFAULTS =
            "static-inference://configuration/defaults";

    /** URI of the data contract. */
    public static final String SCHEMA = "static-inference://schema";

    /** Classpath folder of the packaged guides. */
    private static final String DOCS = "static-inference/docs/";

    /** Classpath folder of the packaged contract. */
    private static final String SCHEMAS =
            "static-inference/schema/" + SchemaVersion.CURRENT;

    /** Markdown media type. */
    private static final String MARKDOWN = "text/markdown";

    /** JSON media type. */
    private static final String JSON = "application/json";

    private McpResources() {
    }

    /**
     * The four resource specifications.
     *
     * @return the specifications
     */
    public static List<McpServerFeatures.SyncResourceSpecification> specs() {
        return List.of(
                spec(ALGORITHMS, "algorithms", "Algorithms of the inference"
                        + " engine (clustering, evidence, consolidation,"
                        + " naming, viability).", MARKDOWN,
                        () -> text(DOCS + "ALGORITHMS.md")),
                spec(CONFIGURATION, "configuration", "Configuration guide:"
                        + " every inference parameter, its default, range"
                        + " and effect.", MARKDOWN,
                        () -> text(DOCS + "CONFIGURATION.md")),
                spec(DEFAULTS, "configuration-defaults", "Default inference"
                        + " configuration applied by this engine.", JSON,
                        () -> InferenceConfigLoader.toJson(
                                InferenceConfig.defaults())),
                spec(SCHEMA, "schema", "JSON Schema contract of the"
                        + " outputs, MCP responses and inference"
                        + " configuration.", JSON, McpResources::schemaBundle));
    }

    /**
     * Catch-all template of the {@code static-inference://} namespace: an
     * unknown document is reported as not found naming its URI (TS-031).
     *
     * @return the template specifications
     */
    public static List<McpServerFeatures.SyncResourceTemplateSpecification>
            templates() {
        McpSchema.ResourceTemplate template = new McpSchema.ResourceTemplate(
                "static-inference://{document}", "documents",
                "Documentation resources of the engine; unknown documents"
                        + " are reported as not found.", JSON, null);
        return List.of(new McpServerFeatures.SyncResourceTemplateSpecification(
                template, (exchange, request) -> {
                    throw McpError.builder(NOT_FOUND)
                            .message("Resource not found: " + request.uri())
                            .data(Map.of("uri", request.uri())).build();
                }));
    }

    /** JSON-RPC code of an unknown resource. */
    private static final int NOT_FOUND = -32002;

    /**
     * Text of a resource by URI (tests and the read handler).
     *
     * @param uri resource URI
     * @return the text
     */
    public static String read(final String uri) {
        for (McpServerFeatures.SyncResourceSpecification spec : specs()) {
            if (spec.resource().uri().equals(uri)) {
                McpSchema.ReadResourceResult result = spec.readHandler()
                        .apply(null, new McpSchema.ReadResourceRequest(uri));
                return ((McpSchema.TextResourceContents) result.contents()
                        .get(0)).text();
            }
        }
        throw new IllegalArgumentException("Resource not found: " + uri);
    }

    /**
     * One specification.
     *
     * @param uri         URI
     * @param name        name
     * @param description description
     * @param mimeType    media type
     * @param content     content supplier
     * @return the specification
     */
    private static McpServerFeatures.SyncResourceSpecification spec(
            final String uri, final String name, final String description,
            final String mimeType, final Supplier<String> content) {
        McpSchema.Resource resource = McpSchema.Resource.builder().uri(uri)
                .name(name).description(description).mimeType(mimeType)
                .build();
        return new McpServerFeatures.SyncResourceSpecification(resource,
                (exchange, request) -> new McpSchema.ReadResourceResult(
                        List.of(new McpSchema.TextResourceContents(uri,
                                mimeType, content.get()))));
    }

    /**
     * Packaged text resource.
     *
     * @param path classpath path
     * @return the text
     */
    private static String text(final String path) {
        try (InputStream in = McpResources.class.getClassLoader()
                .getResourceAsStream(path)) {
            if (in == null) {
                throw new IllegalStateException("Missing resource " + path);
            }
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /**
     * Every packaged schema keyed by its relative path.
     *
     * @return the bundle as JSON
     */
    private static String schemaBundle() {
        URL url = McpResources.class.getClassLoader().getResource(SCHEMAS);
        if (url == null) {
            throw new IllegalStateException("Missing resource " + SCHEMAS);
        }
        ObjectMapper mapper = new ObjectMapper()
                .enable(SerializationFeature.INDENT_OUTPUT);
        try {
            URI uri = url.toURI();
            if ("jar".equals(uri.getScheme())) {
                try (FileSystem fs = jarFileSystem(uri)) {
                    return bundle(mapper, fs.provider().getPath(uri));
                }
            }
            return bundle(mapper, Path.of(uri));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        } catch (URISyntaxException e) {
            throw new IllegalStateException(e);
        }
    }

    /**
     * A new file system over the engine archive.
     *
     * @param uri jar URI
     * @return the file system (closed by the caller)
     * @throws IOException when the archive cannot be opened
     */
    private static FileSystem jarFileSystem(final URI uri)
            throws IOException {
        try {
            FileSystems.getFileSystem(uri).close();
        } catch (FileSystemNotFoundException | UnsupportedOperationException
                e) {
            // not open yet
        }
        return FileSystems.newFileSystem(uri, Map.of());
    }

    /**
     * Builds the bundle from a schema folder.
     *
     * @param mapper JSON mapper
     * @param root   the folder
     * @return the bundle as JSON
     * @throws IOException when a schema cannot be read
     */
    private static String bundle(final ObjectMapper mapper, final Path root)
            throws IOException {
        Map<String, Object> schemas = new TreeMap<>();
        try (Stream<Path> walk = Files.walk(root)) {
            for (Path file : walk.filter(Files::isRegularFile)
                    .filter(p -> p.toString().endsWith(".schema.json"))
                    .sorted()
                    .toList()) {
                String relative = root.relativize(file).toString()
                        .replace('\\', '/');
                schemas.put(relative, mapper.readTree(
                        Files.readString(file, StandardCharsets.UTF_8)));
            }
        }
        Map<String, Object> bundle = new LinkedHashMap<>();
        bundle.put("schema_version", SchemaVersion.CURRENT);
        bundle.put("schemas", schemas);
        return mapper.writeValueAsString(bundle);
    }
}
