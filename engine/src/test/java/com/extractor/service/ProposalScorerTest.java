package com.extractor.service;

import com.extractor.inference.config.InferenceConfig;
import com.extractor.model.DependencyGraph;
import com.extractor.testsupport.SyntheticGraph;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** 008 FR-018..FR-020: proposal scoring. */
class ProposalScorerTest {

    private final DependencyGraph graph = SyntheticGraph.build();

    @Test
    void scoresFragmentsAndIgnoresDuplicates() throws Exception {
        List<String> ids = List.of(SyntheticGraph.id(0, 0), SyntheticGraph.id(0, 1), SyntheticGraph.id(1, 0));
        ProposalScore once = new ProposalScorer().score(graph, ids, InferenceConfig.defaults());
        List<String> twice = new java.util.ArrayList<>(ids);
        twice.addAll(ids);
        com.fasterxml.jackson.databind.ObjectMapper m = new com.fasterxml.jackson.databind.ObjectMapper();
        assertEquals(m.valueToTree(once), m.valueToTree(new ProposalScorer().score(graph, twice,
                InferenceConfig.defaults())));
        assertEquals(3, once.metrics().size());
        assertEquals(once.clusters().size(), once.metrics().clusterCount());
    }

    @Test
    void rejectsEmptyAndUnknown() {
        assertEquals("components must contain at least one component id", assertThrows(
                IllegalArgumentException.class,
                () -> new ProposalScorer().score(graph, List.of(), InferenceConfig.defaults())).getMessage());
        assertEquals("Unknown components: a.A, b.B", assertThrows(IllegalArgumentException.class,
                () -> new ProposalScorer().score(graph, List.of("b.B", "a.A"), InferenceConfig.defaults()))
                .getMessage());
    }
}
