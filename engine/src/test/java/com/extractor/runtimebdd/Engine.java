package com.extractor.runtimebdd;

import com.extractor.mcp.McpToolSpecs;
import com.extractor.mcp.tools.AnalyzeProjectTool;
import com.extractor.service.AnalysisService;
import com.extractor.testsupport.CliRunner;
import com.extractor.testsupport.DemoProjects;
import io.modelcontextprotocol.server.McpServerFeatures;
import io.modelcontextprotocol.spec.McpSchema;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Calls of the 007 engine steps: server mode in process (tool handlers) and command line in a child JVM. */
final class Engine {

    static final List<String> DOCS = List.of("output.json", "output_architecture.json", "output_entrypoints.json");

    private Engine() {
    }

    /** Copies a demo project into a fresh scratch sub-directory. */
    static Path copyDemo(String name) {
        try {
            return DemoProjects.copy(name, Files.createTempDirectory(World.tmp, "p"));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    static Path newDir(String prefix) {
        try {
            return Files.createTempDirectory(World.tmp, prefix);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** analyze_project through the server-mode handler, capturing progress notifications. */
    static McpSchema.CallToolResult analyze(AnalysisService service, Path project, Path out, String language,
            Object progressToken, List<McpSchema.ProgressNotification> sink) {
        Map<String, Object> args = new HashMap<>();
        args.put("projectPath", project.toString());
        args.put("outputDir", out.toString());
        if (language != null) {
            args.put("language", language);
        }
        McpSchema.CallToolRequest request = progressToken == null
                ? new McpSchema.CallToolRequest("analyze_project", args)
                : new McpSchema.CallToolRequest("analyze_project", args, Map.of("progressToken", progressToken));
        return AnalyzeProjectTool.handle(service, request, sink::add);
    }

    static McpSchema.CallToolResult analyze(AnalysisService service, Path project, Path out, String language) {
        return analyze(service, project, out, language, null, new ArrayList<>());
    }

    /** Any tool through the registered specification (null exchange: no progress). */
    static McpSchema.CallToolResult call(AnalysisService service, String tool, Map<String, Object> args) {
        McpServerFeatures.SyncToolSpecification spec = McpToolSpecs.of(service).stream()
                .filter(s -> s.tool().name().equals(tool)).findFirst().orElseThrow();
        return spec.callHandler().apply(null, new McpSchema.CallToolRequest(tool, args));
    }

    static List<McpSchema.Tool> tools(AnalysisService service) {
        return McpToolSpecs.of(service).stream().map(McpServerFeatures.SyncToolSpecification::tool).toList();
    }

    static String text(McpSchema.CallToolResult r) {
        return r.content().isEmpty() ? "" : ((McpSchema.TextContent) r.content().get(0)).text();
    }

    /** The three output documents of a directory (null entries when missing). */
    static List<String> documents(Path out) {
        List<String> docs = new ArrayList<>();
        for (String name : DOCS) {
            try {
                Path f = out.resolve(name);
                docs.add(Files.exists(f) ? Files.readString(f) : null);
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
        }
        return docs;
    }

    /** CLI run writing {@code <out>/output.json} (and the derived documents). */
    static CliRunner.Result cli(Path project, Path out, String option) {
        List<String> args = new ArrayList<>(List.of(project.toString(), out.resolve("output.json").toString()));
        if (option != null) {
            args.add(option);
        }
        return CliRunner.run(out, args);
    }

    @SuppressWarnings("unchecked")
    static List<String> warnings(McpSchema.CallToolResult r) {
        if (r.meta() == null) {
            return null;
        }
        return (List<String>) r.meta().get("static-inference/warnings");
    }
}
