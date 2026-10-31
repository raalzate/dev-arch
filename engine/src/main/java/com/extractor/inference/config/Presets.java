package com.extractor.inference.config;

import com.extractor.model.Component;
import com.extractor.model.DependencyGraph;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.List;
import java.util.Locale;

/**
 * Inference presets (023-legacy-desktop-inference, FR-001/FR-002).
 *
 * <p>A preset is a versioned partial configuration laid over the defaults and
 * beneath the user's explicit values. {@code inference.preset = auto} applies
 * {@value InferenceSection#LEGACY_DESKTOP} when the graph comes from the
 * reduced-fidelity VB loader ({@code meta.source = roslyn-fallback}) or when at
 * least half of its components have a {@code .vb} file.</p>
 */
public final class Presets {

    /** Classpath resource of the legacy-desktop preset. */
    public static final String LEGACY_DESKTOP_RESOURCE =
            "/static-inference/inference-preset-legacy-desktop.json";

    /** Graph source of the reduced-fidelity VB loader (021). */
    public static final String ROSLYN_FALLBACK = "roslyn-fallback";

    private static final JsonNode LEGACY_DESKTOP_TREE = read(LEGACY_DESKTOP_RESOURCE);

    private Presets() {
    }

    /**
     * Configuration and preset name resolved for a graph.
     *
     * @param config the configuration to infer with
     * @param preset the applied preset, or null
     */
    public record Resolved(InferenceConfig config, String preset) {
    }

    /**
     * Resolves the preset of a configuration for a graph.
     *
     * @param config the user's configuration
     * @param graph  the graph about to be inferred
     * @return the configuration with the preset layered in, and its name
     */
    public static Resolved resolve(final InferenceConfig config,
            final DependencyGraph graph) {
        String wanted = config.inference().preset();
        String name = switch (wanted) {
            case InferenceSection.NONE -> null;
            case InferenceSection.AUTO -> isLegacyDesktop(graph)
                    ? InferenceSection.LEGACY_DESKTOP : null;
            default -> wanted;
        };
        if (name == null) {
            return new Resolved(config, null);
        }
        JsonNode overrides = config.overrides() == null
                ? JsonNodeFactory.instance.objectNode() : config.overrides();
        return new Resolved(InferenceConfigLoader.fromJson(overrides, tree(name)), name);
    }

    /**
     * The versioned values of a preset.
     *
     * @param name preset name
     * @return its partial configuration tree
     */
    public static JsonNode tree(final String name) {
        if (InferenceSection.LEGACY_DESKTOP.equals(name)) {
            return LEGACY_DESKTOP_TREE;
        }
        throw InvalidConfigException.parameter("inference.preset",
                "unknown preset " + name);
    }

    /**
     * Whether a graph has the legacy desktop profile (FR-001).
     *
     * @param graph the graph
     * @return true for VB graphs
     */
    public static boolean isLegacyDesktop(final DependencyGraph graph) {
        if (graph.getMeta() != null
                && ROSLYN_FALLBACK.equals(graph.getMeta().getSource())) {
            return true;
        }
        List<Component> components = graph.getComponents();
        if (components == null || components.isEmpty()) {
            return false;
        }
        long vb = components.stream().filter(Presets::hasVbFile).count();
        return vb * 2 >= components.size();
    }

    private static boolean hasVbFile(final Component c) {
        return c.getFiles() != null && c.getFiles().stream()
                .anyMatch(f -> f.toLowerCase(Locale.ROOT).endsWith(".vb"));
    }

    private static JsonNode read(final String resource) {
        try (InputStream in = Presets.class.getResourceAsStream(resource)) {
            if (in == null) {
                throw new IllegalStateException("Missing classpath resource " + resource);
            }
            return new ObjectMapper().readTree(in);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
