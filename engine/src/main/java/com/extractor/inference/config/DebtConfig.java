package com.extractor.inference.config;

/**
 * Legacy debt rules of the .NET analyzer (021-desktop-identity-layers, contracts/debt-config-and-annotations.md).
 *
 * @param enabled  {@code auto} (Visual Basic compilations only), {@code on} or {@code off}
 * @param godClass god class thresholds
 */
public record DebtConfig(String enabled, GodClass godClass) {

    public static final String AUTO = "auto";
    public static final String ON = "on";
    public static final String OFF = "off";

    /**
     * Thresholds of the GOD_CLASS rule.
     *
     * @param minLoc        lines of code above which a type may be a god class
     * @param minComplexity maximum method complexity above which a type may be a god class
     */
    public record GodClass(int minLoc, int minComplexity) {
    }

    /**
     * Whether the .NET analyzer needs the section (anything other than its defaults).
     *
     * @return true when the analyzer must receive the section
     */
    public boolean affectsAnalyzer() {
        return !equals(InferenceConfig.defaults().debt());
    }
}
