package com.extractor.mcp.tools;

import com.extractor.schema.SchemaRegistry;
import com.extractor.service.AnalysisService;
import com.extractor.testsupport.DemoProjects;
import io.modelcontextprotocol.spec.McpSchema;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 007-native-engine-runtime FR-026, research D4: warnings in _meta, content unchanged (contract 1.0.0). */
class AnalyzeProjectWarningsTest {

    @TempDir
    Path tmp;

    private static McpSchema.CallToolResult analyze(Path project, Path out) {
        return AnalyzeProjectTool.handle(new AnalysisService(), new McpSchema.CallToolRequest("analyze_project",
                Map.of("projectPath", project.toString(), "outputDir", out.toString())));
    }

    private static String text(McpSchema.CallToolResult r) {
        return ((McpSchema.TextContent) r.content().get(0)).text();
    }

    @Test
    void warningsTravelInMetaOnlyWhenPresent() throws Exception {
        Path project = DemoProjects.copy("java-standar", tmp);
        McpSchema.CallToolResult clean = analyze(project, tmp.resolve("o1"));
        assertFalse(clean.isError());
        assertNull(clean.meta());

        Path empty = tmp.resolve("empty");
        Files.createDirectories(empty);
        McpSchema.CallToolResult warned = analyze(empty, tmp.resolve("o2"));
        assertFalse(warned.isError(), text(warned));
        assertEquals(Map.of("static-inference/warnings", List.of("No analyzable source files found in 'empty'")),
                warned.meta());
        assertEquals(List.of(), SchemaRegistry.get().validate("mcp/analyze_project.response", text(warned)));
        assertTrue(Files.exists(tmp.resolve("o2/output.json")));
    }
}
