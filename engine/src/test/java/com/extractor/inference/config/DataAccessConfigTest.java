package com.extractor.inference.config;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 020 T006: the dataAccess section of the inference configuration. */
class DataAccessConfigTest {

    @Test
    void defaultsAreAutoNoCatalogComplementWeightOneHeuristicOff() {
        DataAccessConfig d = InferenceConfig.defaults().dataAccess();
        assertEquals("auto", d.procedures());
        assertNull(d.procedureCatalog());
        assertEquals("complement", d.catalogMode());
        assertEquals(1.0, d.procedureWeight());
        assertFalse(d.entityHeuristic());
        assertFalse(d.affectsAnalyzer());
        assertTrue(InferenceConfig.defaults().isDefault());
    }

    @Test
    void partialOverridesMergeIntoTheDefaults() {
        InferenceConfig c = InferenceConfigLoader.fromText(
                "{\"dataAccess\":{\"procedureCatalog\":\"/c/procs\",\"procedureWeight\":0}}");
        assertEquals("/c/procs", c.dataAccess().procedureCatalog());
        assertEquals(0.0, c.dataAccess().procedureWeight());
        assertEquals("auto", c.dataAccess().procedures());
        assertTrue(c.dataAccess().affectsAnalyzer());
        assertFalse(c.isDefault());
        assertFalse(InferenceConfigLoader.fromText("{\"dataAccess\":{\"procedureWeight\":0.5}}")
                .dataAccess().affectsAnalyzer(), "inference-only parameters never reach the analyzer");
    }

    @Test
    void invalidValuesNameTheParameter() {
        assertMessage("{\"dataAccess\":{\"procedureWeight\":-1}}", "dataAccess.procedureWeight");
        assertMessage("{\"dataAccess\":{\"procedures\":\"maybe\"}}", "dataAccess.procedures");
        assertMessage("{\"dataAccess\":{\"catalogMode\":\"merge\"}}", "dataAccess.catalogMode");
        assertMessage("{\"dataAccess\":{\"unknownKey\":1}}", "dataAccess.unknownKey");
        assertMessage("{\"dataAccess\":{\"procedureCatalog\":3}}", "dataAccess.procedureCatalog");
    }

    private static void assertMessage(String json, String parameter) {
        InvalidConfigException e = assertThrows(InvalidConfigException.class,
                () -> InferenceConfigLoader.fromText(json));
        assertTrue(e.getMessage().contains(parameter), e.getMessage());
    }
}
