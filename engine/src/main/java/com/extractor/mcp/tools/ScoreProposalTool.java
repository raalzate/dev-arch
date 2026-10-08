package com.extractor.mcp.tools;

import com.extractor.inference.config.InferenceConfig;
import com.extractor.mcp.ToolSchemas;
import com.extractor.service.AnalysisService;
import com.extractor.service.LoadedGraph;
import com.extractor.service.ProposalScore;
import io.modelcontextprotocol.server.McpServerFeatures;
import io.modelcontextprotocol.spec.McpSchema;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/**
 * MCP tool handler for score_proposal (008, FR-018..FR-020): scores a
 * user-edited proposal with the formulas of the engine's proposals.
 */
public final class ScoreProposalTool {

    /** Tool name. */
    public static final String NAME = "score_proposal";

    private ScoreProposalTool() {
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
                .description("Scores a proposal given as a list of "
                        + "component ids over a stored dependency graph "
                        + "(graphPath or jobId): viability, score, metrics, "
                        + "rationale, recommended actions and a name.")
                .inputSchema(ToolSchemas.scoreProposal())
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
            List<String> components = components(
                    ToolArguments.arguments(request).get("components"));
            LoadedGraph graph = ToolArguments.graph(request, jobsDir);
            ProposalScore score = service.scoreProposal(graph, components,
                    config);
            return McpSchema.CallToolResult.builder()
                    .addTextContent(ReinferArchitectureTool.mapper()
                            .writeValueAsString(score))
                    .isError(false)
                    .build();
        } catch (IllegalArgumentException e) {
            return AnalyzeProjectTool.errorResult(e.getMessage());
        } catch (Exception e) {
            return AnalyzeProjectTool.errorResult("Scoring failed: "
                    + e.getMessage());
        }
    }

    /**
     * The {@code components} argument as a list of strings.
     *
     * @param value raw argument
     * @return the ids (empty when absent)
     */
    private static List<String> components(final Object value) {
        List<String> ids = new ArrayList<>();
        if (value == null) {
            return ids;
        }
        if (!(value instanceof List<?> list)) {
            throw new IllegalArgumentException(
                    "components must be an array of component ids");
        }
        for (Object id : list) {
            if (!(id instanceof String)) {
                throw new IllegalArgumentException(
                        "components must be an array of component ids");
            }
            ids.add((String) id);
        }
        return ids;
    }
}
