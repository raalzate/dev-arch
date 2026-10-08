package com.extractor.analyzer;

import com.extractor.model.DependencyGraph;
import com.extractor.utils.DependencyResolver;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Adapter that wraps the existing {@link ProjectAnalyzer} to implement {@link LanguageAnalyzer}.
 * Delegates all calls without any logic changes — preserves backward compatibility (Constitution I).
 */
public class JavaSpoonAnalyzer implements LanguageAnalyzer {

    private final ProjectAnalyzer delegate;

    /** Warnings of the last analysis (007, FR-026). */
    private final List<String> warnings = new ArrayList<>();

    public JavaSpoonAnalyzer() {
        this.delegate = new ProjectAnalyzer();
    }

    public JavaSpoonAnalyzer(boolean enableLombok) {
        this.delegate = new ProjectAnalyzer(enableLombok);
    }

    @Override
    public DependencyGraph analyzeProject(Path projectRoot) throws Exception {
        if (projectRoot == null || !Files.exists(projectRoot)) {
            throw new IllegalArgumentException(
                    "Project path '" + projectRoot + "' does not exist");
        }
        if (!Files.isDirectory(projectRoot)) {
            throw new IllegalArgumentException(
                    "Project path '" + projectRoot + "' is not a directory");
        }
        warnings.clear();
        DependencyGraph graph = delegate.analyzeProject(projectRoot);
        for (Map.Entry<String, String> problem
                : delegate.getSyntaxProblems().entrySet()) {
            warnings.add("Skipped " + relative(projectRoot, problem.getKey())
                    + ": syntax error at " + problem.getValue());
        }
        return graph;
    }

    /**
     * Non-fatal warnings of the last analysis: files with syntax errors.
     *
     * @return the warnings in file order
     */
    @Override
    public final List<String> getWarnings() {
        return List.copyOf(warnings);
    }

    /**
     * Path of a file relative to the project root, with '/' separators.
     *
     * @param projectRoot project directory
     * @param file        absolute file name reported by the parser
     * @return the relative path, or the file name when outside the root
     */
    private static String relative(final Path projectRoot, final String file) {
        Path path = Path.of(file).toAbsolutePath().normalize();
        Path root = projectRoot.toAbsolutePath().normalize();
        if (!path.startsWith(root)) {
            try {
                root = root.toRealPath();
                path = path.toRealPath();
            } catch (IOException e) {
                return nameOf(path);
            }
        }
        if (!path.startsWith(root)) {
            return nameOf(path);
        }
        return root.relativize(path).toString().replace('\\', '/');
    }

    /**
     * File name of a path, or the path itself for a root.
     *
     * @param path the path
     * @return its last element
     */
    private static String nameOf(final Path path) {
        Path name = path.getFileName();
        return name == null ? path.toString() : name.toString();
    }

    @Override
    public DependencyResolver getDependencyResolver() {
        return delegate.getDependencyResolver();
    }
}
