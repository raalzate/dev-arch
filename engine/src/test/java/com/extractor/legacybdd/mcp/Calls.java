package com.extractor.legacybdd.mcp;

import com.fasterxml.jackson.databind.JsonNode;

import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;

/** tools/call helpers on the scenario server, recording the response in {@link World}. */
final class Calls {

    private Calls() {
    }

    /** Calls a tool, records response, elapsed time and (when JSON) the parsed text. */
    static JsonNode call(String tool, Map<String, ?> arguments) {
        long start = System.nanoTime();
        JsonNode response = World.server.callTool(tool, arguments);
        World.elapsedNanos = System.nanoTime() - start;
        record(response);
        return response;
    }

    static void record(JsonNode response) {
        World.response = response;
        String text = Support.text(response);
        World.body = null;
        if (!Support.isError(response)) {
            World.body = Support.parse(text);
        }
    }

    /** Arguments with projectPath (and outputDir when not null). */
    static Map<String, Object> args(Path project, Path outputDir) {
        Map<String, Object> args = new LinkedHashMap<>();
        args.put("projectPath", project.toString());
        if (outputDir != null) {
            args.put("outputDir", outputDir.toString());
        }
        return args;
    }

    /** Successful call of a tool on a project; analyze_project writes into a fresh output directory. */
    static JsonNode success(String tool, Path project, Map<String, Object> extra) {
        Map<String, Object> args = args(project, null);
        if ("analyze_project".equals(tool)) {
            World.outputDir = Support.newDir("out-");
            args.put("outputDir", World.outputDir.toString());
        }
        args.putAll(extra);
        World.project = project;
        JsonNode response = call(tool, args);
        assertFalse(Support.isError(response), tool + " failed: " + Support.text(response));
        return World.body;
    }

    /** Parsed result of a successful call without touching the scenario state. */
    static JsonNode query(String tool, Map<String, Object> args) {
        JsonNode response = World.server.callTool(tool, args);
        assertFalse(Support.isError(response), tool + " failed: " + Support.text(response));
        return Support.parse(Support.text(response));
    }
}
