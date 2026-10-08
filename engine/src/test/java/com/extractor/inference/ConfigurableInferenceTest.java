package com.extractor.inference;

import com.extractor.inference.config.InferenceConfig;
import com.extractor.inference.config.InferenceConfigLoader;
import com.extractor.model.DependencyGraph;
import com.extractor.schema.DemoOutputs;
import com.extractor.testsupport.RegressionBaselines;
import com.extractor.testsupport.SyntheticGraph;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 008 T006 / SC-005: every stage honours its parameters; defaults reproduce the 1.2.0 inference. */
class ConfigurableInferenceTest {

    private static DependencyGraph baselineGraph(String project) throws Exception {
        ObjectMapper m = new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
        ObjectNode tree = (ObjectNode) m.readTree(RegressionBaselines.load(project).get(DemoOutputs.GRAPH));
        tree.remove("api_contracts");
        return m.treeToValue(tree, DependencyGraph.class);
    }

    private static ConsolidatedArchitecture infer(DependencyGraph g, InferenceConfig c) {
        MicroserviceCandidates candidates = new InferenceEngine(c).analyze(g);
        return new MicroserviceRecommendationEngine(c).assemble(candidates, g.getComponents(), Map.of(), List.of(),
                List.of());
    }

    private static ConsolidatedArchitecture infer(String project, String json) throws Exception {
        return infer(baselineGraph(project), InferenceConfigLoader.fromText(json));
    }

    private static List<List<Integer>> groups(ConsolidatedArchitecture a) {
        return a.getProposals().stream().map(p -> p.getClusterIds().stream().sorted().toList()).toList();
    }

    @Test
    void defaultsEqualTheLegacyConstructors() throws Exception {
        DependencyGraph g = baselineGraph("java-standar");
        ObjectMapper m = DemoOutputs.cliMapper();
        MicroserviceCandidates legacy = new InferenceEngine().analyze(g);
        String old = m.writeValueAsString(new MicroserviceRecommendationEngine().analyzeConsolidated(legacy,
                g.getComponents(), Map.of(), null, List.of()));
        assertEquals(old, m.writeValueAsString(infer(g, InferenceConfig.defaults())));
    }

    @Test
    void consolidationStage() throws Exception {
        assertEquals(List.of(List.of(0), List.of(1, 2)), groups(infer("java-standar", "{}")));
        assertEquals(List.of(List.of(0), List.of(1), List.of(2)),
                groups(infer("java-standar", "{\"consolidation\":{\"domainMergeMaxSize\":0}}")));
    }

    @Test
    void evidenceStage() throws Exception {
        assertEquals(List.of(List.of(0, 1, 2)), groups(infer("java-standar",
                "{\"evidence\":{\"evidenceThreshold\":0.3,\"minStrongSignals\":1}}")));
    }

    @Test
    void viabilityStage() throws Exception {
        ConsolidatedArchitecture a = infer("jee-architecture-master",
                "{\"viability\":{\"weights\":{\"cohesion\":0.0,\"coupling\":0.0,\"data\":0.0}}}");
        assertFalse(a.getProposals().isEmpty());
        a.getProposals().forEach(p -> assertEquals("Baja", p.getViability()));
        infer("java-standar", "{\"viability\":{\"thresholds\":{\"high\":0.0,\"medium\":0.0}}}").getProposals()
                .forEach(p -> assertEquals("Alta", p.getViability()));
    }

    @Test
    void recommendationStage() throws Exception {
        ConsolidatedArchitecture a = infer("java-standar", "{\"recommendation\":{\"infrastructureKeywords\":[]}}");
        assertTrue(a.getSupportLibraries().isEmpty());
        assertEquals(27, a.getProposals().stream().mapToInt(p -> p.getComponentNames().size()).sum());
        ConsolidatedArchitecture computed = infer("java-standar",
                "{\"recommendation\":{\"dataJaccardMode\":\"data_cohesion\"}}");
        assertEquals(0.0, computed.getProposals().get(0).getMetrics().getDataJaccard());
    }

    @Test
    void namingStage() throws Exception {
        ConsolidatedArchitecture a = infer("java-standar",
                "{\"naming\":{\"excludeTokens\":[\"globalexception\",\"entity\",\"model\",\"data\",\"dto\"]}}");
        a.getProposals().forEach(p -> assertFalse(p.getName().contains("Globalexception"), p.getName()));
    }

    @Test
    void clusteringStage() throws Exception {
        DependencyGraph g = SyntheticGraph.build();
        Set<Set<String>> base = clusters(g, InferenceConfig.defaults());
        Set<Set<String>> single = clusters(g,
                InferenceConfigLoader.fromText("{\"clustering\":{\"singleDomainRatio\":0.0}}"));
        assertNotEquals(base, single);
    }

    private static Set<Set<String>> clusters(DependencyGraph g, InferenceConfig c) {
        return new InferenceEngine(c).analyze(g).getCandidates().stream()
                .map(cl -> (Set<String>) new TreeSet<>(cl.getMembers())).collect(Collectors.toSet());
    }

    @Test
    void evidenceWeightsChangeTheEdgeScores() throws Exception {
        DependencyGraph g = baselineGraph("legacy-erp");
        List<Cluster> clusters = new InferenceEngine().analyze(g).getCandidates();
        Map<String, Double> scores = new HashMap<>();
        new InterClusterGraph(clusters, g.getComponents()).getSortedEdges()
                .forEach(e -> scores.merge("d", e.getEvidenceScore(), Double::sum));
        InferenceConfig callOnly = InferenceConfigLoader.fromText(
                "{\"evidence\":{\"weights\":{\"table\":0,\"call\":0,\"token\":0,\"event\":0}}}");
        assertTrue(new InterClusterGraph(clusters, g.getComponents(), callOnly.evidence()).getSortedEdges()
                .isEmpty());
        assertTrue(scores.get("d") > 0);
    }
}
