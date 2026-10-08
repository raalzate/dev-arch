package com.extractor.inference;

import com.extractor.inference.config.InferenceConfig;
import com.extractor.inference.config.NamingConfig;
import java.util.*;
import java.util.stream.Collectors;

public class MicroserviceNameGenerator {

    public static String generateName(Set<Integer> clusterIds, List<Cluster> allClusters) {
        return generateName(clusterIds, allClusters,
                InferenceConfig.defaults().naming());
    }

    /**
     * Name of a group of clusters with the given naming parameters (008).
     *
     * @param clusterIds  ids of the clusters of the group
     * @param allClusters every cluster
     * @param naming      naming parameters
     * @return the name
     */
    public static String generateName(final Set<Integer> clusterIds,
            final List<Cluster> allClusters, final NamingConfig naming) {
        List<Cluster> clusters = clusterIds.stream()
            .map(id -> allClusters.stream()
                .filter(c -> c.getClusterId() == id)
                .findFirst()
                .orElse(null))
            .filter(Objects::nonNull)
            .collect(Collectors.toList());
        
        if (clusters.isEmpty()) return "Componente Desconocido";
        
        if (isInfrastructure(clusters, naming)) {
            return generateInfrastructureName(clusters, naming);
        }
        
        return generateBusinessName(clusters, naming);
    }

    private static boolean isInfrastructure(List<Cluster> clusters, NamingConfig naming) {
        Map<String, String> infraKeywords = naming.infrastructureLabels();
        long infraCount = clusters.stream()
            .flatMap(c -> c.getMembers().stream())
            .filter(member -> {
                String lower = member.toLowerCase();
                return infraKeywords.keySet().stream().anyMatch(lower::contains);
            })
            .count();
        
        long totalComponents = clusters.stream()
            .mapToLong(c -> c.getMembers().size())
            .sum();
        
        return totalComponents > 0
                && ((double) infraCount / totalComponents) >= naming.infrastructureRatio();
    }

    private static String generateInfrastructureName(List<Cluster> clusters, NamingConfig naming) {
        Map<String, String> infraKeywords = naming.infrastructureLabels();
        Map<String, Long> keywordCounts = new HashMap<>();
        
        for (Cluster cluster : clusters) {
            for (String member : cluster.getMembers()) {
                String lower = member.toLowerCase();
                for (String keyword : infraKeywords.keySet()) {
                    if (lower.contains(keyword)) {
                        keywordCounts.merge(keyword, 1L, Long::sum);
                    }
                }
            }
        }
        
        if (keywordCounts.isEmpty()) {
            return "Componente de Infraestructura";
        }
        
        List<String> topKeywords = keywordCounts.entrySet().stream()
            .sorted((e1, e2) -> Long.compare(e2.getValue(), e1.getValue()))
            .limit(2)
            .map(e -> infraKeywords.get(e.getKey()))
            .collect(Collectors.toList());
        
        if (topKeywords.size() == 1) {
            return "Componente de " + topKeywords.get(0);
        } else {
            return "Componente de " + String.join(" & ", topKeywords);
        }
    }

    private static String generateBusinessName(List<Cluster> clusters, NamingConfig naming) {
        Map<String, Integer> tokenFrequency = new HashMap<>();
        
        for (Cluster cluster : clusters) {
            Set<String> domainTokens = extractDomainTokens(cluster.getMembers(), naming);
            for (String token : domainTokens) {
                tokenFrequency.merge(token, 1, Integer::sum);
            }
        }
        
        if (tokenFrequency.isEmpty()) {
            return "Componente de Negocio";
        }
        
        List<String> topTokens = tokenFrequency.entrySet().stream()
            .sorted((e1, e2) -> Integer.compare(e2.getValue(), e1.getValue()))
            .limit(2)
            .map(Map.Entry::getKey)
            .map(MicroserviceNameGenerator::capitalize)
            .collect(Collectors.toList());
        
        if (topTokens.size() == 1) {
            return "Componente de " + topTokens.get(0);
        } else {
            return "Componente de " + String.join(" y ", topTokens);
        }
    }

    private static Set<String> extractDomainTokens(List<String> components, NamingConfig naming) {
        Set<String> tokens = new HashSet<>();
        Set<String> excludeTokens = Set.copyOf(naming.excludeTokens());
        int minLength = naming.minTokenLength();
        // Ordered: the first matching role wins, so iteration order must be fixed (BUG-004)
        List<String> roleKeywords = List.of(naming.roleKeywords().toArray(new String[0]));
        
        for (String comp : components) {
            String simpleName = comp.substring(comp.lastIndexOf('.') + 1).toLowerCase();
            String packageName = comp.substring(0, Math.max(0, comp.lastIndexOf('.')));
            
            for (String role : roleKeywords) {
                if (simpleName.contains(role)) {
                    String token = simpleName.replaceAll(role + ".*", "")
                                            .replaceAll("repository", "")
                                            .replaceAll("impl", "");
                    if (!token.isEmpty() && !excludeTokens.contains(token) && token.length() >= minLength) {
                        tokens.add(token);
                    }
                    
                    String[] packageParts = packageName.split("\\.");
                    if (packageParts.length > 0) {
                        String lastPackage = packageParts[packageParts.length - 1];
                        if (!excludeTokens.contains(lastPackage) && lastPackage.length() >= minLength) {
                            tokens.add(lastPackage);
                        }
                    }
                    break;
                }
            }
        }
        
        return tokens;
    }

    private static String capitalize(String str) {
        if (str == null || str.isEmpty()) return str;
        return str.substring(0, 1).toUpperCase() + str.substring(1);
    }
}
