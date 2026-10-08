package com.extractor.inference;

import com.extractor.inference.config.ConsolidationConfig;
import com.extractor.inference.config.InferenceConfig;
import com.extractor.model.Component;
import java.util.*;
import java.util.stream.Collectors;

public class ClusterConsolidator {
    /** Infrastructure words compared with the simple class name (008). */
    private final List<String> infrastructureKeywords;
    /** Consolidation parameters (008). */
    private final ConsolidationConfig consolidation;
    /** Whole configuration (names of the merge by domain). */
    private final InferenceConfig config;

    private final List<Cluster> clusters;
    private final InterClusterGraph graph;
    private final Map<Integer, Set<Integer>> mergedGroups;

    public ClusterConsolidator(List<Cluster> clusters, List<Component> allComponents) {
        this(clusters, allComponents, InferenceConfig.defaults());
    }

    /**
     * Consolidator with the given configuration.
     *
     * @param clusters      the clusters
     * @param allComponents every component of the graph
     * @param inference     the inference configuration
     */
    public ClusterConsolidator(final List<Cluster> clusters,
            final List<Component> allComponents,
            final InferenceConfig inference) {
        this.config = inference;
        this.consolidation = inference.consolidation();
        this.infrastructureKeywords =
                inference.consolidation().infrastructureKeywords();
        this.clusters = clusters;
        this.graph = new InterClusterGraph(clusters, allComponents,
                inference.evidence());
        this.mergedGroups = new HashMap<>();
        for (Cluster c : clusters) {
            Set<Integer> group = new HashSet<>();
            group.add(c.getClusterId());
            mergedGroups.put(c.getClusterId(), group);
        }
    }

    public List<Set<Integer>> consolidate() {
        consolidateByDomainName();
        
        List<EdgeCandidate> candidates = findMergeCandidates();
        
        for (EdgeCandidate candidate : candidates) {
            int rootA = findRoot(candidate.clusterIdA);
            int rootB = findRoot(candidate.clusterIdB);
            
            if (rootA != rootB && canMerge(rootA, rootB, candidate.signals)) {
                merge(rootA, rootB);
            }
        }
        
        return mergedGroups.values().stream()
            .filter(group -> !group.isEmpty())
            .distinct()
            .collect(Collectors.toList());
    }
    
    private void consolidateByDomainName() {
        Map<String, List<Integer>> nameToClusterIds = new HashMap<>();
        Set<String> genericNames = Set.copyOf(consolidation.genericNames());
        
        for (Cluster cluster : clusters) {
            Set<Integer> singleClusterSet = new HashSet<>();
            singleClusterSet.add(cluster.getClusterId());
            String name = MicroserviceNameGenerator.generateName(singleClusterSet, clusters,
                    config.naming());
            
            if (!genericNames.contains(name)) {
                nameToClusterIds.computeIfAbsent(name, k -> new ArrayList<>())
                    .add(cluster.getClusterId());
            }
        }
        
        for (Map.Entry<String, List<Integer>> entry : nameToClusterIds.entrySet()) {
            List<Integer> clusterIds = entry.getValue();
            if (clusterIds.size() > 1) {
                int firstRoot = findRoot(clusterIds.get(0));
                for (int i = 1; i < clusterIds.size(); i++) {
                    int nextRoot = findRoot(clusterIds.get(i));
                    if (firstRoot != nextRoot && canMergeSameDomain(firstRoot, nextRoot)) {
                        merge(firstRoot, nextRoot);
                        firstRoot = findRoot(firstRoot);
                    }
                }
            }
        }
    }
    
    private boolean canMergeSameDomain(int rootA, int rootB) {
        if (isSupport(rootA) && !isSupport(rootB)) return false;
        if (isSupport(rootB) && !isSupport(rootA)) return false;
        
        boolean isInfraA = hasSignificantInfrastructure(rootA);
        boolean isInfraB = hasSignificantInfrastructure(rootB);
        if (isInfraA != isInfraB) return false;
        
        Set<Integer> groupA = mergedGroups.get(rootA);
        Set<Integer> groupB = mergedGroups.get(rootB);
        int totalSize = getTotalSize(groupA) + getTotalSize(groupB);
        
        if (totalSize > consolidation.domainMergeMaxSize()) {
            return false;
        }
        
        return true;
    }
    
    private boolean hasSignificantInfrastructure(int clusterId) {
        Set<Integer> group = mergedGroups.get(clusterId);
        if (group == null) return false;
        
        long totalCount = 0;
        long infraCount = 0;
        
        for (int id : group) {
            Cluster cluster = clusters.stream()
                .filter(c -> c.getClusterId() == id)
                .findFirst()
                .orElse(null);
            
            if (cluster != null) {
                totalCount += cluster.getMembers().size();
                infraCount += cluster.getMembers().stream()
                    .filter(member -> {
                        String simpleClassName = member.contains(".") 
                            ? member.substring(member.lastIndexOf('.') + 1).toLowerCase()
                            : member.toLowerCase();
                        return infrastructureKeywords.stream().anyMatch(simpleClassName::contains);
                    })
                    .count();
            }
        }
        
        return totalCount > 0 && ((double) infraCount / totalCount)
                >= consolidation.significantInfrastructureRatio();
    }

    private List<EdgeCandidate> findMergeCandidates() {
        List<EdgeCandidate> candidates = new ArrayList<>();
        
        for (int i = 0; i < clusters.size(); i++) {
            for (int j = i + 1; j < clusters.size(); j++) {
                InterClusterGraph.EdgeSignals signals = graph.getEdge(clusters.get(i).getClusterId(), 
                                                                       clusters.get(j).getClusterId());
                if (signals != null && signals.hasStrongEvidence()) {
                    candidates.add(new EdgeCandidate(clusters.get(i).getClusterId(), 
                                                    clusters.get(j).getClusterId(), 
                                                    signals));
                }
            }
        }
        
        candidates.sort((a, b) -> Double.compare(b.signals.getEvidenceScore(), 
                                                a.signals.getEvidenceScore()));
        return candidates;
    }

