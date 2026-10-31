package com.extractor.inference.config;

/**
 * Inference-wide parameters (023-legacy-desktop-inference).
 *
 * @param preset                 {@value #AUTO}, {@value #NONE} or a preset name
 *                               such as {@value #LEGACY_DESKTOP}
 * @param presentationInCohesion whether presentation members
 *                               ({@code Layer:Presentación}, {@code Layer:Reportes})
 *                               count in the cohesion and the internal density
 */
public record InferenceSection(String preset, boolean presentationInCohesion) {

    /** The preset is chosen from the graph (legacy-desktop for VB graphs). */
    public static final String AUTO = "auto";

    /** No preset is ever applied. */
    public static final String NONE = "none";

    /** Calibration of the .NET Framework desktop profile. */
    public static final String LEGACY_DESKTOP = "legacy-desktop";
}
