package com.extractor.integration;

import com.extractor.mcp.McpServerMain;
import com.extractor.mcp.tools.AnalyzeProjectTool;
import com.extractor.service.AnalysisService;
import com.extractor.testsupport.CliRunner;
import com.extractor.testsupport.DemoProjects;
import io.modelcontextprotocol.spec.McpSchema;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

/**
 * 007-native-engine-runtime SC-007, Constitution I/IV: CLI vs MCP with explicit and automatic language,
 * consecutive runs, reused vs fresh analyses and with/without progress token are byte-identical.
 */
class NativeRuntimeParityTest {

    private static final List<String> DOCS =
            List.of("output.json", "output_architecture.json", "output_entrypoints.json");

    @TempDir
    Path tmp;

    private static List<String> docs(Path dir) throws Exception {
        List<String> out = new ArrayList<>();
        for (String d : DOCS) {
            out.add(Files.readString(dir.resolve(d)));
        }
        return out;
    }

    private static List<String> mcp(AnalysisService service, Path project, Path out, String language,
            Object token) throws Exception {
        Map<String, Object> args = new HashMap<>(Map.of("projectPath", project.toString(),
                "outputDir", out.toString()));
        if (language != null) {
            args.put("language", language);
        }
        McpSchema.CallToolRequest request = token == null
                ? new McpSchema.CallToolRequest("analyze_project", args)
                : new McpSchema.CallToolRequest("analyze_project", args, Map.of("progressToken", token));
        McpSchema.CallToolResult r = AnalyzeProjectTool.handle(service, request, n -> { });
        assertFalse(r.isError(), String.valueOf(r.content()));
        return docs(out);
    }

    private static List<String> cli(Path project, Path out, String option) throws Exception {
        Files.createDirectories(out);
        List<String> args = new ArrayList<>(List.of(project.toString(), out.resolve("output.json").toString()));
        if (option != null) {
            args.add(option);
        }
        CliRunner.Result r = CliRunner.run(out, args);
        assertEquals(0, r.exitCode(), r.stderr());
        return docs(out);
    }

    @ParameterizedTest
    @CsvSource({"java-standar,java", "dotnet-ecommerce,dotnet"})
    void allModesAndOptionsProduceTheSameDocuments(String demo, String language) throws Exception {
        Path project = DemoProjects.copy(demo, tmp);
        List<String> reference = cli(project, tmp.resolve("cli-plain"), null);

        assertEquals(reference, cli(project, tmp.resolve("cli-auto"), "--language=auto"), "CLI auto");
        assertEquals(reference, cli(project, tmp.resolve("cli-explicit"), "--language=" + language),
                "CLI explicit");
        assertEquals(reference, cli(project, tmp.resolve("cli-again"), null), "CLI consecutive");

        AnalysisService server = McpServerMain.createService(8);
        assertEquals(reference, mcp(server, project, tmp.resolve("mcp-fresh"), null, null), "MCP fresh");
        assertEquals(reference, mcp(server, project, tmp.resolve("mcp-reused"), null, "t"), "MCP reused + token");
        assertEquals(reference, mcp(server, project, tmp.resolve("mcp-explicit"), language, null),
                "MCP explicit");
        assertEquals(reference, mcp(server, project, tmp.resolve("mcp-explicit-reused"), language, "t2"),
                "MCP explicit reused");
        assertEquals(reference, mcp(new AnalysisService(), project, tmp.resolve("mcp-nocache"), "auto", 3),
                "MCP without reuse");
    }
}
