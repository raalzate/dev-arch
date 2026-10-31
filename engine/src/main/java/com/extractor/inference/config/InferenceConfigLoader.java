package com.extractor.inference.config;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Iterator;
import java.util.Map;
import java.util.Set;

/**
 * Loads, merges and validates inference configurations (research D4).
 *
 * <p>A configuration is a JSON object whose properties are all optional: it
 * is merged onto the defaults (objects merge recursively; arrays, strings,
 * numbers and the label map replace), unknown properties and wrong JSON types
 * are rejected, then every value is range-checked by
 * {@link InferenceConfigValidator}.</p>
 */
public final class InferenceConfigLoader {

    /** Classpath resource with the default values. */
    public static final String DEFAULTS_RESOURCE =
            "/static-inference/inference-defaults.json";

    /** Parameters whose value is a free-key map replaced as a whole. */
    private static final Set<String> MAP_PARAMETERS =
            Set.of("naming.infrastructureLabels");

    /** Reader and writer of configurations. */
    private static final ObjectMapper MAPPER = new ObjectMapper()
            .enable(SerializationFeature.INDENT_OUTPUT);

    /** Defaults as a JSON tree (merge base and type reference). */
    private static final JsonNode DEFAULT_TREE = readDefaultTree();

    /** Defaults as a record. */
    private static final InferenceConfig DEFAULTS = convert(DEFAULT_TREE);

    private InferenceConfigLoader() {
    }

    /**
     * The default configuration.
     *
     * @return the defaults
     */
    public static InferenceConfig defaults() {
        return DEFAULTS;
    }

    /**
     * Configuration from a JSON tree; null or JSON null means defaults.
     *
     * @param overrides partial configuration
     * @return the validated configuration
     * @throws InvalidConfigException when the configuration is invalid
     */
    public static InferenceConfig fromJson(final JsonNode overrides) {
        if (overrides == null || overrides.isNull()
                || overrides.isMissingNode()) {
            return DEFAULTS;
        }
        if (!overrides.isObject()) {
            throw InvalidConfigException.parameter("(root)",
                    "must be an object");
        }
        return fromJson(overrides, null);
    }

    /**
     * Configuration layered as defaults ← {@code preset} ← {@code overrides}
     * (023, FR-002: a preset never beats the user's explicit values).
     *
     * @param overrides the user's partial configuration (object)
     * @param preset    a preset tree laid over the defaults first, or null
     * @return the validated configuration remembering {@code overrides}
     * @throws InvalidConfigException when either tree is invalid
     */
    public static InferenceConfig fromJson(final JsonNode overrides,
            final JsonNode preset) {
        JsonNode merged = DEFAULT_TREE.deepCopy();
        if (preset != null) {
            merge((ObjectNode) merged, (ObjectNode) preset, "");
        }
        merge((ObjectNode) merged, (ObjectNode) overrides, "");
        InferenceConfig config = convert(merged);
        InferenceConfigValidator.validate(config);
        return config.withOverrides(overrides.deepCopy());
    }

    /**
     * Configuration from an object such as a parsed MCP argument.
     *
     * @param overrides partial configuration (maps, lists, scalars)
     * @return the validated configuration
     * @throws InvalidConfigException when the configuration is invalid
     */
    public static InferenceConfig fromObject(final Object overrides) {
        return fromJson(overrides == null ? null
                : MAPPER.valueToTree(overrides));
    }

    /**
     * Configuration from JSON text.
     *
     * @param json partial configuration
     * @return the validated configuration
     * @throws InvalidConfigException when the text or configuration is
     *                                invalid
     */
    public static InferenceConfig fromText(final String json) {
        try {
            return fromJson(MAPPER.readTree(json));
        } catch (JsonProcessingException e) {
            throw InvalidConfigException.parameter("(root)",
                    "is not valid JSON: " + e.getOriginalMessage());
        }
    }

