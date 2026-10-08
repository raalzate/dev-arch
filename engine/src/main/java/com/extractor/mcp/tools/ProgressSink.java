package com.extractor.mcp.tools;

import io.modelcontextprotocol.spec.McpSchema;

/**
 * Destination of the progress notifications of analyze_project
 * (007-native-engine-runtime, FR-023): the MCP exchange in the server,
 * a capturing list in tests.
 */
@FunctionalInterface
public interface ProgressSink {

    /** Sink that drops every notification. */
    ProgressSink NONE = notification -> { };

    /**
     * Sends a progress notification.
     *
     * @param notification the notification
     */
    void send(McpSchema.ProgressNotification notification);
}
