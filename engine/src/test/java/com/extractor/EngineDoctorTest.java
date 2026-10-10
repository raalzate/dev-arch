package com.extractor;

import com.extractor.analyzer.DotNetToolLocator;
import com.extractor.model.SchemaVersion;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.ByteArrayOutputStream;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 012-install-doctor-docker: {@code java -jar engine.jar --doctor} (FR-014, FR-015). */
class EngineDoctorTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    @Test
    void reportsTheAnalyzerFoundNextToTheJar(@TempDir Path dir) throws Exception {
        Path analyzer = Files.createFile(dir.resolve("dotnet-analyzer"));
        Map<String, Object> report = EngineDoctor.report("9.9.9", new DotNetToolLocator(dir, false));
        List<String> keys = new ArrayList<>(report.keySet());
        assertEquals(List.of("engine", "version", "schema_version", "java_version", "dotnet_analyzer"), keys);
        assertEquals("static-inference", report.get("engine"));
        assertEquals("9.9.9", report.get("version"));
        assertEquals(SchemaVersion.CURRENT, report.get("schema_version"));
        JsonNode node = JSON.readTree(EngineDoctor.toJson(report));
        assertTrue(node.get("dotnet_analyzer").get("found").asBoolean());
        assertEquals(analyzer.toAbsolutePath().toString(), node.get("dotnet_analyzer").get("path").asText());
    }

    @Test
    void reportsTheAnalyzerNotFound(@TempDir Path dir) throws Exception {
        DotNetToolLocator missing = new DotNetToolLocator(dir.resolve("nowhere"), false) {
            @Override
            public Path locate() {
                throw new IllegalStateException("Could not find 'dotnet-analyzer'");
            }
        };
        Map<String, Object> report = EngineDoctor.report("1.0.0", missing);
        JsonNode node = JSON.readTree(EngineDoctor.toJson(report));
        assertFalse(node.get("dotnet_analyzer").get("found").asBoolean());
        assertTrue(node.get("dotnet_analyzer").get("path").isNull());
    }

    @Test
    void runPrintsOneJsonLineAndReturnsZero() throws Exception {
        PrintStream saved = System.out;
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        int code;
        try {
            System.setOut(new PrintStream(buffer, true, StandardCharsets.UTF_8));
            code = EngineDoctor.run("1.2.3");
        } finally {
            System.setOut(saved);
        }
        assertEquals(0, code);
        String out = buffer.toString(StandardCharsets.UTF_8).trim();
        assertFalse(out.contains("\n"), out);
        JsonNode node = JSON.readTree(out);
        assertEquals("1.2.3", node.get("version").asText());
        assertNotNull(node.get("dotnet_analyzer").get("found"));
    }

    @Test
    void jarDirectoryIsADirectory() {
        Path dir = EngineDoctor.jarDirectory();
        assertNotNull(dir);
        assertTrue(Files.isDirectory(dir), dir.toString());
    }
}
