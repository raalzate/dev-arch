package com.extractor.service;

/**
 * Receives the phases of a full analysis (007-native-engine-runtime).
 */
@FunctionalInterface
public interface AnalysisProgressListener {

    /** Listener that ignores every phase. */
    AnalysisProgressListener NOOP = phase -> { };

    /**
     * Called when a phase starts.
     *
     * @param phase the phase that starts
     */
    void onPhase(AnalysisPhase phase);
}
