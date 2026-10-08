package com.extractor.mcp;

import com.extractor.service.AnalysisService;
import io.modelcontextprotocol.server.McpServerFeatures;

import java.util.List;

/** Test access to the tool specifications the MCP server registers (007 step definitions). */
public final class McpToolSpecs {

    private McpToolSpecs() {
    }

    public static List<McpServerFeatures.SyncToolSpecification> of(AnalysisService service) {
        return McpServerMain.createToolSpecs(service);
    }
}
