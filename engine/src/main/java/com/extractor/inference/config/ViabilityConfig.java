package com.extractor.inference.config;

/**
 * Viability score parameters ({@code ViabilityScorer}).
 *
 * @param weights              weights of the score terms
 * @param cohesionBlend        blend of the adjusted cohesion
 * @param noTablesDataCohesion data cohesion of a proposal without tables
 * @param smallSize            small size penalty
 * @param largeSize            large size (monolith) penalty
 * @param thresholds           classification thresholds
 * @param rationale            cuts of the rationale messages
 * @param debtWeight           weight of the debt index subtracted from the score
 *                             (023; 0 = the score ignores debt)
 * @param ignoreSupportCoupling  023: calls to support-library members do not
 *                             count as external coupling
 */
public record ViabilityConfig(Weights weights, CohesionBlend cohesionBlend,
        double noTablesDataCohesion, SmallSize smallSize,
        LargeSize largeSize, Thresholds thresholds,
        RationaleConfig rationale, double debtWeight,
        boolean ignoreSupportCoupling) {

    /**
     * Weights of the score.
     *
     * @param cohesion weight of the adjusted cohesion
     * @param coupling weight of one minus the external coupling
     * @param data     weight of the data cohesion
     */
    public record Weights(double cohesion, double coupling, double data) {
    }

    /**
     * Adjusted cohesion = average × avg cohesion + density × density.
     *
     * @param average weight of the size-weighted average cohesion
     * @param density weight of the internal edge density
     */
    public record CohesionBlend(double average, double density) {
    }

    /**
     * Penalty of proposals with fewer members than {@code below}.
     *
     * @param below   size threshold
     * @param penalty score factor
     */
    public record SmallSize(int below, double penalty) {
    }

    /**
     * Penalty of sparse proposals with more members than {@code above}.
     *
     * @param above      size threshold
     * @param minDensity internal density below which the penalty applies
     * @param penalty    score factor
     */
    public record LargeSize(int above, double minDensity, double penalty) {
    }

    /**
     * Classification thresholds.
     *
     * @param high   minimum score of "Alta"
     * @param medium minimum score of "Media"
     */
    public record Thresholds(double high, double medium) {
    }
}
