package com.extractor.analyzer;

import com.extractor.model.SchemaVersion;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.DisabledOnOs;
import org.junit.jupiter.api.condition.OS;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * User warnings of the .NET analyzer ({@code [warning] <text>} lines on stderr) exposed through
 * {@link DotNetBridgeAnalyzer#getWarnings()} (009-vb-legacy-completion, contracts/dotnet-warnings-channel.md).
 */
@DisabledOnOs(OS.WINDOWS)
class DotNetBridgeWarningsTest {

    private static final String GRAPH = "{\"components\":[],\"edges\":[],\"meta\":{\"source\":\"roslyn-fallback\","
            + "\"schema_version\":\"" + SchemaVersion.CURRENT + "\"}}";

    @TempDir
    Path tempDir;

    private DotNetBridgeAnalyzer analyzerPrinting(String body) throws IOException {
        Path script = tempDir.resolve("dotnet-analyzer");
        Files.writeString(script, "#!/bin/sh\n" + body + "\n");
        assertTrue(script.toFile().setExecutable(true));
        return new DotNetBridgeAnalyzer(new DotNetToolLocator(tempDir), Duration.ofSeconds(20));
    }

    @Test
    void warningLinesOfStderrBecomeWarningsInOrderWithoutDuplicates() throws Exception {
        DotNetBridgeAnalyzer analyzer = analyzerPrinting(
                "echo '[WARN] MSBuildWorkspace failed: diagnostic only' >&2\n"
                + "printf '%s' '" + GRAPH + "'\n"
                + "printf '[warning] VB project '\\''A.vbproj'\\'' analyzed with reduced fidelity\\r\\n' >&2\n"
                + "echo '[warning] VB project '\\''B.vbproj'\\'' analyzed with reduced fidelity' >&2\n"
                + "echo '[warning] VB project '\\''A.vbproj'\\'' analyzed with reduced fidelity' >&2\n"
                + "echo '  [warning] indented lines are not warnings' >&2\n"
                + "echo '[warning]missing-space is not a warning' >&2");

        analyzer.analyzeProject(tempDir);

        assertEquals(List.of(
                "VB project 'A.vbproj' analyzed with reduced fidelity",
                "VB project 'B.vbproj' analyzed with reduced fidelity"), analyzer.getWarnings());
    }

    @Test
    void analysesWithoutWarningLinesHaveNoWarnings() throws Exception {
        DotNetBridgeAnalyzer analyzer = analyzerPrinting(
                "echo '[WARN] Using AdhocWorkspace fallback' >&2\nprintf '%s' '" + GRAPH + "'");

        analyzer.analyzeProject(tempDir);

        assertTrue(analyzer.getWarnings().isEmpty(), analyzer.getWarnings().toString());
    }

    @Test
    void warningLinesOfAFailedRunAreNotParsed() throws Exception {
        DotNetBridgeAnalyzer analyzer = analyzerPrinting(
                "echo '[warning] should not be collected' >&2\nexit 3");

        assertThrows(RuntimeException.class, () -> analyzer.analyzeProject(tempDir));
        assertTrue(analyzer.getWarnings().isEmpty(), analyzer.getWarnings().toString());
    }
}
