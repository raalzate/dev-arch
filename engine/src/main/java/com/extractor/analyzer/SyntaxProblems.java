package com.extractor.analyzer;

import org.eclipse.jdt.core.compiler.CategorizedProblem;
import spoon.Launcher;
import spoon.SpoonModelBuilder;
import spoon.support.compiler.jdt.JDTBasedSpoonCompiler;

import java.util.Collections;
import java.util.SortedMap;
import java.util.TreeMap;

/**
 * Syntax errors reported by the Java parser while building the Spoon model
 * (007-native-engine-runtime, FR-026). Unresolved types (no classpath) are
 * not syntax errors and are ignored.
 */
final class SyntaxProblems {

    private SyntaxProblems() {
    }

    /**
     * First syntax error of each file, sorted by file name.
     *
     * @param launcher launcher whose model was built
     * @return absolute file name to "line N (message)"
     */
    static SortedMap<String, String> of(final Launcher launcher) {
        SortedMap<String, String> problems = new TreeMap<>();
        SpoonModelBuilder builder = launcher.getModelBuilder();
        if (!(builder instanceof JDTBasedSpoonCompiler)) {
            return problems;
        }
        for (CategorizedProblem p
                : ((JDTBasedSpoonCompiler) builder).getProblems()) {
            if (p.isError()
                    && p.getCategoryID() == CategorizedProblem.CAT_SYNTAX
                    && p.getOriginatingFileName() != null) {
                problems.putIfAbsent(new String(p.getOriginatingFileName()),
                        "line " + p.getSourceLineNumber()
                                + " (" + p.getMessage() + ")");
            }
        }
        return Collections.unmodifiableSortedMap(problems);
    }
}
