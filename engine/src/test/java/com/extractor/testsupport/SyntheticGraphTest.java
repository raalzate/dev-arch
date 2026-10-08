package com.extractor.testsupport;

import com.extractor.schema.DemoOutputs;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** 008 T003: the synthetic graph has 500 components and is deterministic. */
class SyntheticGraphTest {

    @Test
    void fiveHundredComponentsSerializedIdentically() throws Exception {
        assertEquals(500, SyntheticGraph.build().getComponents().size());
        assertEquals(DemoOutputs.cliMapper().writeValueAsString(SyntheticGraph.build()),
                DemoOutputs.cliMapper().writeValueAsString(SyntheticGraph.build()));
    }
}
