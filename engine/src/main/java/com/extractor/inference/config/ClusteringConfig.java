package com.extractor.inference.config;

/**
 * Initial clustering parameters ({@code ClusteringAlgorithm}).
 *
 * @param singleDomainRatio share of the largest domain above which the
 *                          project is treated as single-domain
 * @param largeClusterRatio share of the largest cluster above which the
 *                          business clustering falls back to domains
 */
public record ClusteringConfig(double singleDomainRatio,
        double largeClusterRatio) {
}
