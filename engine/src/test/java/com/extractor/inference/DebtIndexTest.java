package com.extractor.inference;

import com.extractor.model.CodeIssue;
import com.extractor.model.Component;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** FR-040/FR-041: deterministic, bounded debt index. */
class DebtIndexTest {

    private static Component component(String id, int loc, int eol, Integer cc, CodeIssue.Severity... sev) {
        Component c = new Component(id);
        c.setLoc(loc);
        c.setCodeIssues(java.util.Arrays.stream(sev)
                .map(s -> new CodeIssue(CodeIssue.Type.CODE_STYLE, s, s.name(), 1, "T"))
                .toList());
        c.setAnnotations(java.util.stream.IntStream.range(0, eol)
                .mapToObj(i -> DebtIndex.EOL_PREFIX + "Dep" + i).toList());
        c.setComplexityMax(cc);
        return c;
    }

    @Test
    void noIssuesIsZero() {
        assertEquals(0.0, DebtIndex.of(component("A", 100, 0, null)));
    }

    @Test
    void boundedToOne() {
        CodeIssue.Severity[] many = new CodeIssue.Severity[200];
        java.util.Arrays.fill(many, CodeIssue.Severity.CRITICAL);
        assertEquals(1.0, DebtIndex.of(component("A", 10, 9, 99, many)));
    }

    @Test
    void proposalIsLocWeighted() {
        Component heavy = component("H", 900, 0, null); // 0.0
        Component light = component("L", 100, 0, null, CodeIssue.Severity.WARNING, CodeIssue.Severity.WARNING); // 0.286
        assertEquals(0.029, DebtIndex.of(List.of(heavy, light)), 0.0005);
        assertEquals(0.0, DebtIndex.of(List.of()));
    }

    @Test
    void zeroLocWeighsOne() {
        Component a = component("A", 0, 0, null, CodeIssue.Severity.INFO); // 0.048
        Component b = component("B", 0, 0, null); // 0
        assertEquals(0.024, DebtIndex.of(List.of(a, b)), 0.0005);
    }

    @Test
    void formatIsLocaleIndependent() {
        assertEquals("0.412", DebtIndex.format(0.4123));
    }
}
