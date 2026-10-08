package com.extractor.inference;

import com.extractor.inference.config.EvidenceConfig;
import com.extractor.inference.config.InferenceConfig;
import com.extractor.model.Component;
import java.util.*;
import java.util.stream.Collectors;

public class InterClusterGraph {
    private final List<Cluster> clusters;
    private final Map<String, Component> componentMap;
    private final Map<ClusterPair, EdgeSignals> edges;
    /** Evidence parameters (008). */
    private final EvidenceConfig evidence;
    /** Tokens ignored by the token similarity. */
    private final Set<String> excludeKeywords;

    public InterClusterGraph(List<Cluster> clusters, List<Component> allComponents) {
        this(clusters, allComponents, InferenceConfig.defaults().evidence());
    }

    /**
     * Graph built with the given evidence parameters.
     *
     * @param clusters      the clusters
     * @param allComponents every component of the graph
     * @param config        evidence parameters
     */
    public InterClusterGraph(final List<Cluster> clusters,
            final List<Component> allComponents,
            final EvidenceConfig config) {
        this.evidence = config;
        this.excludeKeywords = Set.copyOf(config.excludeTokens());
        this.clusters = clusters;
        this.componentMap = allComponents.stream()
            .collect(Collectors.toMap(Component::getId, c -> c));
        this.edges = new HashMap<>();
        buildGraph();
    }

    private void buildGraph() {
        for (int i = 0; i < clusters.size(); i++) {
            for (int j = i + 1; j < clusters.size(); j++) {
                Cluster clusterA = clusters.get(i);
                Cluster clusterB = clusters.get(j);
                ClusterPair pair = new ClusterPair(clusterA.getClusterId(), clusterB.getClusterId());
                
                EdgeSignals signals = calculateSignals(clusterA, clusterB);
                if (signals.getEvidenceScore() > evidence.edgeThreshold()) {
                    edges.put(pair, signals);
                }
            }
        }
    }

    private EdgeSignals calculateSignals(Cluster clusterA, Cluster clusterB) {
        double tableJaccard = calculateTableJaccard(clusterA, clusterB);
        double callDensity = calculateCallDensity(clusterA, clusterB);
        double tokenSimilarity = calculateTokenSimilarity(clusterA, clusterB);
        List<String> eventLinks = detectEventCoupling(clusterA, clusterB);
        
        EvidenceConfig.Weights w = evidence.weights();
        double evidenceScore = w.table() * tableJaccard + w.call() * callDensity
                + w.token() * tokenSimilarity + w.event() * (eventLinks.isEmpty() ? 0 : 1);

        return new EdgeSignals(tableJaccard, callDensity, tokenSimilarity, eventLinks, evidenceScore,
                evidence);
    }

    private double calculateTableJaccard(Cluster clusterA, Cluster clusterB) {
        Set<String> tablesA = new HashSet<>(clusterA.getMetrics().getTablesShared());
        Set<String> tablesB = new HashSet<>(clusterB.getMetrics().getTablesShared());
        
        if (tablesA.isEmpty() && tablesB.isEmpty()) return 0.0;
        
        Set<String> intersection = new HashSet<>(tablesA);
        intersection.retainAll(tablesB);
        
        Set<String> union = new HashSet<>(tablesA);
        union.addAll(tablesB);
        
        return union.isEmpty() ? 0.0 : (double) intersection.size() / union.size();
    }

    private double calculateCallDensity(Cluster clusterA, Cluster clusterB) {
        int callsAtoB = countCalls(clusterA.getMembers(), clusterB.getMembers());
        int callsBtoA = countCalls(clusterB.getMembers(), clusterA.getMembers());
        int totalCrossCalls = callsAtoB + callsBtoA;
        
        if (totalCrossCalls == 0) return 0.0;
        
        int internalCallsA = countInternalCalls(clusterA.getMembers());
        int internalCallsB = countInternalCalls(clusterB.getMembers());
        int totalInternalCalls = internalCallsA + internalCallsB;
        
        if (totalInternalCalls == 0) return 0.0;
        
        return Math.min(1.0, (double) totalCrossCalls
                / (totalInternalCalls * evidence.callDensitySaturation()));
    }

