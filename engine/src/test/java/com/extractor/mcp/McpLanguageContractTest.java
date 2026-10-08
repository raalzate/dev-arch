package com.extractor.mcp;

import com.extractor.mcp.tools.AnalyzeProjectTool;
import com.extractor.service.AnalysisService;
import com.extractor.testsupport.DemoProjects;
import io.modelcontextprotocol.server.McpServerFeatures;
import io.modelcontextprotocol.spec.McpSchema;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 007-native-engine-runtime FR-024, contracts/engine-mcp.md: optional {@code language} on the five tools
 * [TS-051, TS-053, TS-054]. New contract tests; the 001 contract tests are unchanged.
 */
class McpLanguageContractTest {

    private static final Map<String, List<String>> REQUIRED = Map.of(
            "analyze_project", List.of("projectPath"),
            "get_dependency_graph", List.of("projectPath"),
            "get_architecture_proposal", List.of("projectPath"),
            "get_api_contracts", List.of("projectPath"),
            "get_component_metrics", List.of("projectPath", "componentId"));

    @TempDir
    Path tmp;

    private final List<McpServerFeatures.SyncToolSpecification> specs =
            McpServerMain.createToolSpecs(new AnalysisService());

    private McpSchema.CallToolResult call(String tool, Map<String, Object> args) {
        McpServerFeatures.SyncToolSpecification spec = specs.stream()
                .filter(s -> s.tool().name().equals(tool)).findFirst().orElseThrow();
        return spec.callHandler().apply(null, new McpSchema.CallToolRequest(tool, args));
    }

    private static String text(McpSchema.CallToolResult r) {
        return ((McpSchema.TextContent) r.content().get(0)).text();
    }

    @Test
    void everyToolDeclaresTheOptionalLanguageWithRequiredInputsUnchanged() {
        assertEquals(REQUIRED.keySet(), specs.stream().map(s -> s.tool().name())
                .collect(java.util.stream.Collectors.toSet()));
        for (McpServerFeatures.SyncToolSpecification spec : specs) {
            McpSchema.JsonSchema schema = spec.tool().inputSchema();
            @SuppressWarnings("unchecked")
            Map<String, Object> language = (Map<String, Object>) schema.properties().get("language");
            assertEquals("string", language.get("type"), spec.tool().name());
            assertEquals(List.of("java", "dotnet", "auto"), language.get("enum"), spec.tool().name());
            assertEquals(REQUIRED.get(spec.tool().name()), schema.required(), spec.tool().name());
        }
    }

    @Test
    void invalidLanguageIsRejectedByEveryTool() {
        Path project = DemoProjects.original("java-standar");
        for (String tool : REQUIRED.keySet()) {
            Map<String, Object> args = new HashMap<>();
            args.put("projectPath", project.toString());
            args.put("componentId", "x.Y");
            args.put("outputDir", tmp.resolve("out").toString());
            args.put("language", "cobol");
            McpSchema.CallToolResult r = call(tool, args);
            assertTrue(r.isError(), tool);
            assertEquals("Invalid language 'cobol'. Allowed: java, dotnet, auto", text(r), tool);
        }
        assertTrue(Files.notExists(tmp.resolve("out").resolve("output.json")));
    }

    @Test
    void ambiguousProjectWithAutoAsksForTheLanguage() throws Exception {
        Path project = DemoProjects.copy("java-standar", tmp);
        Files.writeString(project.resolve("App.csproj"), "<Project/>");
        McpSchema.CallToolResult r = AnalyzeProjectTool.handle(new AnalysisService(),
                new McpSchema.CallToolRequest("analyze_project",
                        Map.of("projectPath", project.toString(), "language", "auto")));
        assertTrue(r.isError());
        assertTrue(text(r).contains("Ambiguous project type"), text(r));
        assertTrue(text(r).contains("language=java|dotnet"), text(r));
    }

    @Test
    void explicitLanguageResolvesTheAmbiguityInEveryTool() throws Exception {
        Path project = DemoProjects.copy("java-standar", tmp);
        Files.writeString(project.resolve("App.csproj"), "<Project/>");
        McpSchema.CallToolResult r = call("get_dependency_graph",
                Map.of("projectPath", project.toString(), "language", "java"));
        assertTrue(!r.isError(), text(r));
        assertTrue(text(r).contains("\"source\" : \"spoon\""), text(r).substring(0, 200));
    }
}
