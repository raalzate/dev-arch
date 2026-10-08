package com.extractor.mcp;

import io.modelcontextprotocol.spec.McpSchema;

import java.util.List;
import java.util.Map;

/**
 * JSON schema definitions for all MCP tool inputs.
 * Matches contracts/mcp-tools.md (001) and contracts/engine-mcp.md (007).
 */
public final class ToolSchemas {

    /** Description of the optional language input (007, FR-024). */
    private static final String LANGUAGE_DESCRIPTION = "Analyzer to use. "
            + "'auto' (default) detects from marker files; required to "
            + "resolve projects with both Java and .NET markers.";

    /** Values of the optional language input. */
    private static final List<String> LANGUAGES =
            List.of("java", "dotnet", "auto");

    /** Project path description shared by the get_* tools. */
    private static final String PROJECT_PATH = "Absolute path to the "
            + "project root directory (Java or .NET/C#, auto-detected from "
            + "marker files)";

    /** Description of the inline inference configuration (008). */
    private static final String CONFIG = "Partial inference configuration "
            + "(schema/1.0.0/inference-config.schema.json); omitted "
            + "parameters keep their defaults. Exclusive with configPath.";

    /** Description of the configuration file path (008). */
    private static final String CONFIG_PATH = "Absolute path to a JSON "
            + "inference configuration file. Exclusive with config.";

    /** Description of the stored graph path (008). */
    private static final String GRAPH_PATH = "Absolute path to a stored "
            + "dependency graph (output.json). Exclusive with jobId.";

    /** Description of the analysis id (008). */
    private static final String JOB_ID = "Identifier of a web analysis "
            + "(requires STATIC_INFERENCE_JOBS_DIR). Exclusive with "
            + "graphPath.";

    private ToolSchemas() {
    }

    private static Map<String, Object> configProp() {
        return Map.of("type", "object", "description", CONFIG);
    }

    private static Map<String, Object> stringProp(final String description) {
        return Map.of("type", "string", "description", description);
    }

    private static Map<String, Object> enumProp(final String description,
            final List<String> values) {
        return Map.of("type", "string", "description", description,
                "enum", values);
    }

    private static Map<String, Object> languageProp() {
        return enumProp(LANGUAGE_DESCRIPTION, LANGUAGES);
    }

    private static McpSchema.JsonSchema object(
            final Map<String, Object> properties, final List<String> required) {
        return new McpSchema.JsonSchema("object", properties, required,
                null, null, null);
    }

    /**
     * Input of analyze_project.
     *
     * @return the schema
     */
    public static McpSchema.JsonSchema analyzeProject() {
        return object(Map.of(
                "projectPath", stringProp("Absolute path to the project root "
                        + "directory. Java projects must contain pom.xml or "
                        + "build.gradle; .NET projects must contain a .sln or "
                        + ".csproj file. Type is auto-detected."),
                "outputDir", stringProp("Directory to write output JSON "
                        + "files. Defaults to project root if omitted."),
                "language", languageProp(),
                "config", configProp(),
                "configPath", stringProp(CONFIG_PATH)),
                List.of("projectPath"));
    }

    /**
     * Input of get_dependency_graph.
     *
     * @return the schema
     */
    public static McpSchema.JsonSchema getDependencyGraph() {
        return object(Map.of(
                "projectPath", stringProp(PROJECT_PATH),
                "language", languageProp()),
                List.of("projectPath"));
    }

    /**
     * Input of get_architecture_proposal.
     *
     * @return the schema
     */
    public static McpSchema.JsonSchema getArchitectureProposal() {
        return object(Map.of(
                "projectPath", stringProp(PROJECT_PATH),
                "minViability", enumProp("Minimum viability threshold. Only "
                        + "proposals meeting or exceeding this level are "
                        + "returned.", List.of("Alta", "Media", "Baja")),
                "language", languageProp()),
                List.of("projectPath"));
    }

    /**
     * Input of get_api_contracts.
     *
     * @return the schema
     */
    public static McpSchema.JsonSchema getApiContracts() {
        return object(Map.of(
                "projectPath", stringProp("Absolute path to the project root "
                        + "directory. Java: detects @RestController, @Path. "
                        + ".NET: detects [ApiController] with "
                        + "[HttpGet/Post/Put/Delete]."),
                "language", languageProp()),
                List.of("projectPath"));
    }

    /**
     * Input of get_component_metrics.
     *
     * @return the schema
     */
    public static McpSchema.JsonSchema getComponentMetrics() {
        return object(Map.of(
                "projectPath", stringProp(PROJECT_PATH),
                "componentId", stringProp("Fully qualified type name. Java: "
                        + "'com.example.service.UserService'. .NET: "
                        + "'ECommerceApp.Services.ProductService'"),
                "language", languageProp()),
                List.of("projectPath", "componentId"));
    }

    /**
     * Input of reinfer_architecture (008).
     *
     * @return the schema
     */
    public static McpSchema.JsonSchema reinferArchitecture() {
        return object(Map.of(
                "graphPath", stringProp(GRAPH_PATH),
                "jobId", stringProp(JOB_ID),
                "config", configProp(),
                "configPath", stringProp(CONFIG_PATH),
                "minViability", enumProp("Minimum viability of the returned "
                        + "proposals.", List.of("Alta", "Media", "Baja"))),
                List.of());
    }

    /**
     * Input of score_proposal (008).
     *
     * @return the schema
     */
    public static McpSchema.JsonSchema scoreProposal() {
        return object(Map.of(
                "components", Map.of("type", "array", "description",
                        "Fully qualified ids of the components of the "
                                + "proposal.", "items",
                        Map.of("type", "string")),
                "graphPath", stringProp(GRAPH_PATH),
                "jobId", stringProp(JOB_ID),
                "config", configProp(),
                "configPath", stringProp(CONFIG_PATH)),
                List.of("components"));
    }
}
