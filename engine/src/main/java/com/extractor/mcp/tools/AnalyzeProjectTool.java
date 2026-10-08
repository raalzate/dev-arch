package com.extractor.mcp.tools;

import com.extractor.mcp.ToolSchemas;
import com.extractor.service.AnalysisOptions;
import com.extractor.service.AnalysisPhase;
import com.extractor.service.AnalysisResult;
import com.extractor.service.AnalysisService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import io.modelcontextprotocol.server.McpServerFeatures;
import io.modelcontextprotocol.spec.McpSchema;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.FileWriter;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * MCP tool handler for analyze_project (FR-003).
 * Runs the full analysis pipeline and writes output files to disk;
 * reports phases when the request carries a progress token (007, FR-023).
 */
public final class AnalyzeProjectTool {

    /** Logger (stderr in MCP mode). */
    private static final Logger LOG =
            LoggerFactory.getLogger(AnalyzeProjectTool.class);

    /**
     * Serializes the notifications of concurrent analyses: the stdio
     * transport rejects messages emitted at the same time.
     */
    private static final Object PROGRESS_LOCK = new Object();

    /** Number of phases reported as progress. */
    private static final double TOTAL_PHASES =
            AnalysisPhase.values().length;

    /** Key of the warnings in the result metadata (research D4). */
    public static final String WARNINGS_META = "static-inference/warnings";

    private AnalyzeProjectTool() {
    }

    /**
     * Tool specification registered by the MCP server.
     *
     * @param service shared analysis service
     * @return the specification
     */
    public static McpServerFeatures.SyncToolSpecification spec(
            final AnalysisService service) {
        McpSchema.Tool tool = McpSchema.Tool.builder()
                .name("analyze_project")
                .description("Runs the full static analysis pipeline on a "
                        + "Java or .NET/C# project (auto-detected). Returns "
                        + "dependency graph, architecture proposals, and API "
                        + "contracts. Generates output files on disk.")
                .inputSchema(ToolSchemas.analyzeProject())
                .build();

        return new McpServerFeatures.SyncToolSpecification(tool,
                (exchange, request) -> handle(service, request,
                        exchange == null ? ProgressSink.NONE
                                : exchange::progressNotification));
    }

    /**
     * Handles a request without progress reporting.
     *
     * @param service shared analysis service
     * @param request the tool request
     * @return the tool result
     */
    public static McpSchema.CallToolResult handle(
            final AnalysisService service,
            final McpSchema.CallToolRequest request) {
        return handle(service, request, ProgressSink.NONE);
    }

    /**
     * Handles a request; phases go to {@code sink} only when the request
     * carries a progress token.
     *
     * @param service shared analysis service
     * @param request the tool request
     * @param sink    destination of the progress notifications
     * @return the tool result
     */
    public static McpSchema.CallToolResult handle(
            final AnalysisService service,
            final McpSchema.CallToolRequest request,
            final ProgressSink sink) {
        try {
            AnalysisOptions options = ToolArguments.options(request);
            String projectPath =
                    (String) request.arguments().get("projectPath");
            String outputDir = (String) request.arguments().get("outputDir");

            Path projectRoot = Paths.get(projectPath);
            if (!Files.exists(projectRoot)) {
                return errorResult("Project path '" + projectPath
                        + "' does not exist");
            }
            if (!Files.isDirectory(projectRoot)) {
                return errorResult("Project path '" + projectPath
                        + "' is not a directory");
            }
            Object token = ToolArguments.progressToken(request);
            ProgressSink progress = token == null ? ProgressSink.NONE : sink;

            AnalysisResult result = service.analyzeProject(projectRoot,
                    options, phase -> notify(progress, token, phase),
                    ToolArguments.config(request));

            notify(progress, token, AnalysisPhase.WRITING);
            Path outDir = (outputDir != null && !outputDir.isEmpty())
                    ? Paths.get(outputDir) : projectRoot;
            if (!Files.exists(outDir)) {
                Files.createDirectories(outDir);
            }
            return success(result, outDir);
        } catch (IllegalArgumentException e) {
            return errorResult(e.getMessage());
        } catch (Exception e) {
            return errorResult("Analysis failed: " + e.getMessage());
        }
    }

    /**
     * Writes the three documents and builds the response.
     *
     * @param result the analysis result
     * @param outDir output directory
     * @return the tool result
     * @throws IOException when a document cannot be written
     */
    private static McpSchema.CallToolResult success(
            final AnalysisResult result, final Path outDir)
            throws IOException {
        ObjectMapper mapper = new ObjectMapper();
        mapper.enable(SerializationFeature.INDENT_OUTPUT);
        mapper.enable(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS);

        List<String> filesGenerated = new ArrayList<>();
        String outputJson = outDir.resolve("output.json").toString();
        writeFile(mapper.writeValueAsString(result.getDependencyGraph()),
                outputJson);
        filesGenerated.add(outputJson);

        String archJson = outDir.resolve("output_architecture.json")
                .toString();
        writeFile(mapper.writeValueAsString(result.getArchitecture()),
                archJson);
        filesGenerated.add(archJson);

        String entryJson = outDir.resolve("output_entrypoints.json")
                .toString();
        writeFile(mapper.writeValueAsString(result.getApiContracts()),
                entryJson);
        filesGenerated.add(entryJson);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("componentCount", result.getComponentCount());
        response.put("edgeCount", result.getEdgeCount());
        response.put("proposalCount",
                result.getArchitecture().getProposals().size());
        response.put("endpointCount", result.getApiContracts() != null
                ? result.getApiContracts().getEndpoints().size() : 0);
        response.put("filesGenerated", filesGenerated);
        response.put("summary", result.getArchitecture().getSummary());

        McpSchema.CallToolResult.Builder builder =
                McpSchema.CallToolResult.builder()
                        .addTextContent(mapper.writeValueAsString(response))
                        .isError(false);
        if (!result.getWarnings().isEmpty()) {
            builder.meta(Map.of(WARNINGS_META, result.getWarnings()));
        }
        return builder.build();
    }

    /**
     * Sends the progress notification of a phase.
     *
     * @param sink  destination
     * @param token progress token of the request (null: nothing is sent)
     * @param phase the phase that starts
     */
    private static void notify(final ProgressSink sink, final Object token,
            final AnalysisPhase phase) {
        if (token == null) {
            return;
        }
        McpSchema.ProgressNotification notification =
                new McpSchema.ProgressNotification(token,
                        phase.ordinal() + 1.0, TOTAL_PHASES,
                        phase.wireName());
        // Progress is best effort: it never changes nor fails the analysis.
        synchronized (PROGRESS_LOCK) {
            try {
                sink.send(notification);
            } catch (RuntimeException e) {
                LOG.warn("Progress notification '{}' not sent: {}",
                        phase.wireName(), e.getMessage());
            }
        }
    }

    private static void writeFile(final String content, final String filePath)
            throws IOException {
        try (FileWriter writer =
                new FileWriter(filePath, StandardCharsets.UTF_8)) {
            writer.write(content);
        }
    }

    /**
     * Error result with a message.
     *
     * @param message the message
     * @return the tool result
     */
    public static McpSchema.CallToolResult errorResult(final String message) {
        return McpSchema.CallToolResult.builder()
                .addTextContent(message)
                .isError(true)
                .build();
    }
}
