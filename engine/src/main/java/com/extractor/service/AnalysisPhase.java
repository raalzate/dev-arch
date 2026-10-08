package com.extractor.service;

/**
 * Ordered phases of a full analysis (007-native-engine-runtime, FR-023).
 * WRITING is emitted by the adapter that writes the documents.
 */
public enum AnalysisPhase {

    /** Project type detection. */
    DETECTION("detection"),

    /** Source extraction by the language analyzer. */
    EXTRACTION("extraction"),

    /** Inference of the architecture proposals. */
    INFERENCE("inference"),

    /** Writing of the output documents. */
    WRITING("writing");

    /** Name sent in progress notifications. */
    private final String wire;

    AnalysisPhase(final String wireValue) {
        this.wire = wireValue;
    }

    /**
     * Name sent in progress notifications.
     *
     * @return lower-case phase name
     */
    public String wireName() {
        return wire;
    }
}
