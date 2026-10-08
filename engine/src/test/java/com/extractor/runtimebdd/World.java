package com.extractor.runtimebdd;

import com.extractor.service.AnalysisService;
import com.extractor.testsupport.CliRunner;
import io.modelcontextprotocol.spec.McpSchema;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Per-scenario state of the 007 engine steps (static holder reset by {@link Hooks}). */
final class World {

    /** Scratch directory of the scenario. */
    static Path tmp;
    /** Server-mode service (as {@code McpServerMain} creates it). */
    static AnalysisService server;
    /** Project under test. */
    static Path project;
    /** Output directory of the last server-mode analysis. */
    static Path serverOut;
    /** Last tool result and the progress notifications it produced. */
    static McpSchema.CallToolResult result;
    static List<McpSchema.ProgressNotification> notifications = new ArrayList<>();
    /** Reference (first) result and documents. */
    static McpSchema.CallToolResult firstResult;
    static List<String> firstDocs;
    /** Durations of the first and second full analyses (ns). */
    static long firstNanos;
    static long secondNanos;
    /** Whether the last full analysis was a cache miss. */
    static boolean lastWasMiss;
    /** Last CLI run and its output directory. */
    static CliRunner.Result cli;
    static Path cliOut;
    /** Listed tools. */
    static List<McpSchema.Tool> tools = new ArrayList<>();
    /** Projects analyzed in TS-057/TS-064 and documents keyed by project. */
    static List<Path> projects = new ArrayList<>();
    static Map<String, List<String>> docs = new HashMap<>();
    /** Relative path of a broken source file (TS-059). */
    static String brokenFile;

    private World() {
    }

    /** Output directory of the first full analysis (its paths appear in filesGenerated). */
    static String firstDocsDir() {
        return firstOut == null ? "" : firstOut.toString();
    }

    /** Output directory of the first full analysis. */
    static Path firstOut;

    static void reset(Path scratch) {
        tmp = scratch;
        server = null;
        project = null;
        serverOut = null;
        result = null;
        notifications = new ArrayList<>();
        firstResult = null;
        firstDocs = null;
        firstNanos = 0;
        secondNanos = 0;
        lastWasMiss = false;
        cli = null;
        cliOut = null;
        tools = new ArrayList<>();
        projects = new ArrayList<>();
        docs = new HashMap<>();
        brokenFile = null;
        firstOut = null;
    }
}
