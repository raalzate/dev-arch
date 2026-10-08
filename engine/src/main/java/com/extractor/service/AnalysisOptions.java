package com.extractor.service;

/**
 * Options of an analysis request (007-native-engine-runtime, research D5).
 *
 * @param language analyzer choice
 */
public record AnalysisOptions(AnalysisLanguage language) {

    /** Automatic detection: the behaviour of previous versions. */
    public static final AnalysisOptions DEFAULT =
            new AnalysisOptions(AnalysisLanguage.AUTO);

    /**
     * Normalizes a missing language to {@link AnalysisLanguage#AUTO}.
     *
     * @param language analyzer choice, null for automatic detection
     */
    public AnalysisOptions {
        if (language == null) {
            language = AnalysisLanguage.AUTO;
        }
    }

    /**
     * Options with the given language.
     *
     * @param language analyzer choice
     * @return the options
     */
    public static AnalysisOptions of(final AnalysisLanguage language) {
        return new AnalysisOptions(language);
    }
}
