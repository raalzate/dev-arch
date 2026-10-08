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

    private ToolSchemas() {
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
                "language", languageProp()),
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
}
