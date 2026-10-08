package com.extractor.analyzer;

import java.nio.file.Path;
import java.util.List;

/**
 * Result of the project type detection (008, FR-023, FR-024).
 *
 * @param type        detected type
 * @param javaModules folders with Java markers found by the nested search
 * @param dotnetModules folders with .NET markers found by the nested search
 */
public record Detection(ProjectType type, List<String> javaModules,
        List<String> dotnetModules) {

    /**
     * Immutable copies.
     *
     * @param type          detected type
     * @param javaModules   Java module folders
     * @param dotnetModules .NET module folders
     */
    public Detection {
        javaModules = List.copyOf(javaModules);
        dotnetModules = List.copyOf(dotnetModules);
    }

    /**
     * Detection decided at the root (no nested search).
     *
     * @param type detected type
     * @return the detection
     */
    public static Detection atRoot(final ProjectType type) {
        return new Detection(type, List.of(), List.of());
    }

    /**
     * Warning about the module folders of a nested detection.
     *
     * @return the warning, or null when the decision was taken at the root
     */
    public String warning() {
        if (type == ProjectType.JAVA && !javaModules.isEmpty()) {
            return "Nested project markers found (java): "
                    + String.join(", ", javaModules);
        }
        if (type == ProjectType.DOTNET && !dotnetModules.isEmpty()) {
            return "Nested project markers found (dotnet): "
                    + String.join(", ", dotnetModules);
        }
        return null;
    }

    /**
     * Message of an ambiguous project.
     *
     * @param projectRoot project directory
     * @return the message
     */
    public String ambiguityMessage(final Path projectRoot) {
        String found = javaModules.isEmpty() && dotnetModules.isEmpty() ? ""
                : " (java: " + String.join(", ", javaModules) + "; dotnet: "
                        + String.join(", ", dotnetModules) + ")";
        return "Ambiguous project type: found both Java and .NET markers"
                + " in '" + projectRoot + "'" + found + ". Please specify the"
                + " target language explicitly (use language=java|dotnet).";
    }
}