    private int countCalls(List<String> fromComponents, List<String> toComponents) {
        int calls = 0;
        Set<String> toSet = new HashSet<>(toComponents);
        
        for (String fromComp : fromComponents) {
            Component comp = componentMap.get(fromComp);
            if (comp != null && comp.getCallsOut() != null) {
                for (String called : comp.getCallsOut()) {
                    if (toSet.contains(called)) {
                        calls++;
                    }
                }
            }
        }
        return calls;
    }

    private int countInternalCalls(List<String> components) {
        int calls = 0;
        Set<String> compSet = new HashSet<>(components);
        
        for (String comp : components) {
            Component component = componentMap.get(comp);
            if (component != null && component.getCallsOut() != null) {
                for (String called : component.getCallsOut()) {
                    if (compSet.contains(called)) {
                        calls++;
                    }
                }
            }
        }
        return calls;
    }

    private double calculateTokenSimilarity(Cluster clusterA, Cluster clusterB) {
        Set<String> tokensA = extractDomainTokens(clusterA.getMembers());
        Set<String> tokensB = extractDomainTokens(clusterB.getMembers());
        
        if (tokensA.isEmpty() && tokensB.isEmpty()) return 0.0;
        
        Set<String> intersection = new HashSet<>(tokensA);
        intersection.retainAll(tokensB);
        
        Set<String> union = new HashSet<>(tokensA);
        union.addAll(tokensB);
        
        return union.isEmpty() ? 0.0 : (double) intersection.size() / union.size();
    }

    private Set<String> extractDomainTokens(List<String> components) {
        Set<String> tokens = new HashSet<>();
        // Ordered: the first matching role wins (deterministic, see research D3 of 008)
        List<String> roleKeywords = evidence.roleKeywords();

        for (String comp : components) {
            String simpleName = comp.substring(comp.lastIndexOf('.') + 1).toLowerCase();
            String packageName = comp.substring(0, Math.max(0, comp.lastIndexOf('.')));
            
            for (String role : roleKeywords) {
                if (simpleName.contains(role)) {
                    String token = simpleName.replaceAll(role + ".*", "")
                                            .replaceAll("repository", "")
                                            .replaceAll("impl", "");
                    if (!token.isEmpty() && !excludeKeywords.contains(token)) {
                        tokens.add(token);
                    }
                    
                    String[] packageParts = packageName.split("\\.");
                    if (packageParts.length > 0) {
                        String lastPackage = packageParts[packageParts.length - 1];
                        if (!excludeKeywords.contains(lastPackage)
                                && lastPackage.length() >= evidence.minPackageTokenLength()) {
                            tokens.add(lastPackage);
                        }
                    }
                    break;
                }
            }
        }
        
        return tokens;
    }

    private List<String> detectEventCoupling(Cluster clusterA, Cluster clusterB) {
        List<String> eventLinks = new ArrayList<>();
        
        Set<String> publishedEvents = findPublishedEvents(clusterA.getMembers());
        Set<String> consumedEvents = findConsumedEvents(clusterB.getMembers());
        
        for (String published : publishedEvents) {
            if (consumedEvents.contains(published)) {
                eventLinks.add(published);
            }
        }
        
        publishedEvents = findPublishedEvents(clusterB.getMembers());
        consumedEvents = findConsumedEvents(clusterA.getMembers());
        
        for (String published : publishedEvents) {
            if (consumedEvents.contains(published)) {
                eventLinks.add(published);
            }
        }
        
        return eventLinks;
    }

    private Set<String> findPublishedEvents(List<String> components) {
        Set<String> events = new HashSet<>();
        for (String comp : components) {
            if (containsAny(comp.toLowerCase(), evidence.eventPublisherKeywords())) {
                String simpleName = comp.substring(comp.lastIndexOf('.') + 1);
                events.add(simpleName);
            }
        }
        return events;
    }

