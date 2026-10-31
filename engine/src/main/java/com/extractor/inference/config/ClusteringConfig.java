package com.extractor.inference.config;

/**
 * Initial clustering parameters ({@code ClusteringAlgorithm}).
 *
 * @param singleDomainRatio share of the largest domain above which the
 *                          project is treated as single-domain
 * @param attachCallersToTargets 023: in the entity path, a component without
 *                               procedures joins the cluster it calls most
 *                               instead of the first cluster
 * @param procedureGrouping      {@value #TRANSITIVE} (020) or {@value #ENTITY} (023)
 * @param largeClusterRatio share of the largest cluster above which the
 *                          business clustering falls back to domains
 */
public record ClusteringConfig(double singleDomainRatio,
        double largeClusterRatio, boolean attachCallersToTargets,
        String procedureGrouping) {

    /** 020: components connected transitively by shared procedures form one cluster. */
    public static final String TRANSITIVE = "transitive";

    /** 023: components grouped by the stem of their dominant procedure entity. */
    public static final String ENTITY = "entity";

    /**
     * Whether procedure-bearing components are grouped by entity stem.
     *
     * @return true in {@value #ENTITY} mode
     */
    public boolean entityGrouping() {
        return ENTITY.equals(procedureGrouping);
    }
}
