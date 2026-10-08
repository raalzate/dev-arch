package com.extractor.mcp.tools;

import com.extractor.inference.ConsolidatedArchitecture;
import com.extractor.inference.config.InferenceConfig;
import com.extractor.mcp.ToolSchemas;
import com.extractor.service.AnalysisService;
import com.extractor.service.LoadedGraph;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import io.modelcontextprotocol.server.McpServerFeatures;
import io.modelcontextprotocol.spec.McpSchema;

import java.nio.file.Path;
import java.util.Map;

/**
 * MCP tool handler for reinfer_architecture (008, FR-012..FR-017): runs the
 * inference again over a stored dependency graph.
 */
public final class ReinferArchitectureTool {

    /** Tool name. */
    public static final String NAME = "reinfer_architecture";

    private ReinferArchitectureTool() {
    }

    /**
     * Tool specification.
     *
     * @param service shared analysis service
     * @param jobsDir jobs directory of the server, or null
     * @return the specification
     */
    public static McpServerFeatures.SyncToolSpecification spec(
            final AnalysisService service, final Path jobsDir) {
        McpSchema.Tool tool = McpSchema.Tool.builder()
                .name(NAME)
                .description("Re-runs the architecture inference over an "
                        + "already extracted dependency graph (graphPath "
                        + "or jobId) with an optional inference "
                        + "configuration, without reading the sources.")
                .inputSchema(ToolSchemas.reinferArchitecture())
                .build();
        return new McpServerFeatures.SyncToolSpecification(tool,
                (exchange, request) -> handle(service, request, jobsDir));
    }

    /**
     * Handles a request.
     *
     * @param service shared analysis service
     * @param request the tool request
     * @param jobsDir jobs directory of the server, or null
     * @return the tool result
     */
    public static McpSchema.CallToolResult handle(
            final AnalysisService service,
            final McpSchema.CallToolRequest request, final Path jobsDir) {
        try {
            InferenceConfig config = ToolArguments.config(request);
            Object minViability =
                    ToolArguments.arguments(request).get("minViability");
            LoadedGraph graph = ToolArguments.graph(request, jobsDir);
            ConsolidatedArchitecture architecture = service.reinfer(graph,
                    config, minViability == null ? null
                            : String.valueOf(minViability));
            McpSchema.CallToolResult.Builder builder =
                    McpSchema.CallToolResult.builder()
                            .addTextContent(mapper()
                                    .writeValueAsString(architecture))
                            .isError(false);
            if (!graph.warnings().isEmpty()) {
                builder.meta(Map.of(AnalyzeProjectTool.WARNINGS_META,
                        graph.warnings()));
            }
            return builder.build();
        } catch (IllegalArgumentException e) {
            return AnalyzeProjectTool.errorResult(e.getMessage());
        } catch (Exception e) {
            return AnalyzeProjectTool.errorResult("Re-inference failed: "
                    + e.getMessage());
        }
    }

    /**
     * Mapper of the CLI and of get_architecture_proposal.
     *
     * @return the mapper
     */
    static ObjectMapper mapper() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.enable(SerializationFeature.INDENT_OUTPUT);
        mapper.enable(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS);
        return mapper;
    }
}
