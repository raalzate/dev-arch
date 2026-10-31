package com.extractor.inference.config;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 021 T006: the debt section of the inference configuration. */
class DebtConfigTest {

    @Test
    void defaultsAreAutoAndPlanThresholds() {
        DebtConfig d = InferenceConfig.defaults().debt();
        assertEquals("auto", d.enabled());
        assertEquals(1000, d.godClass().minLoc());
        assertEquals(15, d.godClass().minComplexity());
        assertFalse(d.affectsAnalyzer());
        assertTrue(InferenceConfig.defaults().isDefault());
    }

    @Test
    void overridesAffectTheAnalyzer() {
        assertTrue(InferenceConfigLoader.fromText("{\"debt\":{\"enabled\":\"off\"}}").debt().affectsAnalyzer());
        DebtConfig d = InferenceConfigLoader.fromText("{\"debt\":{\"godClass\":{\"minLoc\":5}}}").debt();
        assertEquals(5, d.godClass().minLoc());
        assertEquals(15, d.godClass().minComplexity());
    }

    @Test
    void invalidValuesNameTheParameter() {
        assertMessage("{\"debt\":{\"enabled\":\"maybe\"}}", "debt.enabled");
        assertMessage("{\"debt\":{\"godClass\":{\"minLoc\":0}}}", "debt.godClass.minLoc");
        assertMessage("{\"debt\":{\"godClass\":{\"minComplexity\":-1}}}", "debt.godClass.minComplexity");
        assertMessage("{\"debt\":{\"unknownKey\":true}}", "debt.unknownKey");
    }

    private static void assertMessage(String json, String parameter) {
        InvalidConfigException e = assertThrows(InvalidConfigException.class,
                () -> InferenceConfigLoader.fromText(json));
        assertTrue(e.getMessage().contains(parameter), e.getMessage());
    }
}
