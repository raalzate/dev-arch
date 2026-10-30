package com.extractor.inference.config;

import com.extractor.model.Component;
import com.extractor.model.DependencyGraph;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** FR-001/FR-002: preset selection and precedence. */
class PresetsTest {

    private static DependencyGraph graph(String source, String... files) {
        List<Component> components = new ArrayList<>();
        int i = 0;
        for (String f : files) {
            Component c = new Component("Acme.Pkg.C" + i++);
            c.addFile(f);
            components.add(c);
        }
        DependencyGraph g = new DependencyGraph(components, new ArrayList<>());
        DependencyGraph.Meta meta = new DependencyGraph.Meta();
        meta.setSource(source);
        g.setMeta(meta);
        return g;
    }

    @Test
    void autoDetectsVbGraphs() {
        assertTrue(Presets.isLegacyDesktop(graph("roslyn-fallback", "A.cs")));
        assertTrue(Presets.isLegacyDesktop(graph("roslyn", "A.vb", "B.cs")));
        assertFalse(Presets.isLegacyDesktop(graph("roslyn", "A.vb", "B.cs", "C.cs")));
        assertFalse(Presets.isLegacyDesktop(graph("spoon", "A.java")));
        assertFalse(Presets.isLegacyDesktop(graph("spoon")));
    }

    @Test
    void javaGraphKeepsTheSameConfiguration() {
        Presets.Resolved r = Presets.resolve(InferenceConfig.defaults(), graph("spoon", "A.java"));
        assertNull(r.preset());
        assertSame(InferenceConfig.defaults(), r.config());
    }

    @Test
    void presetLayersBeneathExplicitValues() {
        InferenceConfig user = InferenceConfigLoader.fromText("{\"viability\":{\"debtWeight\":0}}");
        Presets.Resolved r = Presets.resolve(user, graph("roslyn-fallback", "A.vb"));
        assertEquals("legacy-desktop", r.preset());
        assertEquals(0.0, r.config().viability().debtWeight());
        assertEquals("domain", r.config().naming().strategy());
        assertFalse(r.config().inference().presentationInCohesion());
        assertEquals(0.6, r.config().consolidation().verticalSliceRatio());
    }

    @Test
    void noneAndForcedPresets() {
        assertNull(Presets.resolve(InferenceConfigLoader.fromText("{\"inference\":{\"preset\":\"none\"}}"),
                graph("roslyn-fallback", "A.vb")).preset());
        assertEquals("legacy-desktop", Presets.resolve(
                InferenceConfigLoader.fromText("{\"inference\":{\"preset\":\"legacy-desktop\"}}"),
                graph("spoon", "A.java")).preset());
    }

    @Test
    void overridesNeverLeakIntoEqualityOrJson() {
        InferenceConfig user = InferenceConfigLoader.fromText("{}");
        assertEquals(InferenceConfig.defaults(), user);
        assertTrue(user.isDefault());
        assertFalse(InferenceConfigLoader.toJson(user).contains("overrides"));
    }
}
