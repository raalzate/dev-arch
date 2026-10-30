package com.extractor.inference.config;

import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Range and coherence rules of an inference configuration (research D4).
 */
final class InferenceConfigValidator {

    /** Upper bound of the nested detection depth. */
    private static final int MAX_DEPTH = 5;

    /** Number of evidence signals (upper bound of minStrongSignals). */
    private static final int SIGNALS = 4;

    private InferenceConfigValidator() {
    }

    /**
     * Validates every parameter.
     *
     * @param c the configuration
     * @throws InvalidConfigException on the first invalid parameter
     */
    static void validate(final InferenceConfig c) {
        between("detection.maxDepth", c.detection().maxDepth(), 0,
                MAX_DEPTH);
        ratio("clustering.singleDomainRatio",
                c.clustering().singleDomainRatio());
        ratio("clustering.largeClusterRatio",
                c.clustering().largeClusterRatio());
        evidence(c.evidence());
        consolidation(c.consolidation());
        viability(c.viability());
        recommendation(c.recommendation());
        naming(c.naming());
        dataAccess(c.dataAccess());
    }

    /**
     * Data access rules (020).
     *
     * @param d data access parameters
     */
    private static void dataAccess(final DataAccessConfig d) {
        String p = "dataAccess.";
        List<String> modes = List.of(DataAccessConfig.AUTO, DataAccessConfig.ON,
                DataAccessConfig.OFF);
        if (!modes.contains(d.procedures())) {
            throw InvalidConfigException.parameter(p + "procedures",
                    "must be one of " + String.join(", ", modes));
        }
        List<String> catalogModes = List.of(DataAccessConfig.COMPLEMENT,
                DataAccessConfig.REPLACE);
        if (!catalogModes.contains(d.catalogMode())) {
            throw InvalidConfigException.parameter(p + "catalogMode",
                    "must be one of " + String.join(", ", catalogModes));
        }
        if (!(d.procedureWeight() >= 0)) {
            throw InvalidConfigException.parameter(p + "procedureWeight",
                    "must be >= 0");
        }
    }

    /**
     * Evidence rules.
     *
     * @param e evidence parameters
     */
    private static void evidence(final EvidenceConfig e) {
        String p = "evidence.";
        ratio(p + "weights.table", e.weights().table());
        ratio(p + "weights.call", e.weights().call());
        ratio(p + "weights.token", e.weights().token());
        ratio(p + "weights.event", e.weights().event());
        ratio(p + "edgeThreshold", e.edgeThreshold());
        double saturation = e.callDensitySaturation();
        if (!(saturation > 0 && saturation <= 1)) {
            throw InvalidConfigException.parameter(
                    p + "callDensitySaturation", "must be > 0 and <= 1");
        }
        ratio(p + "strongSignals.table", e.strongSignals().table());
        ratio(p + "strongSignals.call", e.strongSignals().call());
        ratio(p + "strongSignals.token", e.strongSignals().token());
        ratio(p + "evidenceThreshold", e.evidenceThreshold());
        between(p + "minStrongSignals", e.minStrongSignals(), 0, SIGNALS);
        keywords(p + "roleKeywords", e.roleKeywords());
        nonBlank(p + "excludeTokens", e.excludeTokens());
        nonNegative(p + "minPackageTokenLength", e.minPackageTokenLength());
        keywords(p + "eventPublisherKeywords", e.eventPublisherKeywords());
        keywords(p + "eventConsumerKeywords", e.eventConsumerKeywords());
    }

    /**
     * Consolidation rules.
     *
     * @param c consolidation parameters
     */
    private static void consolidation(final ConsolidationConfig c) {
        String p = "consolidation.";
        nonBlank(p + "genericNames", c.genericNames());
        nonNegative(p + "domainMergeMaxSize", c.domainMergeMaxSize());
        ratio(p + "significantInfrastructureRatio",
                c.significantInfrastructureRatio());
        ratio(p + "supportRatio", c.supportRatio());
        nonNegative(p + "maxMergedSizeWithoutSimilarity",
                c.maxMergedSizeWithoutSimilarity());
        ratio(p + "highTokenSimilarity", c.highTokenSimilarity());
        ratio(p + "separationCallDensity", c.separationCallDensity());
        ratio(p + "separationTableJaccard", c.separationTableJaccard());
        ratio(p + "strongCandidate.minCohesion",
                c.strongCandidate().minCohesion());
        ratio(p + "strongCandidate.maxCoupling",
                c.strongCandidate().maxCoupling());
        nonNegative(p + "strongCandidate.minSize",
                c.strongCandidate().minSize());
        keywords(p + "infrastructureKeywords", c.infrastructureKeywords());
    }

