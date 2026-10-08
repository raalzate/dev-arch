package com.extractor.analyzer;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Stream;

/**
 * Examines a directory and determines the project type based on marker files.
 * Detection: .sln/.csproj → DOTNET, pom.xml/build.gradle → JAVA,
 * both → AMBIGUOUS, neither → UNKNOWN.
 */
public class ProjectTypeDetector {

    private static final Logger logger = LoggerFactory.getLogger(ProjectTypeDetector.class);

    /**
     * Detects the project type by scanning for marker files in the given directory.
     */
    public ProjectType detect(Path projectRoot) {
        boolean hasJava = hasJavaMarkers(projectRoot);
        boolean hasDotnet = hasDotnetMarkers(projectRoot);

        if (hasJava && hasDotnet) {
            logger.warn("Ambiguous project type at {}: found both Java and .NET markers", projectRoot);
            return ProjectType.AMBIGUOUS;
        }
        if (hasDotnet) {
            logger.info("Detected .NET project at {}", projectRoot);
            return ProjectType.DOTNET;
        }
        if (hasJava) {
            logger.info("Detected Java project at {}", projectRoot);
            return ProjectType.JAVA;
        }

        logger.warn("Unknown project type at {}: no recognized markers found", projectRoot);
        return ProjectType.UNKNOWN;
    }

    /** Folders never searched by the nested detection (build outputs, dependencies, VCS). */
    private static final Set<String> SKIPPED = Set.of("target", "build", "bin", "obj", "node_modules",
            ".git", ".svn", ".hg", ".idea", ".vs", "out", "dist");

    /**
     * Detection with an optional nested search (008, FR-023, FR-024): root markers win; with
     * {@code maxDepth > 0} and no root marker, subfolders up to that depth are searched.
     *
     * @param projectRoot project directory
     * @param maxDepth    nested search depth (0: root only)
     * @return the detection
     */
    public Detection detect(final Path projectRoot, final int maxDepth) {
        ProjectType atRoot = detect(projectRoot);
        if (atRoot != ProjectType.UNKNOWN || maxDepth <= 0) {
            return Detection.atRoot(atRoot);
        }
        Set<String> java = new TreeSet<>();
        Set<String> dotnet = new TreeSet<>();
        try (Stream<Path> walk = Files.walk(projectRoot, maxDepth + 1)) {
            walk.filter(Files::isRegularFile)
                    .filter(p -> !skipped(projectRoot, p))
                    .forEach(p -> {
                        Path parent = projectRoot.relativize(p.getParent());
                        if (parent.getNameCount() == 0 || parent.toString().isEmpty()
                                || parent.getNameCount() > maxDepth) {
                            return;
                        }
                        String dir = parent.toString().replace('\\', '/');
                        String name = p.getFileName().toString();
                        if (name.equals("pom.xml") || name.equals("build.gradle")
                                || name.equals("build.gradle.kts")) {
                            java.add(dir);
                        } else if (name.endsWith(".sln") || name.endsWith(".csproj")
                                || name.endsWith(".vbproj")) {
                            dotnet.add(dir);
                        }
                    });
        } catch (IOException | java.io.UncheckedIOException e) {
            logger.debug("Nested detection of {} failed: {}", projectRoot, e.getMessage());
        }
        ProjectType type = java.isEmpty() ? (dotnet.isEmpty() ? ProjectType.UNKNOWN : ProjectType.DOTNET)
                : (dotnet.isEmpty() ? ProjectType.JAVA : ProjectType.AMBIGUOUS);
        return new Detection(type, List.copyOf(java), List.copyOf(dotnet));
    }

    /**
     * Whether a file lies below a skipped folder.
     *
     * @param root project directory
     * @param file the file
     * @return true when ignored
     */
    private static boolean skipped(final Path root, final Path file) {
        for (Path part : root.relativize(file)) {
            if (SKIPPED.contains(part.toString())) {
                return true;
            }
        }
        return false;
    }

    private boolean hasJavaMarkers(Path projectRoot) {
        return Files.exists(projectRoot.resolve("pom.xml"))
                || Files.exists(projectRoot.resolve("build.gradle"))
                || Files.exists(projectRoot.resolve("build.gradle.kts"));
    }

    private boolean hasDotnetMarkers(Path projectRoot) {
        return hasFileWithExtension(projectRoot, "*.sln")
                || hasFileWithExtension(projectRoot, "*.csproj")
                || hasFileWithExtension(projectRoot, "*.vbproj");
    }

    private boolean hasFileWithExtension(Path directory, String glob) {
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(directory, glob)) {
            return stream.iterator().hasNext();
        } catch (IOException e) {
            logger.debug("Error scanning {} for {}: {}", directory, glob, e.getMessage());
            return false;
        }
    }
}
