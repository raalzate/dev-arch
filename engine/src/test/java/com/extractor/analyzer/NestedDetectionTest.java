package com.extractor.analyzer;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 008 FR-023, FR-024: nested detection. */
class NestedDetectionTest {

    @TempDir
    Path root;

    private void touch(String relative) throws Exception {
        Path f = root.resolve(relative);
        Files.createDirectories(f.getParent());
        Files.writeString(f, "");
    }

    @Test
    void depthZeroKeepsRootDetection() throws Exception {
        touch("backend/pom.xml");
        assertEquals(Detection.atRoot(ProjectType.UNKNOWN), new ProjectTypeDetector().detect(root, 0));
    }

    @Test
    void multiModuleJavaIsReportedSorted() throws Exception {
        touch("backend/core/pom.xml");
        touch("backend/pom.xml");
        touch("target/x/Y.csproj");
        Detection d = new ProjectTypeDetector().detect(root, 2);
        assertEquals(ProjectType.JAVA, d.type());
        assertEquals(List.of("backend", "backend/core"), d.javaModules());
        assertEquals("Nested project markers found (java): backend, backend/core", d.warning());
    }

    @Test
    void bothLanguagesAreAmbiguousAndRootWins() throws Exception {
        touch("api/pom.xml");
        touch("ui/Ui.csproj");
        Detection d = new ProjectTypeDetector().detect(root, 1);
        assertEquals(ProjectType.AMBIGUOUS, d.type());
        assertTrue(d.ambiguityMessage(root).contains("(java: api; dotnet: ui)"));
        touch("pom.xml");
        Detection rooted = new ProjectTypeDetector().detect(root, 3);
        assertEquals(ProjectType.JAVA, rooted.type());
        assertNull(rooted.warning());
    }
}
