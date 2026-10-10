package com.extractor.legacybdd.dotnet;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

/**
 * Minimal JSON-RPC client of the real MCP server ({@code MicroserviceInferenceMain --mcp}) started from the
 * test classpath over stdio.
 */
final class McpStdioClient implements AutoCloseable {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final long RESPONSE_TIMEOUT_SECONDS = 300;

    private final Process process;
    private final BlockingQueue<String> lines = new LinkedBlockingQueue<>();
    private int nextId = 1;

    private McpStdioClient(Process process) {
        this.process = process;
        Thread reader = new Thread(() -> {
            try (BufferedReader in = new BufferedReader(
                    new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = in.readLine()) != null) {
                    lines.add(line);
                }
            } catch (IOException e) {
                // the server ended
            }
        }, "mcp-stdio-reader");
        reader.setDaemon(true);
        reader.start();
    }

    /** Starts the server of the test classpath and completes the MCP handshake. */
    static McpStdioClient start(Path workDir) throws IOException {
        List<String> command = List.of(Path.of(System.getProperty("java.home"), "bin", "java").toString(),
                "-cp", System.getProperty("java.class.path"), "com.extractor.MicroserviceInferenceMain", "--mcp");
        Process process = new ProcessBuilder(command).directory(workDir.toFile())
                .redirectError(ProcessBuilder.Redirect.DISCARD).start();
        McpStdioClient client = new McpStdioClient(process);
        JsonNode init = client.request("initialize", Map.of("protocolVersion", "2025-06-18",
                "capabilities", Map.of(), "clientInfo", Map.of("name", "legacybdd-002", "version", "1")));
        if (!init.has("result")) {
            client.close();
            throw new IOException("MCP initialize failed: " + init);
        }
        client.send(Map.of("jsonrpc", "2.0", "method", "notifications/initialized"));
        return client;
    }

    /** Names of the tools listed by the server. */
    List<String> toolNames() throws IOException {
        JsonNode response = request("tools/list", Map.of());
        return response.path("result").path("tools").findValuesAsText("name");
    }

    /** Calls a tool and returns the JSON-RPC {@code result} node. */
    JsonNode callTool(String tool, Map<String, Object> arguments) throws IOException {
        JsonNode response = request("tools/call", Map.of("name", tool, "arguments", arguments));
        if (!response.has("result")) {
            throw new IOException("tools/call " + tool + " returned no result: " + response);
        }
        return response.path("result");
    }

    /** Text of the first content item of a tool result. */
    static String text(JsonNode result) {
        return result.path("content").path(0).path("text").asText();
    }

    /** Whether a tool result is an error. */
    static boolean isError(JsonNode result) {
        return result.path("isError").asBoolean(false);
    }

    private JsonNode request(String method, Map<String, Object> params) throws IOException {
        int id = nextId++;
        send(Map.of("jsonrpc", "2.0", "id", id, "method", method, "params", params));
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(RESPONSE_TIMEOUT_SECONDS);
        while (System.nanoTime() < deadline) {
            String line;
            try {
                line = lines.poll(1, TimeUnit.SECONDS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IOException(e);
            }
            if (line == null) {
                if (!process.isAlive()) {
                    throw new IOException("MCP server exited with code " + process.exitValue());
                }
                continue;
            }
            if (line.isBlank()) {
                continue;
            }
            JsonNode message = MAPPER.readTree(line);
            if (message.path("id").asInt(-1) == id) {
                return message;
            }
        }
        throw new IOException("no response to " + method + " within " + RESPONSE_TIMEOUT_SECONDS + " s");
    }

    private void send(Map<String, Object> message) throws IOException {
        OutputStream out = process.getOutputStream();
        out.write((MAPPER.writeValueAsString(message) + "\n").getBytes(StandardCharsets.UTF_8));
        out.flush();
    }

    @Override
    public void close() {
        process.destroy();
        try {
            if (!process.waitFor(10, TimeUnit.SECONDS)) {
                process.destroyForcibly();
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            process.destroyForcibly();
        }
    }
}
