package com.extractor.inference;

import com.extractor.model.CodeIssue;
import com.extractor.model.Component;

import java.util.Collection;
import java.util.Locale;

/**
 * Technical debt index of components and proposals (023, FR-040/FR-041).
 *
 * <p>Component: {@code issues = Σ(CRITICAL 8, ERROR 4, WARNING 2, INFO 0.5)};
 * {@code density = issues / max(1, loc / 100)};
 * {@code base = 1 − 1 / (1 + density / 10)}; +0.10 per {@code Dependency:eol:*}
 * annotation (at most 0.30); +0.10 when {@code complexity_max > 15}; bounded to
 * [0, 1] and rounded to 3 decimals. Proposal: LOC-weighted mean of its members
 * (a member with 0 LOC weighs 1).</p>
 */
public final class DebtIndex {

    /** Annotation prefix of an end-of-life dependency (022). */
    public static final String EOL_PREFIX = "Dependency:eol:";

    /** Annotation prefix of the maintainability index (024). */
    public static final String MAINTAINABILITY_PREFIX = "Maintainability:";

    private static final double CRITICAL = 8;
    private static final double ERROR = 4;
    private static final double WARNING = 2;
    private static final double INFO = 0.5;
    private static final double EOL_STEP = 0.10;
    private static final double EOL_MAX = 0.30;
    private static final double COMPLEXITY_STEP = 0.10;
    private static final int COMPLEXITY_LIMIT = 15;
    private static final double DENSITY_SCALE = 10;
    private static final double LOC_UNIT = 100;

    private DebtIndex() {
    }

    /**
     * Debt index of a component.
     *
     * @param c the component
     * @return the index in [0, 1] with 3 decimals
     */
    public static double of(final Component c) {
        return of(c, 0);
    }

    /**
     * Debt index of a component with the maintainability term (024, FR-041):
     * {@code + weight × (1 − MI/100)} when the component carries {@code Maintainability:<n>}.
     *
     * @param c      the component
     * @param maintainabilityWeight weight of the maintainability term (0 = ignored)
     * @return the index in [0, 1] with 3 decimals
     */
    public static double of(final Component c, final double maintainabilityWeight) {
        double issues = 0;
        if (c.getCodeIssues() != null) {
            for (CodeIssue issue : c.getCodeIssues()) {
                issues += weight(issue.getSeverity());
            }
        }
        double density = issues / Math.max(1.0, c.getLoc() / LOC_UNIT);
        double score = 1 - 1 / (1 + density / DENSITY_SCALE);
        long eol = c.getAnnotations() == null ? 0 : c.getAnnotations().stream()
                .filter(a -> a.startsWith(EOL_PREFIX)).count();
        score += Math.min(EOL_MAX, eol * EOL_STEP);
        if (c.getComplexityMax() != null && c.getComplexityMax() > COMPLEXITY_LIMIT) {
            score += COMPLEXITY_STEP;
        }
        Integer mi = maintainability(c);
        if (maintainabilityWeight > 0 && mi != null) {
            score += maintainabilityWeight * (1 - mi / 100.0);
        }
        return round(Math.max(0, Math.min(1, score)));
    }

    /**
     * Maintainability index of a component from its annotation.
     *
     * @param c the component
     * @return the index in [0, 100], or null when absent or malformed
     */
    public static Integer maintainability(final Component c) {
        if (c.getAnnotations() == null) {
            return null;
        }
        for (String a : c.getAnnotations()) {
            if (a.startsWith(MAINTAINABILITY_PREFIX)) {
                try {
                    int value = Integer.parseInt(a.substring(MAINTAINABILITY_PREFIX.length()).trim());
                    return value < 0 || value > 100 ? null : value;
                } catch (NumberFormatException e) {
                    return null;
                }
            }
        }
        return null;
    }

    /**
     * LOC-weighted debt index of a group of components.
     *
     * @param members the components
     * @return the index in [0, 1] with 3 decimals (0 for no members)
     */
    public static double of(final Collection<Component> members) {
        return of(members, 0);
    }

    /**
     * LOC-weighted debt index of a group with the maintainability term (024).
     *
     * @param members the components
     * @param maintainabilityWeight weight of the maintainability term
     * @return the index in [0, 1] with 3 decimals
     */
    public static double of(final Collection<Component> members, final double maintainabilityWeight) {
        double weighted = 0;
        double weights = 0;
        for (Component c : members) {
            double w = Math.max(1, c.getLoc());
            weighted += of(c, maintainabilityWeight) * w;
            weights += w;
        }
        return weights == 0 ? 0 : round(weighted / weights);
    }

    /**
     * Fixed-format text of an index ({@code 0.412}), locale independent.
     *
     * @param index the index
     * @return three-decimal text
     */
    public static String format(final double index) {
        return String.format(Locale.ROOT, "%.3f", index);
    }

    private static double weight(final CodeIssue.Severity severity) {
        if (severity == null) {
            return 0;
        }
        return switch (severity) {
            case CRITICAL -> CRITICAL;
            case ERROR -> ERROR;
            case WARNING -> WARNING;
            case INFO -> INFO;
        };
    }

    private static double round(final double v) {
        return Math.round(v * 1000) / 1000.0;
    }
}