    /**
     * Viability rules.
     *
     * @param v viability parameters
     */
    private static void viability(final ViabilityConfig v) {
        String p = "viability.";
        ratio(p + "weights.cohesion", v.weights().cohesion());
        ratio(p + "weights.coupling", v.weights().coupling());
        ratio(p + "weights.data", v.weights().data());
        ratio(p + "cohesionBlend.average", v.cohesionBlend().average());
        ratio(p + "cohesionBlend.density", v.cohesionBlend().density());
        ratio(p + "noTablesDataCohesion", v.noTablesDataCohesion());
        nonNegative(p + "smallSize.below", v.smallSize().below());
        ratio(p + "smallSize.penalty", v.smallSize().penalty());
        nonNegative(p + "largeSize.above", v.largeSize().above());
        ratio(p + "largeSize.minDensity", v.largeSize().minDensity());
        ratio(p + "largeSize.penalty", v.largeSize().penalty());
        ratio(p + "thresholds.high", v.thresholds().high());
        ratio(p + "thresholds.medium", v.thresholds().medium());
        atMost(p + "thresholds.medium", v.thresholds().medium(),
                p + "thresholds.high", v.thresholds().high());
        RationaleConfig r = v.rationale();
        String q = p + "rationale.";
        ratio(q + "cohesionGood", r.cohesionGood());
        ratio(q + "cohesionFair", r.cohesionFair());
        atMost(q + "cohesionFair", r.cohesionFair(), q + "cohesionGood",
                r.cohesionGood());
        ratio(q + "couplingGood", r.couplingGood());
        ratio(q + "couplingFair", r.couplingFair());
        atMost(q + "couplingGood", r.couplingGood(), q + "couplingFair",
                r.couplingFair());
        nonNegative(q + "cboGood", r.cboGood());
        nonNegative(q + "cboFair", r.cboFair());
        atMost(q + "cboGood", r.cboGood(), q + "cboFair", r.cboFair());
        ratio(q + "lcomGood", r.lcomGood());
        ratio(q + "lcomFair", r.lcomFair());
        atMost(q + "lcomGood", r.lcomGood(), q + "lcomFair", r.lcomFair());
        ratio(q + "dataGood", r.dataGood());
        ratio(q + "dataFair", r.dataFair());
        atMost(q + "dataFair", r.dataFair(), q + "dataGood", r.dataGood());
    }

    /**
     * Recommendation rules.
     *
     * @param r recommendation parameters
     */
    private static void recommendation(final RecommendationConfig r) {
        String p = "recommendation.";
        ratio(p + "supportRatio", r.supportRatio());
        keywords(p + "infrastructureKeywords", r.infrastructureKeywords());
        List<String> modes = List.of(RecommendationConfig.LEGACY,
                RecommendationConfig.DATA_COHESION);
        if (!modes.contains(r.dataJaccardMode())) {
            throw InvalidConfigException.parameter(p + "dataJaccardMode",
                    "must be one of " + String.join(", ", modes));
        }
        ratio(p + "legacyDataJaccard", r.legacyDataJaccard());
    }

    /**
     * Naming rules.
     *
     * @param n naming parameters
     */
    private static void naming(final NamingConfig n) {
        String p = "naming.";
        ratio(p + "infrastructureRatio", n.infrastructureRatio());
        for (Map.Entry<String, String> label
                : n.infrastructureLabels().entrySet()) {
            keyword(p + "infrastructureLabels." + label.getKey(),
                    label.getKey());
            if (label.getValue().isBlank()) {
                throw InvalidConfigException.parameter(
                        p + "infrastructureLabels." + label.getKey(),
                        "must be a non-blank string");
            }
        }
        keywords(p + "roleKeywords", n.roleKeywords());
        nonBlank(p + "excludeTokens", n.excludeTokens());
        nonNegative(p + "minTokenLength", n.minTokenLength());
    }

    /**
     * Value in [0, 1].
     *
     * @param path  dotted path
     * @param value value
     */
    private static void ratio(final String path, final double value) {
        if (!(value >= 0 && value <= 1)) {
            throw InvalidConfigException.parameter(path,
                    "must be between 0 and 1");
        }
    }

    /**
     * Integer in [min, max].
     *
     * @param path  dotted path
     * @param value value
     * @param min   lower bound
     * @param max   upper bound
     */
    private static void between(final String path, final int value,
            final int min, final int max) {
        if (value < min || value > max) {
            throw InvalidConfigException.parameter(path, "must be between "
                    + min + " and " + max);
        }
    }

    /**
     * Value not negative.
     *
     * @param path  dotted path
     * @param value value
     */
    private static void nonNegative(final String path, final double value) {
        if (!(value >= 0)) {
            throw InvalidConfigException.parameter(path, "must be >= 0");
        }
    }

    /**
     * {@code low <= high}.
     *
     * @param lowPath  path of the lower value
     * @param low      lower value
     * @param highPath path of the higher value
     * @param high     higher value
     */
    private static void atMost(final String lowPath, final double low,
            final String highPath, final double high) {
        if (low > high) {
            throw InvalidConfigException.parameter(lowPath, "must be <= "
                    + highPath);
        }
    }

    /**
     * Non-blank lower-case words.
     *
     * @param path  dotted path
     * @param words the list
     */
    private static void keywords(final String path,
            final List<String> words) {
        for (int i = 0; i < words.size(); i++) {
            keyword(path + "[" + i + "]", words.get(i));
        }
    }

    /**
     * Non-blank lower-case word.
     *
     * @param path dotted path
     * @param word the word
     */
    private static void keyword(final String path, final String word) {
        if (word == null || word.isBlank()) {
            throw InvalidConfigException.parameter(path,
                    "must be a non-blank string");
        }
        if (!word.equals(word.toLowerCase(Locale.ROOT))) {
            throw InvalidConfigException.parameter(path,
                    "must be lower case");
        }
    }

    /**
     * Non-blank strings.
     *
     * @param path   dotted path
     * @param values the list
     */
    private static void nonBlank(final String path,
            final List<String> values) {
        for (int i = 0; i < values.size(); i++) {
            String value = values.get(i);
            if (value == null || value.isBlank()) {
                throw InvalidConfigException.parameter(path + "[" + i + "]",
                        "must be a non-blank string");
            }
        }
    }
}
