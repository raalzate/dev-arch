package com.extractor.mcp;

import com.extractor.mcp.tools.*;
import com.extractor.service.AnalysisCache;
import com.extractor.service.AnalysisService;
import io.modelcontextprotocol.json.McpJsonDefaults;
import io.modelcontextprotocol.server.McpServer;
import io.modelcontextprotocol.server.McpServerFeatures;
import io.modelcontextprotocol.server.McpSyncServer;
import io.modelcontextprotocol.server.transport.StdioServerTransportProvider;
import io.modelcontextprotocol.spec.McpSchema;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.Properties;

/**
 * MCP server entry point. Starts a synchronous MCP server over stdio transport
 * and registers all analysis tools. Delegates to AnalysisService (Constitution II).
 */
public class McpServerMain {

    private static final String SERVER_NAME = "static-inference";

    /** Classpath resource filtered by Maven with the product version. */
    private static final String VERSION_RESOURCE =
            "/static-inference-version.properties";

    /** Product version reported in serverInfo (single VERSION, FR-021). */
    private static final String SERVER_VERSION = loadServerVersion();

    /**
     * Product version reported by the server.
     *
     * @return the version filtered into the version resource
     */
    public static String serverVersion() {
        return SERVER_VERSION;
    }

    /**
     * Reads the product version from the Maven-filtered resource.
     *
     * @return the version, or "unknown" when the resource is unreadable
     */
    private static String loadServerVersion() {
        Properties props = new Properties();
        try (InputStream in =
                McpServerMain.class.getResourceAsStream(VERSION_RESOURCE)) {
            if (in != null) {
                props.load(in);
            }
        } catch (IOException e) {
            return "unknown";
        }
        return props.getProperty("version", "unknown");
    }

    /**
     * Analysis service of the server mode.
     *
     * @return the service shared by the five tools
     */
    public static AnalysisService createService() {
        return createService(AnalysisCache.fromEnvironment().capacity());
    }

    /**
     * Analysis service of the server mode with an explicit reuse capacity.
     *
     * @param reuseCapacity projects kept in memory, 0 disables reuse
     * @return the service
     */
    public static AnalysisService createService(final int reuseCapacity) {
        return new AnalysisService(new AnalysisCache(reuseCapacity));
    }

    /**
     * Creates tool specifications for all 5 MCP tools.
     * Exposed as package-private for testing.
     */
    static List<McpServerFeatures.SyncToolSpecification> createToolSpecs(AnalysisService service) {
        return createToolSpecs(service, false, null);
    }

    /** Environment variable / system property enabling the inference tools (008). */
    public static final String INFERENCE_TOOLS = "STATIC_INFERENCE_INFERENCE_TOOLS";

    /**
     * Tool specifications, optionally with the 008 inference tools
     * (reinfer_architecture, score_proposal; research D5).
     *
     * @param service        shared analysis service
     * @param inferenceTools whether to add the inference tools
     * @param jobsDir        jobs directory for jobId, or null
     * @return the specifications
     */
    public static List<McpServerFeatures.SyncToolSpecification> createToolSpecs(
            final AnalysisService service, final boolean inferenceTools,
            final java.nio.file.Path jobsDir) {
        List<McpServerFeatures.SyncToolSpecification> specs = new java.util.ArrayList<>(List.of(
                AnalyzeProjectTool.spec(service),
                GetDependencyGraphTool.spec(service),
                GetArchitectureTool.spec(service),
                GetApiContractsTool.spec(service),
                GetComponentMetricsTool.spec(service)));
        if (inferenceTools) {
            specs.add(ReinferArchitectureTool.spec(service, jobsDir));
            specs.add(ScoreProposalTool.spec(service, jobsDir));
        }
        return List.copyOf(specs);
    }

    /**
     * Whether the inference tools are enabled (env or system property).
     *
     * @return true when set to "true"
     */
    static boolean inferenceToolsEnabled() {
        String value = System.getProperty(INFERENCE_TOOLS);
        if (value == null) {
            value = System.getenv(INFERENCE_TOOLS);
        }
        return Boolean.parseBoolean(value);
    }

    /**
     * Starts the MCP server with stdio transport. Blocks until stdin is closed.
     * Redirects SLF4J to stderr so logs don't corrupt the MCP protocol on stdout.
     */
    public static void start() {
        // Redirect SLF4J Simple to stderr — stdout is reserved for MCP protocol (research.md Decision 7)
        System.setProperty("org.slf4j.simpleLogger.logFile", "System.err");

        AnalysisService service = createService();
        List<McpServerFeatures.SyncToolSpecification> tools = createToolSpecs(service,
                inferenceToolsEnabled(), com.extractor.service.GraphSource.configuredJobsDir());

        // Serialized: concurrent analyses must not lose responses (stdio).
        SerializedTransportProvider transport =
                new SerializedTransportProvider(
                        new StdioServerTransportProvider(
                                McpJsonDefaults.getMapper()));

        McpSyncServer server = McpServer.sync(transport)
                .serverInfo(SERVER_NAME, SERVER_VERSION)
                .capabilities(new McpSchema.ServerCapabilities.Builder()
                        .tools(true)
                        .resources(false, false)
                        .build())
                .tools(tools)
                .resources(McpResources.specs())
                .resourceTemplates(McpResources.templates())
                .build();

        // Block until the process is terminated; stdio transport reads stdin in background
        Runtime.getRuntime().addShutdownHook(new Thread(server::closeGracefully));
        try {
            Thread.currentThread().join();
        } catch (InterruptedException e) {
            server.closeGracefully();
        }
    }
}