    private Set<String> findConsumedEvents(List<String> components) {
        Set<String> events = new HashSet<>();
        for (String comp : components) {
            if (containsAny(comp.toLowerCase(), evidence.eventConsumerKeywords())) {
                String simpleName = comp.substring(comp.lastIndexOf('.') + 1);
                events.add(simpleName);
            }
        }
        return events;
    }

    /**
     * Whether a text contains any of the words.
     *
     * @param text  lower-case text
     * @param words the words
     * @return true when one word occurs in the text
     */
    private static boolean containsAny(final String text,
            final List<String> words) {
        for (String word : words) {
            if (text.contains(word)) {
                return true;
            }
        }
        return false;
    }

    public List<EdgeSignals> getSortedEdges() {
        return edges.entrySet().stream()
            .sorted((e1, e2) -> Double.compare(e2.getValue().getEvidenceScore(), e1.getValue().getEvidenceScore()))
            .map(Map.Entry::getValue)
            .collect(Collectors.toList());
    }

    public EdgeSignals getEdge(int clusterIdA, int clusterIdB) {
        ClusterPair pair = new ClusterPair(clusterIdA, clusterIdB);
        return edges.get(pair);
    }

    public static class ClusterPair {
        private final int idA;
        private final int idB;

        public ClusterPair(int idA, int idB) {
            this.idA = Math.min(idA, idB);
            this.idB = Math.max(idA, idB);
        }

        public int getIdA() { return idA; }
        public int getIdB() { return idB; }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;
            ClusterPair that = (ClusterPair) o;
            return idA == that.idA && idB == that.idB;
        }

        @Override
        public int hashCode() {
            return Objects.hash(idA, idB);
        }
    }

    public static class EdgeSignals {
        private final double tableJaccard;
        private final double callDensity;
        private final double tokenSimilarity;
        private final List<String> eventLinks;
        private final double evidenceScore;
        /** Thresholds of the strong evidence. */
        private final EvidenceConfig config;

        public EdgeSignals(double tableJaccard, double callDensity, double tokenSimilarity, 
                          List<String> eventLinks, double evidenceScore) {
            this(tableJaccard, callDensity, tokenSimilarity, eventLinks,
                    evidenceScore, InferenceConfig.defaults().evidence());
        }

        /**
         * Signals of an edge judged with the given thresholds.
         *
         * @param tableJaccard    table Jaccard
         * @param callDensity     call density
         * @param tokenSimilarity token similarity
         * @param eventLinks      event links
         * @param evidenceScore   weighted evidence score
         * @param config          evidence parameters
         */
        public EdgeSignals(final double tableJaccard, final double callDensity,
                final double tokenSimilarity, final List<String> eventLinks,
                final double evidenceScore, final EvidenceConfig config) {
            this.config = config;
            this.tableJaccard = tableJaccard;
            this.callDensity = callDensity;
            this.tokenSimilarity = tokenSimilarity;
            this.eventLinks = eventLinks;
            this.evidenceScore = evidenceScore;
        }

        public double getTableJaccard() { return tableJaccard; }
        public double getCallDensity() { return callDensity; }
        public double getTokenSimilarity() { return tokenSimilarity; }
        public List<String> getEventLinks() { return eventLinks; }
        public double getEvidenceScore() { return evidenceScore; }

        public boolean hasStrongEvidence() {
            int strongSignals = 0;
            EvidenceConfig.StrongSignals strong = config.strongSignals();
            if (tableJaccard >= strong.table()) {
                strongSignals++;
            }
            if (callDensity >= strong.call()) {
                strongSignals++;
            }
            if (tokenSimilarity >= strong.token()) {
                strongSignals++;
            }
            if (!eventLinks.isEmpty()) {
                strongSignals++;
            }
            return evidenceScore >= config.evidenceThreshold()
                    && strongSignals >= config.minStrongSignals();
        }
    }
}
