package com.extractor.service;

import com.extractor.testsupport.DemoProjects;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 007-native-engine-runtime FR-024: explicit language bypasses detection; AUTO keeps the previous behaviour. */
class AnalysisServiceLanguageTest {

    @TempDir
    Path tmp;

    private Path ambiguousJavaProject() throws Exception {
        Path project = DemoProjects.copy("java-standar", tmp);
        Files.writeString(project.resolve("App.csproj"), "<Project Sdk=\"Microsoft.NET.Sdk\"></Project>");
        return project;
    }

    @Test
    void explicitJavaAnalyzesAnAmbiguousProjectWithoutConsultingTheDetector() throws Exception {
        Path project = ambiguousJavaProject();
        AnalysisResult result = new AnalysisService()
                .analyzeProject(project, AnalysisOptions.of(AnalysisLanguage.JAVA), AnalysisProgressListener.NOOP);
        assertEquals("spoon", result.getDependencyGraph().getMeta().getSource());
        assertTrue(result.getComponentCount() > 0);
    }

    @Test
    void automaticDetectionStillRejectsAmbiguousProjectsAskingForTheLanguage() throws Exception {
        Path project = ambiguousJavaProject();
        IllegalArgumentException e = assertThrows(IllegalArgumentException.class,
                () -> new AnalysisService().analyzeProject(project, AnalysisOptions.DEFAULT,
                        AnalysisProgressListener.NOOP));
        assertTrue(e.getMessage().contains("Ambiguous project type"), e.getMessage());
        assertTrue(e.getMessage().contains("language=java|dotnet"), e.getMessage());
        IllegalArgumentException legacy = assertThrows(IllegalArgumentException.class,
                () -> new AnalysisService().analyzeProject(project));
        assertEquals(e.getMessage(), legacy.getMessage());
    }

    @Test
    void automaticDetectionFallsBackToJavaWithoutMarkers() throws Exception {
        Path project = tmp.resolve("plain");
        Files.createDirectories(project.resolve("src/demo"));
        Files.writeString(project.resolve("src/demo/Hello.java"), "package demo; public class Hello { }");
        AnalysisResult result = new AnalysisService()
                .analyzeProject(project, AnalysisOptions.DEFAULT, AnalysisProgressListener.NOOP);
        assertEquals("spoon", result.getDependencyGraph().getMeta().getSource());
    }
}
