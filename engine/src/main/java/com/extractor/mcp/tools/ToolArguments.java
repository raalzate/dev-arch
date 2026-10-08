package com.extractor.mcp.tools;

import com.extractor.inference.config.InferenceConfig;
import com.extractor.inference.config.InferenceConfigLoader;
import com.extractor.service.AnalysisLanguage;
import com.extractor.service.GraphSource;
import com.extractor.service.LoadedGraph;
import com.extractor.service.AnalysisOptions;
import io.modelcontextprotocol.spec.McpSchema;

import java.nio.file.Path;
import java.util.Map;

/**
 * Shared parsing of tool arguments (007-native-engine-runtime, FR-024).
 */
final class ToolArguments {

    private ToolArguments() {
    }

    /**
     * Analysis options from the optional {@code language} argument.
     *
     * @param request the tool request
     * @return the options
     * @throws IllegalArgumentException for an unrecognized language
     */
    static AnalysisOptions options(final McpSchema.CallToolRequest request) {
        Object value = request.arguments() == null
                ? null : request.arguments().get("language");
        if (value != null && !(value instanceof String)) {
            throw new IllegalArgumentException("Invalid language '" + value
                    + "'. Allowed: java, dotnet, auto");
        }
        return AnalysisOptions.of(AnalysisLanguage.parse((String) value));
    }

    /**
     * Progress token of the request, if any.
     *
     * @param request the tool request
     * @return the token or null
     */
    static Object progressToken(final McpSchema.CallToolRequest request) {
        return request.meta() == null
                ? null : request.meta().get("progressToken");
    }

    /**
     * Inference configuration from {@code config} (object) or
     * {@code configPath} (string), never both (008, FR-007).
     *
     * @param request the tool request
     * @return the configuration (defaults when absent)
     */
    static InferenceConfig config(final McpSchema.CallToolRequest request) {
        Map<String, Object> args = arguments(request);
        Object inline = args.get("config");
        Object path = args.get("configPath");
        if (inline != null && path != null) {
            throw new IllegalArgumentException(
                    "Pass either config or configPath, not both");
        }
        if (path != null) {
            if (!(path instanceof String) || ((String) path).isBlank()) {
                throw new IllegalArgumentException("Invalid configPath '"
                        + path + "'");
            }
            return InferenceConfigLoader.fromFile(Path.of((String) path));
        }
        return InferenceConfigLoader.fromObject(inline);
    }

    /**
     * Stored graph from {@code graphPath} or {@code jobId} (exactly one).
     *
     * @param request the tool request
     * @param jobsDir jobs directory of the server, or null
     * @return the loaded graph
     */
    static LoadedGraph graph(final McpSchema.CallToolRequest request,
            final Path jobsDir) {
        Map<String, Object> args = arguments(request);
        Object graphPath = args.get("graphPath");
        Object jobId = args.get("jobId");
        if ((graphPath == null) == (jobId == null)) {
            throw new IllegalArgumentException(
                    "Pass exactly one of graphPath or jobId");
        }
        if (graphPath != null) {
            return GraphSource.fromPath(Path.of(String.valueOf(graphPath)));
        }
        return GraphSource.fromJob(String.valueOf(jobId), jobsDir);
    }

    /**
     * Arguments of the request, never null.
     *
     * @param request the tool request
     * @return the arguments
     */
    static Map<String, Object> arguments(
            final McpSchema.CallToolRequest request) {
        return request.arguments() == null ? Map.of() : request.arguments();
    }
}