    private boolean canMerge(int rootA, int rootB, InterClusterGraph.EdgeSignals signals) {
        Set<Integer> groupA = mergedGroups.get(rootA);
        Set<Integer> groupB = mergedGroups.get(rootB);
        
        if (isSupport(rootA) && !isSupport(rootB)) return false;
        if (isSupport(rootB) && !isSupport(rootA)) return false;
        
        int totalSize = getTotalSize(groupA) + getTotalSize(groupB);
        if (totalSize > consolidation.maxMergedSizeWithoutSimilarity()
                && signals.getTokenSimilarity() < consolidation.highTokenSimilarity()) {
            return false;
        }

        if (bothStrongCandidates(groupA, groupB)
                && signals.getCallDensity() < consolidation.separationCallDensity()
                && signals.getTableJaccard() < consolidation.separationTableJaccard()) {
            return false;
        }
        
        return true;
    }

    private boolean isSupport(int clusterId) {
        Cluster cluster = clusters.stream()
            .filter(c -> c.getClusterId() == clusterId)
            .findFirst()
            .orElse(null);
        
        if (cluster == null) return false;
        
        long infraCount = cluster.getMembers().stream()
            .filter(member -> {
                String simpleClassName = member.contains(".") 
                    ? member.substring(member.lastIndexOf('.') + 1).toLowerCase()
                    : member.toLowerCase();
                return infrastructureKeywords.stream().anyMatch(simpleClassName::contains);
            })
            .count();

        return cluster.getMembers().size() > 0
                && ((double) infraCount / cluster.getMembers().size())
                >= consolidation.supportRatio();
    }

    /**
     * Consolidated groups keyed by their root cluster (after
     * {@link #consolidate()}); used by the support-guard invariant (008).
     *
     * @return root id to the cluster ids of its group
     */
    public Map<Integer, Set<Integer>> groupsByRoot() {
        Map<Integer, Set<Integer>> out = new TreeMap<>();
        mergedGroups.forEach((root, group) -> {
            if (!group.isEmpty()) {
                out.put(root, new TreeSet<>(group));
            }
        });
        return out;
    }

    /**
     * Support status of one cluster (the 1.2.0 root-only guard).
     *
     * @param clusterId the cluster
     * @return true when it is a support cluster
     */
    public boolean isSupportCluster(final int clusterId) {
        return isSupport(clusterId);
    }

    /**
     * Support status computed over every member of a group.
     *
     * @param group cluster ids
     * @return true when the infrastructure share reaches the support ratio
     */
    public boolean isSupportGroup(final Set<Integer> group) {
        long total = 0;
        long infra = 0;
        for (Cluster cluster : clusters) {
            if (!group.contains(cluster.getClusterId())) {
                continue;
            }
            for (String member : cluster.getMembers()) {
                total++;
                String simple = member.contains(".")
                        ? member.substring(member.lastIndexOf('.') + 1).toLowerCase()
                        : member.toLowerCase();
                if (infrastructureKeywords.stream().anyMatch(simple::contains)) {
                    infra++;
                }
            }
        }
        return total > 0 && ((double) infra / total) >= consolidation.supportRatio();
    }

    private int getTotalSize(Set<Integer> group) {
        return group.stream()
            .map(id -> clusters.stream()
                .filter(c -> c.getClusterId() == id)
                .findFirst()
                .map(c -> c.getMembers().size())
                .orElse(0))
            .reduce(0, Integer::sum);
    }

    private boolean bothStrongCandidates(Set<Integer> groupA, Set<Integer> groupB) {
        boolean strongA = groupA.stream().anyMatch(this::isStrongCandidate);
        boolean strongB = groupB.stream().anyMatch(this::isStrongCandidate);
        return strongA && strongB;
    }

    private boolean isStrongCandidate(int clusterId) {
        Cluster cluster = clusters.stream()
            .filter(c -> c.getClusterId() == clusterId)
            .findFirst()
            .orElse(null);
        
        if (cluster == null) return false;
        
        ClusterMetrics metrics = cluster.getMetrics();
        ConsolidationConfig.StrongCandidate strong = consolidation.strongCandidate();
        return metrics.getCohesion() >= strong.minCohesion()
                && metrics.getCoupling() < strong.maxCoupling()
                && cluster.getMembers().size() >= strong.minSize();
    }

    private int findRoot(int clusterId) {
        for (Map.Entry<Integer, Set<Integer>> entry : mergedGroups.entrySet()) {
            if (entry.getValue().contains(clusterId)) {
                return entry.getKey();
            }
        }
        return clusterId;
    }

    private void merge(int rootA, int rootB) {
        Set<Integer> groupA = mergedGroups.get(rootA);
        Set<Integer> groupB = mergedGroups.get(rootB);
        
        groupA.addAll(groupB);
        mergedGroups.put(rootB, Collections.emptySet());
    }

    private static class EdgeCandidate {
        final int clusterIdA;
        final int clusterIdB;
        final InterClusterGraph.EdgeSignals signals;

        EdgeCandidate(int clusterIdA, int clusterIdB, InterClusterGraph.EdgeSignals signals) {
            this.clusterIdA = clusterIdA;
            this.clusterIdB = clusterIdB;
            this.signals = signals;
        }
    }
}
