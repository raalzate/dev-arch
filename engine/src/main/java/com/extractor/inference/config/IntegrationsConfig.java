package com.extractor.inference.config;

/**
 * Outbound integration detection of the .NET analyzer (022-external-integrations).
 *
 * @param outbound {@code auto} (Visual Basic compilations only), {@code on} or {@code off}
 */
public record IntegrationsConfig(String outbound) {

    public static final String AUTO = "auto";
    public static final String ON = "on";
    public static final String OFF = "off";

    /** @return true when the analyzer must receive the section */
    public boolean affectsAnalyzer() {
        return !equals(InferenceConfig.defaults().integrations());
    }
}
