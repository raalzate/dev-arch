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
    /** Every component of the graph (023: vertical slices). */
    private final List<Component> allComponents;
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
        this.allComponents = allComponents;
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

        if (consolidation.entityStemMerge()) {
            consolidateByEntityStem();
        }
        if (consolidation.verticalSliceRatio() > 0) {
            consolidateVerticalSlices();
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
            // 023 (naming.strategy = domain): clusters of the same namespace domain share a name.
            if (config.naming().domainStrategy()) {
                String domain = DomainNames.domain(cluster.getMembers(), graphPrefix());
                if (domain != null && !DomainNames.GLOBAL.equals(domain)) {
                    name = "Componente de " + domain;
                }
            }
            
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
    
    /**
     * Vertical slices (023, preset legacy-desktop): a cluster whose outgoing
     * cross-cluster calls go mostly (>= {@code consolidation.verticalSliceRatio})
     * to one other non-support cluster is merged with it, so the forms,
     * controllers and adapters of one domain end in the same proposal. Support
     * clusters (infrastructure words or support namespaces) are neither sources
     * nor targets and do not count in the share. Clusters are visited in id
     * order; ties go to the lowest target id (deterministic).
     */
    private void consolidateVerticalSlices() {
        Map<String, Integer> clusterOf = new HashMap<>();
        List<Cluster> ordered = clusters.stream()
            .sorted(Comparator.comparingInt(Cluster::getClusterId)).toList();
        for (Cluster c : ordered) {
            for (String m : c.getMembers()) {
                clusterOf.putIfAbsent(m, c.getClusterId());
            }
        }
        Map<String, Component> byId = new HashMap<>();
        for (Component c : allComponents) {
            byId.putIfAbsent(c.getId(), c);
        }
        boolean changed = true;
        for (int pass = 0; changed && pass < ordered.size(); pass++) {
            changed = false;
        for (Cluster source : ordered) {
            if (isSupport(source.getClusterId()) || inSupportNamespace(source)) continue;
            Map<Integer, Integer> targets = new TreeMap<>();
            int total = 0;
            for (String m : source.getMembers()) {
                Component comp = byId.get(m);
                if (comp == null || comp.getCallsOut() == null) continue;
                for (String called : comp.getCallsOut()) {
                    Integer target = clusterOf.get(called);
                    if (target == null || findRoot(target) == findRoot(source.getClusterId())) continue;
                    Cluster tc = clusterById(target);
                    if (tc == null || isSupport(target) || inSupportNamespace(tc)) continue;
                    targets.merge(findRoot(target), 1, Integer::sum);
                    total++;
                }
            }
            if (total == 0) continue;
            int best = -1;
            int bestCount = 0;
            for (Map.Entry<Integer, Integer> e : targets.entrySet()) {
                if (e.getValue() > bestCount) {
                    best = e.getKey();
                    bestCount = e.getValue();
                }
            }
            if (best < 0 || (double) bestCount / total < consolidation.verticalSliceRatio()) continue;
            int rootA = findRoot(source.getClusterId());
            int rootB = findRoot(best);
            if (rootA == rootB) continue;
            int totalSize = getTotalSize(mergedGroups.get(rootA)) + getTotalSize(mergedGroups.get(rootB));
            if (totalSize > consolidation.domainMergeMaxSize()) continue;
            merge(rootA, rootB);
            changed = true;
        }
        }
    }

    /**
     * Entity stems (023, {@code consolidation.entityStemMerge}): the dominant
     * procedure entity of each non-support cluster is tokenized; when one
     * first token leads at least half of the entities ({@code Policy}) it is
     * the corpus prefix and the stem is the next token ({@code Premium});
     * otherwise the stem is the first token. Clusters with the same stem merge
     * in id order while the combined size stays within
     * {@code consolidation.domainMergeMaxSize}.
     */
    private void consolidateByEntityStem() {
        Map<String, Component> byId = new HashMap<>();
        for (Component c : allComponents) {
            byId.putIfAbsent(c.getId(), c);
        }
        List<Cluster> ordered = clusters.stream()
            .sorted(Comparator.comparingInt(Cluster::getClusterId)).toList();
        Map<Integer, List<String>> entityTokens = new LinkedHashMap<>();
        Map<String, Integer> firstTokenCounts = new HashMap<>();
        for (Cluster c : ordered) {
            if (isSupport(c.getClusterId()) || inSupportNamespace(c)) continue;
            List<Component> members = c.getMembers().stream().map(byId::get)
                .filter(Objects::nonNull).toList();
            List<String> tokens = ProcedureEntityHeuristic.tokens(
                ProcedureEntityHeuristic.dominantEntity(members));
            if (tokens.isEmpty()) continue;
            entityTokens.put(c.getClusterId(), tokens);
            firstTokenCounts.merge(tokens.get(0), 1, Integer::sum);
        }
        if (entityTokens.isEmpty()) return;
        String prefix = null;
        int prefixCount = 0;
        for (Map.Entry<String, Integer> e : new TreeMap<>(firstTokenCounts).entrySet()) {
            if (e.getValue() > prefixCount) {
                prefix = e.getKey();
                prefixCount = e.getValue();
            }
        }
        if (prefixCount * 2 < entityTokens.size()) prefix = null;
        Map<String, Integer> stemRoot = new HashMap<>();
        for (Map.Entry<Integer, List<String>> e : entityTokens.entrySet()) {
            List<String> tokens = e.getValue();
            String stem = tokens.get(0);
            if (prefix != null && prefix.equals(tokens.get(0)) && tokens.size() > 1) {
                stem = tokens.get(1);
            }
            Integer root = stemRoot.get(stem);
            if (root == null) {
                stemRoot.put(stem, findRoot(e.getKey()));
                continue;
            }
            int rootA = findRoot(root);
            int rootB = findRoot(e.getKey());
            if (rootA == rootB) continue;
            int totalSize = getTotalSize(mergedGroups.get(rootA)) + getTotalSize(mergedGroups.get(rootB));
            if (totalSize > consolidation.domainMergeMaxSize()) continue;
            merge(rootA, rootB);
            stemRoot.put(stem, findRoot(rootA));
        }
    }

    private List<String> graphPrefix() {
        return DomainNames.commonPrefix(allComponents.stream().map(Component::getId).sorted().toList());
    }

    private Cluster clusterById(int id) {
        return clusters.stream().filter(c -> c.getClusterId() == id).findFirst().orElse(null);
    }

    /** Whether most members of a cluster live under a support namespace (023, FR-030). */
    private boolean inSupportNamespace(Cluster cluster) {
        List<String> support = config.recommendation().supportNamespaces();
        if (support.isEmpty() || cluster.getMembers().isEmpty()) return false;
        long count = cluster.getMembers().stream().filter(m -> {
            String ns = m.contains(".") ? m.substring(0, m.lastIndexOf('.')) : "";
            for (String segment : ns.split("\\.")) {
                for (String word : support) {
                    if (segment.equalsIgnoreCase(word)) return true;
                }
            }
            return false;
        }).count();
        return (double) count / cluster.getMembers().size() >= config.recommendation().supportRatio();
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
