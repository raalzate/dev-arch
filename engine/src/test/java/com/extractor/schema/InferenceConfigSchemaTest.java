package com.extractor.schema;

import com.extractor.inference.config.InferenceConfig;
import com.extractor.inference.config.InferenceConfigLoader;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

/** 008 FR-026: the inference configuration contract accepts the defaults and rejects unknown parameters. */
@Tag("schema-contract")
class InferenceConfigSchemaTest {

    @Test
    void defaultsAndPartialConfigurationsAreValid() {
        SchemaRegistry registry = SchemaRegistry.get();
        assertEquals(List.of(), registry.validate("inference-config",
                InferenceConfigLoader.toJson(InferenceConfig.defaults())));
        assertEquals(List.of(), registry.validate("inference-config",
                "{\"viability\":{\"thresholds\":{\"high\":0.8}}}"));
        assertFalse(registry.validate("inference-config", "{\"viability\":{\"thresholds\":{\"hihg\":0.8}}}")
                .isEmpty());
    }
}
