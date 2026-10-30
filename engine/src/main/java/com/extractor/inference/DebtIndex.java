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
        return round(Math.max(0, Math.min(1, score)));
    }

    /**
     * LOC-weighted debt index of a group of components.
     *
     * @param members the components
     * @return the index in [0, 1] with 3 decimals (0 for no members)
     */
    public static double of(final Collection<Component> members) {
        double weighted = 0;
        double weights = 0;
        for (Component c : members) {
            double w = Math.max(1, c.getLoc());
            weighted += of(c) * w;
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
