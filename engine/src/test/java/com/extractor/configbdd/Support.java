package com.extractor.configbdd;

import com.extractor.mcp.McpServerMain;
import com.extractor.schema.DemoOutputs;
import com.extractor.service.AnalysisService;
import com.extractor.testsupport.CliRunner;
import com.extractor.testsupport.RegressionBaselines;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.modelcontextprotocol.server.McpServerFeatures;
import io.modelcontextprotocol.spec.McpSchema;
import org.junit.jupiter.api.Assumptions;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Shared operations of the 008 steps. */
final class Support {

    static final ObjectMapper MAPPER = new ObjectMapper();

    private Support() {
    }

    static Path newDir(String prefix) {
        try {
            return Files.createTempDirectory(World.tmp, prefix);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    static Path demo(String project) {
        if (DemoOutputs.isDotNet(project)) {
            Assumptions.assumeTrue(DemoOutputs.dotNetAnalyzerAvailable(), "dotnet-analyzer not available");
        }
        World.value = project;
        return DemoOutputs.projectDir(project);
    }

    static AnalysisService server() {
        if (World.server == null) {
            World.server = new AnalysisService();
        }
        return World.server;
    }

    static List<McpServerFeatures.SyncToolSpecification> specs() {
        return McpServerMain.createToolSpecs(server(), World.inferenceTools, World.jobsDir);
    }

    static McpSchema.CallToolResult call(String tool, Map<String, Object> args) {
        McpServerFeatures.SyncToolSpecification spec = specs().stream()
                .filter(s -> s.tool().name().equals(tool)).findFirst()
                .orElseThrow(() -> new AssertionError("tool not registered: " + tool));
        McpSchema.CallToolResult r = spec.callHandler().apply(null, new McpSchema.CallToolRequest(tool, args));
        World.result = r;
        World.results.add(r);
        if (!Boolean.TRUE.equals(r.isError()) && tool.equals("reinfer_architecture")) {
            World.architecture = text(r);
        }
        return r;
    }

    static String text(McpSchema.CallToolResult r) {
        return r.content().isEmpty() ? "" : ((McpSchema.TextContent) r.content().get(0)).text();
    }

    @SuppressWarnings("unchecked")
    static List<String> warnings(McpSchema.CallToolResult r) {
        if (r.meta() == null || r.meta().get("static-inference/warnings") == null) {
            return List.of();
        }
        return (List<String>) r.meta().get("static-inference/warnings");
    }

    static List<String> documents(Path out) {
        List<String> docs = new ArrayList<>();
        for (String name : RegressionBaselines.DOCUMENTS) {
            try {
                Path f = out.resolve(name);
                docs.add(Files.exists(f) ? Files.readString(f, StandardCharsets.UTF_8) : null);
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
        }
        return docs;
    }

    /** CLI analysis into a fresh (or given) output directory; records the documents. */
    static void cli(Path project, Path out, String... options) {
        List<String> args = new ArrayList<>(List.of(project.toString(), out.resolve("output.json").toString()));
        args.addAll(List.of(options));
        World.outDir = out;
        World.cli = CliRunner.run(out, args);
        record(out);
    }

    /** analyze_project into an output directory with optional inline config / configPath. */
    static McpSchema.CallToolResult mcpAnalyze(Path project, Path out, Object config, String configPath) {
        Map<String, Object> args = new HashMap<>();
        args.put("projectPath", project.toString());
        args.put("outputDir", out.toString());
        if (config != null) {
            args.put("config", config);
        }
        if (configPath != null) {
            args.put("configPath", configPath);
        }
        World.outDir = out;
        McpSchema.CallToolResult r = call("analyze_project", args);
        record(out);
        return r;
    }

    private static void record(Path out) {
        List<String> docs = documents(out);
        World.analyses.add(docs);
        if (docs.get(1) != null) {
            World.architecture = docs.get(1);
        }
    }

    static JsonNode json(String text) {
        try {
            return MAPPER.readTree(text);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    static Object object(String jsonText) {
        try {
            return MAPPER.readValue(jsonText, Object.class);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** {"a":{"b":v}} from "a.b". */
    static void put(ObjectNode root, String dotted, double value) {
        String[] parts = dotted.split("\\.");
        ObjectNode node = root;
        for (int i = 0; i < parts.length - 1; i++) {
            node = node.has(parts[i]) ? (ObjectNode) node.get(parts[i]) : node.putObject(parts[i]);
        }
        node.put(parts[parts.length - 1], value);
    }

    static Path writeConfig(String name, String content) {
        try {
            Path file = World.tmp.resolve(name);
            Files.writeString(file, content, StandardCharsets.UTF_8);
            World.configFile = file;
            return file;
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** Stores the baseline graph (and architecture) of a demo project in a folder without sources. */
    static Path store(String project, boolean withArchitecture) {
        Map<String, String> docs = RegressionBaselines.load(project);
        try {
            Path dir = Files.createDirectories(World.tmp.resolve("stored-" + project));
            Path graph = dir.resolve(DemoOutputs.GRAPH);
            Files.writeString(graph, docs.get(DemoOutputs.GRAPH), StandardCharsets.UTF_8);
            World.storedArchitecture = docs.get(DemoOutputs.ARCHITECTURE);
            if (withArchitecture) {
                Files.writeString(dir.resolve(DemoOutputs.ARCHITECTURE), World.storedArchitecture,
                        StandardCharsets.UTF_8);
            }
            World.stored = dir;
            World.graphPath = graph;
            World.value = project;
            return graph;
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    static McpSchema.CallToolResult reinfer(Path graph, String config, String minViability) {
        Map<String, Object> args = new HashMap<>();
        if (graph != null) {
            args.put("graphPath", graph.toString());
        }
        if (config != null) {
            args.put("config", object(config));
        }
        if (minViability != null) {
            args.put("minViability", minViability);
        }
        return call("reinfer_architecture", args);
    }

    static McpSchema.CallToolResult score(List<String> components, String config) {
        Map<String, Object> args = new HashMap<>();
        args.put("graphPath", World.graphPath.toString());
        args.put("components", components);
        if (config != null) {
            args.put("config", object(config));
        }
        return call("score_proposal", args);
    }

    static List<List<String>> storedProposalComponents() {
        List<List<String>> out = new ArrayList<>();
        for (JsonNode p : json(World.storedArchitecture).path("proposals")) {
            List<String> ids = new ArrayList<>();
            p.path("components").forEach(c -> ids.add(c.asText()));
            out.add(ids);
        }
        return out;
    }

    static boolean isError(McpSchema.CallToolResult r) {
        return Boolean.TRUE.equals(r.isError());
    }
}
