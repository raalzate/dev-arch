package com.extractor.service;

/**
 * Analyzer choice of an analysis (007-native-engine-runtime, FR-024).
 * {@link #AUTO} keeps the marker-based detection of previous versions.
 */
public enum AnalysisLanguage {

    /** Java analyzer (Spoon), without consulting the detector. */
    JAVA("java"),

    /** .NET analyzer (Roslyn bridge), without consulting the detector. */
    DOTNET("dotnet"),

    /** Detection from marker files (default). */
    AUTO("auto");

    /** Name used by the MCP schema and the command line. */
    private final String wire;

    AnalysisLanguage(final String wireValue) {
        this.wire = wireValue;
    }

    /**
     * Name used by the MCP schema and the command line.
     *
     * @return {@code java}, {@code dotnet} or {@code auto}
     */
    public String wireName() {
        return wire;
    }

    /**
     * Parses a protocol value; {@code null} means {@link #AUTO}.
     *
     * @param value {@code java}, {@code dotnet}, {@code auto} or null
     * @return the language
     * @throws IllegalArgumentException for any other value
     */
    public static AnalysisLanguage parse(final String value) {
        if (value == null) {
            return AUTO;
        }
        for (AnalysisLanguage language : values()) {
            if (language.wire.equals(value)) {
                return language;
            }
        }
        throw new IllegalArgumentException("Invalid language '" + value
                + "'. Allowed: java, dotnet, auto");
    }
}
