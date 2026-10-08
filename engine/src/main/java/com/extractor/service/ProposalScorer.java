package com.extractor.service;

import com.extractor.inference.Cluster;
import com.extractor.inference.InferenceEngine;
import com.extractor.inference.MetricsCalculator;
import com.extractor.inference.MicroserviceRecommendationEngine;
import com.extractor.inference.ViabilityScorer;
import com.extractor.inference.config.InferenceConfig;
import com.extractor.model.Component;
import com.extractor.model.DependencyGraph;
import com.extractor.model.DocumentMeta;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;

/**
 * Scores a user-edited proposal with the formulas of the engine's own
 * proposals (008, research D10): the proposal is split into the fragments
 * of the inferred clusters it touches and scored as a group of clusters.
 */
public final class ProposalScorer {

    /**
     * Scores a proposal.
     *
     * @param graph      the dependency graph
     * @param components component ids of the proposal
     * @param config     inference configuration
     * @return the score
     */
    public ProposalScore score(final DependencyGraph graph,
            final List<String> components, final InferenceConfig config) {
        Set<String> wanted = validate(graph, components);
        List<Cluster> clusters = new ArrayList<>(
                new InferenceEngine(config).analyze(graph).getCandidates());
        clusters.sort(Comparator.comparingInt(Cluster::getClusterId));
        MetricsCalculator calculator = new MetricsCalculator();
        List<Cluster> fragments = new ArrayList<>();
        Set<String> placed = new LinkedHashSet<>();
        int nextId = 0;
        for (Cluster cluster : clusters) {
            nextId = Math.max(nextId, cluster.getClusterId() + 1);
            List<String> members = cluster.getMembers().stream()
                    .filter(wanted::contains).distinct().toList();
            if (!members.isEmpty()) {
                fragments.add(fragment(cluster.getClusterId(), members, graph,
                        calculator));
                placed.addAll(members);
            }
        }
        List<String> rest = wanted.stream()
                .filter(c -> !placed.contains(c)).sorted().toList();
        if (!rest.isEmpty()) {
            fragments.add(fragment(nextId, rest, graph, calculator));
        }
        MicroserviceRecommendationEngine.FragmentEvaluation evaluation =
                new MicroserviceRecommendationEngine(config)
                        .evaluate(fragments, graph.getComponents());
        ViabilityScorer.ViabilityResult result = evaluation.viability();
        ViabilityScorer.Breakdown terms = result.getBreakdown();
        return new ProposalScore(new DocumentMeta(), evaluation.name(),
                result.getViability(), result.getScore(),
                new ProposalScore.Metrics(terms.cohesionAdjusted(),
                        terms.externalCoupling(), terms.dataCohesion(),
                        terms.internalEdgeDensity(), terms.size(),
                        fragments.size()),
                List.copyOf(new TreeSet<>(wanted)),
                fragments.stream().map(Cluster::getClusterId).sorted()
                        .toList(),
                result.getRationale(), evaluation.actions());
    }

    /**
     * Rejects empty lists and unknown ids; removes duplicates.
     *
     * @param graph      the graph
     * @param components requested ids
     * @return the unique ids
     */
    private static Set<String> validate(final DependencyGraph graph,
            final List<String> components) {
        if (components == null || components.isEmpty()) {
            throw new IllegalArgumentException(
                    "components must contain at least one component id");
        }
        Set<String> known = new java.util.HashSet<>();
        for (Component c : graph.getComponents()) {
            known.add(c.getId());
        }
        Set<String> unknown = new TreeSet<>();
        Set<String> wanted = new LinkedHashSet<>();
        for (String id : components) {
            if (known.contains(id)) {
                wanted.add(id);
            } else {
                unknown.add(String.valueOf(id));
            }
        }
        if (!unknown.isEmpty()) {
            throw new IllegalArgumentException("Unknown components: "
                    + String.join(", ", unknown));
        }
        return wanted;
    }

    /**
     * A fragment of a cluster with its own metrics.
     *
     * @param id         source cluster id
     * @param members    members in cluster order
     * @param graph      the graph
     * @param calculator metrics calculator
     * @return the fragment
     */
    private static Cluster fragment(final int id, final List<String> members,
            final DependencyGraph graph, final MetricsCalculator calculator) {
        Cluster fragment = new Cluster(id);
        fragment.setMembers(new ArrayList<>(members));
        fragment.setMetrics(calculator.calculateMetrics(fragment, graph));
        return fragment;
    }
}
