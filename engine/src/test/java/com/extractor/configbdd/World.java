package com.extractor.configbdd;

import com.extractor.service.AnalysisService;
import com.extractor.testsupport.CliRunner;
import io.modelcontextprotocol.spec.McpSchema;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Per-scenario state of the 008 steps (static holder reset by {@link Hooks}). */
final class World {

    static Path tmp;
    /** Server-mode service, tools and jobs directory. */
    static AnalysisService server;
    static boolean inferenceTools;
    static Path jobsDir;
    /** Baseline of the current demo project. */
    static Map<String, String> baseline;
    /** Documents of analyses, in order. */
    static List<List<String>> analyses = new ArrayList<>();
    static Path outDir;
    static CliRunner.Result cli;
    /** Configuration under test: file and inline JSON. */
    static Path configFile;
    static String inlineConfig;
    /** Last tool result and all results of the scenario. */
    static McpSchema.CallToolResult result;
    static List<McpSchema.CallToolResult> results = new ArrayList<>();
    /** Stored analysis: directory, graph path, architecture text. */
    static Path stored;
    static Path graphPath;
    static String storedArchitecture;
    /** Free-form scenario values. */
    static List<String> names = new ArrayList<>();
    static List<Long> durations = new ArrayList<>();
    static Object value;
    /** Last architecture document (analysis or re-inference). */
    static String architecture;

    private World() {
    }

    static void reset(Path dir) {
        tmp = dir;
        server = null;
        inferenceTools = false;
        jobsDir = null;
        baseline = null;
        analyses = new ArrayList<>();
        outDir = null;
        cli = null;
        configFile = null;
        inlineConfig = null;
        result = null;
        results = new ArrayList<>();
        stored = null;
        graphPath = null;
        storedArchitecture = null;
        names = new ArrayList<>();
        durations = new ArrayList<>();
        value = null;
        architecture = null;
    }
}
