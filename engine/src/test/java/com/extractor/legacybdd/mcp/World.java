package com.extractor.legacybdd.mcp;

import com.fasterxml.jackson.databind.JsonNode;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Per-scenario state of the 001 steps (static holder reset by {@link Hooks}). */
final class World {

    /** Server the scenario talks to (shared or own). */
    static StdioServer server;
    /** Server process started by the scenario itself (closed after the scenario). */
    static StdioServer ownServer;
    /** Last tools/call response message and its parsed text when it is JSON. */
    static JsonNode response;
    static JsonNode body;
    /** Last tools/list response message. */
    static JsonNode toolsList;
    /** Project, output directory, component and argument of the last call. */
    static Path project;
    static Path outputDir;
    static String componentId;
    static String argument;
    /** Elapsed time of the last call (ns). */
    static long elapsedNanos;
    /** Responses of the internal-error probes keyed by tool. */
    static Map<String, JsonNode> errorResponses = new LinkedHashMap<>();
    /** Concurrent analyses: projects, output directories and responses. */
    static List<Path> projects = new ArrayList<>();
    static List<Path> outputDirs = new ArrayList<>();
    static List<JsonNode> responses = new ArrayList<>();
    /** Child-process runs (CLI) and their output directory. */
    static Support.Run run;
    static List<Support.Run> runs = new ArrayList<>();
    static Path cliOut;
    /** Agent integration file and what the agent discovered. */
    static Path agentConfig;
    static Map<String, JsonNode> discovered = new LinkedHashMap<>();
    static Map<String, JsonNode> discoveredTools = new LinkedHashMap<>();
    /** Progress token of the long-running analysis. */
    static String progressToken;
    /** Pings answered while the long analysis was running. */
    static List<JsonNode> pingsDuringAnalysis = new ArrayList<>();
    /** Progress notifications received when the long analysis answered, and its size in classes. */
    static List<JsonNode> notificationsAtResponse = new ArrayList<>();
    static int generatedClasses;

    private World() {
    }

    static void reset() {
        server = null;
        ownServer = null;
        response = null;
        body = null;
        toolsList = null;
        project = null;
        outputDir = null;
        componentId = null;
        argument = null;
        elapsedNanos = 0;
        errorResponses = new LinkedHashMap<>();
        projects = new ArrayList<>();
        outputDirs = new ArrayList<>();
        responses = new ArrayList<>();
        run = null;
        runs = new ArrayList<>();
        cliOut = null;
        agentConfig = null;
        discovered = new LinkedHashMap<>();
        discoveredTools = new LinkedHashMap<>();
        progressToken = null;
        pingsDuringAnalysis = new ArrayList<>();
        notificationsAtResponse = new ArrayList<>();
        generatedClasses = 0;
    }
}
