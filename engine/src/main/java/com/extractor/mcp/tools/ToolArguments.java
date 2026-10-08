package com.extractor.mcp.tools;

import com.extractor.service.AnalysisLanguage;
import com.extractor.service.AnalysisOptions;
import io.modelcontextprotocol.spec.McpSchema;

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
}
