package com.extractor.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** 007-native-engine-runtime FR-026: projects without analyzable files complete with a warning. */
class AnalysisServiceWarningsTest {

    @TempDir
    Path tmp;

    @Test
    void zeroComponentsAddsANoAnalyzableSourcesWarning() throws Exception {
        Path project = tmp.resolve("docs-only");
        Files.createDirectories(project);
        Files.writeString(project.resolve("README.md"), "# readme");
        AnalysisResult result = new AnalysisService().analyzeProject(project);
        assertEquals(0, result.getComponentCount());
        assertEquals(List.of("No analyzable source files found in 'docs-only'"), result.getWarnings());
    }
}
