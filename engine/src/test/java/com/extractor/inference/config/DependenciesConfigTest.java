package com.extractor.inference.config;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 022 T006: integrations and dependencies sections. */
class DependenciesConfigTest {

    @Test
    void defaultsAreAutoAndEmpty() {
        InferenceConfig c = InferenceConfig.defaults();
        assertEquals("auto", c.integrations().outbound());
        assertEquals("auto", c.dependencies().enabled());
        assertEquals(List.of(), c.dependencies().eol());
        assertFalse(c.integrations().affectsAnalyzer());
        assertFalse(c.dependencies().affectsAnalyzer());
        assertTrue(c.isDefault());
    }

    @Test
    void overridesAffectTheAnalyzer() {
        InferenceConfig c = InferenceConfigLoader.fromText(
                "{\"integrations\":{\"outbound\":\"on\"},\"dependencies\":{\"eol\":[\"Legacy.Crypto\"]}}");
        assertTrue(c.integrations().affectsAnalyzer());
        assertTrue(c.dependencies().affectsAnalyzer());
        assertEquals(List.of("Legacy.Crypto"), c.dependencies().eol());
    }

    @Test
    void invalidValuesNameTheParameter() {
        assertMessage("{\"integrations\":{\"outbound\":\"maybe\"}}", "integrations.outbound");
        assertMessage("{\"dependencies\":{\"enabled\":\"sometimes\"}}", "dependencies.enabled");
        assertMessage("{\"dependencies\":{\"eol\":[\"\"]}}", "dependencies.eol");
        assertMessage("{\"integrations\":{\"unknownKey\":1}}", "integrations.unknownKey");
    }

    private static void assertMessage(String json, String parameter) {
        InvalidConfigException e = assertThrows(InvalidConfigException.class,
                () -> InferenceConfigLoader.fromText(json));
        assertTrue(e.getMessage().contains(parameter), e.getMessage());
    }
}