    /**
     * Configuration from a JSON file.
     *
     * @param file the file
     * @return the validated configuration
     * @throws InvalidConfigException when the file or configuration is
     *                                invalid
     */
    public static InferenceConfig fromFile(final Path file) {
        String name = file.toString();
        if (!Files.exists(file)) {
            throw InvalidConfigException.file(name, "does not exist");
        }
        if (!Files.isRegularFile(file) || !Files.isReadable(file)) {
            throw InvalidConfigException.file(name, "is not readable");
        }
        JsonNode tree;
        try {
            tree = MAPPER.readTree(file.toFile());
        } catch (JsonProcessingException e) {
            throw InvalidConfigException.file(name,
                    "is not valid JSON: " + e.getOriginalMessage());
        } catch (IOException e) {
            throw InvalidConfigException.file(name, "is not readable");
        }
        if (tree == null || tree.isMissingNode()) {
            throw InvalidConfigException.file(name,
                    "is not valid JSON: empty document");
        }
        return fromJson(tree);
    }

    /**
     * Stable JSON form (indented, record component order).
     *
     * @param config the configuration
     * @return the JSON text
     */
    public static String toJson(final InferenceConfig config) {
        try {
            return MAPPER.writeValueAsString(config);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    /**
     * Copies {@code overrides} onto {@code target} checking keys and types.
     *
     * @param target    merged tree (starts as the defaults)
     * @param overrides user values
     * @param prefix    dotted path of {@code target}
     */
    private static void merge(final ObjectNode target,
            final ObjectNode overrides, final String prefix) {
        Iterator<Map.Entry<String, JsonNode>> fields = overrides.fields();
        while (fields.hasNext()) {
            Map.Entry<String, JsonNode> field = fields.next();
            String path = prefix + field.getKey();
            JsonNode reference = target.get(field.getKey());
            if (reference == null) {
                throw InvalidConfigException.parameter(path,
                        "unknown parameter");
            }
            JsonNode value = field.getValue();
            if (reference.isObject() && !MAP_PARAMETERS.contains(path)) {
                requireType(path, value.isObject(), "an object");
                merge((ObjectNode) reference, (ObjectNode) value,
                        path + ".");
            } else {
                checkType(path, reference, value);
                target.set(field.getKey(), value);
            }
        }
    }

    /**
     * Rejects a value whose JSON type differs from the default's.
     *
     * @param path      dotted path
     * @param reference default value
     * @param value     user value
     */
    private static void checkType(final String path, final JsonNode reference,
            final JsonNode value) {
        if (reference.isNull()) {
            // Optional text parameters default to null (020: dataAccess.procedureCatalog; 025: analysis.referenceAssemblies).
            requireType(path, value.isNull() || value.isTextual(), "a string or null");
        } else if (reference.isIntegralNumber()) {
            requireType(path, value.isIntegralNumber(), "an integer");
        } else if (reference.isNumber()) {
            requireType(path, value.isNumber(), "a number");
        } else if (reference.isTextual()) {
            requireType(path, value.isTextual(), "a string");
        } else if (reference.isArray()) {
            requireType(path, value.isArray() && allText(value),
                    "an array of strings");
        } else if (reference.isObject()) {
            requireType(path, value.isObject() && allText(value),
                    "an object of strings");
        }
    }

    /**
     * Whether every element (array) or value (object) is a string.
     *
     * @param container array or object
     * @return true when all are strings
     */
    private static boolean allText(final JsonNode container) {
        for (JsonNode element : container) {
            if (!element.isTextual()) {
                return false;
            }
        }
        return true;
    }

    /**
     * Throws when a type condition does not hold.
     *
     * @param path     dotted path
     * @param ok       the condition
     * @param expected expected type, e.g. "a number"
     */
    private static void requireType(final String path, final boolean ok,
            final String expected) {
        if (!ok) {
            throw InvalidConfigException.parameter(path, "must be "
                    + expected);
        }
    }

    /**
     * Converts a complete tree to the record.
     *
     * @param tree complete configuration tree
     * @return the record
     */
    private static InferenceConfig convert(final JsonNode tree) {
        try {
            return MAPPER.treeToValue(tree, InferenceConfig.class);
        } catch (JsonProcessingException e) {
            throw new InvalidConfigException("Invalid inference configuration: "
                    + e.getOriginalMessage());
        }
    }

    /**
     * Reads the packaged defaults.
     *
     * @return the defaults tree
     */
    private static JsonNode readDefaultTree() {
        try (InputStream in = InferenceConfigLoader.class
                .getResourceAsStream(DEFAULTS_RESOURCE)) {
            if (in == null) {
                throw new IllegalStateException("Missing classpath resource "
                        + DEFAULTS_RESOURCE);
            }
            return MAPPER.readTree(in);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
