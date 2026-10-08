package com.extractor.analyzer;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 007-native-engine-runtime FR-026: Java files with syntax errors are reported as warnings. */
class JavaSpoonAnalyzerWarningsTest {

    @TempDir
    Path root;

    @Test
    void reportsUnparseableFilesByRelativePathOncePerFile() throws Exception {
        Path pkg = root.resolve("src/main/java/demo");
        Files.createDirectories(pkg);
        Files.writeString(root.resolve("pom.xml"), "<project/>");
        Files.writeString(pkg.resolve("Good.java"), "package demo; public class Good { }");
        Files.writeString(pkg.resolve("Broken.java"), "package demo;\npublic class Broken { void x( { int = ; }\n");
        JavaSpoonAnalyzer analyzer = new JavaSpoonAnalyzer();
        analyzer.analyzeProject(root);
        List<String> warnings = analyzer.getWarnings();
        assertEquals(1, warnings.size(), warnings.toString());
        String w = warnings.get(0);
        assertTrue(w.startsWith("Skipped src/main/java/demo/Broken.java: syntax error at line 2"), w);
        assertTrue(!w.contains(root.toString()), w);
    }

    @Test
    void validProjectsHaveNoWarnings() throws Exception {
        Path pkg = root.resolve("src/main/java/demo");
        Files.createDirectories(pkg);
        Files.writeString(root.resolve("pom.xml"), "<project/>");
        Files.writeString(pkg.resolve("Good.java"), "package demo; import org.missing.Lib; public class Good { Lib l; }");
        JavaSpoonAnalyzer analyzer = new JavaSpoonAnalyzer();
        analyzer.analyzeProject(root);
        assertEquals(List.of(), analyzer.getWarnings(), "unresolved types are not syntax errors");
    }
}
