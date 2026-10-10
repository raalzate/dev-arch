package com.extractor.legacybdd.mcp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * JSON-RPC 2.0 client of the engine server mode over stdio (newline-delimited messages), as an MCP host does it.
 * Responses are matched by id, so several requests may be in flight; notifications and every raw stdout line are
 * recorded; standard error is captured separately (logs never travel on stdout).
 */
final class StdioServer implements AutoCloseable {

    static final ObjectMapper JSON = new ObjectMapper();
    static final Duration DEFAULT_TIMEOUT = Duration.ofMinutes(3);

    private final Process process;
    private final Map<Integer, CompletableFuture<JsonNode>> pending = new ConcurrentHashMap<>();
    private final List<JsonNode> notifications = new CopyOnWriteArrayList<>();
    private final List<String> stdoutLines = new CopyOnWriteArrayList<>();
    private final StringBuffer stderr = new StringBuffer();
    private final AtomicInteger nextId = new AtomicInteger(1);
    private volatile JsonNode initializeResult;

    private StdioServer(List<String> command, Path workDir, Map<String, String> env) {
        try {
            ProcessBuilder pb = new ProcessBuilder(command).directory(workDir.toFile());
            pb.environment().remove("STATIC_INFERENCE_INFERENCE_TOOLS");
            pb.environment().putAll(env);
            process = pb.start();
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot start " + command, e);
        }
        Thread out = new Thread(this::readStdout, "001-mcp-stdout");
        out.setDaemon(true);
        out.start();
        Thread err = new Thread(this::readStderr, "001-mcp-stderr");
        err.setDaemon(true);
        err.start();
    }

    /** Starts a server process without the MCP handshake. */
    static StdioServer launch(List<String> command, Path workDir, Map<String, String> env) {
        return new StdioServer(command, workDir, env);
    }

    /** Starts a server process and performs the MCP initialize handshake. */
    static StdioServer start(List<String> command, Path workDir) {
        StdioServer server = launch(command, workDir, Map.of());
        server.initialize();
        return server;
    }

    /** MCP handshake: initialize request + initialized notification. Returns the initialize result. */
    JsonNode initialize() {
        ObjectNode params = JSON.createObjectNode();
        params.put("protocolVersion", "2025-06-18");
        params.putObject("capabilities");
        params.putObject("clientInfo").put("name", "001-legacy-bdd").put("version", "1");
        JsonNode response = request("initialize", params, Duration.ofSeconds(60));
        if (!response.has("result")) {
            throw new IllegalStateException("initialize failed: " + response);
        }
        initializeResult = response.get("result");
        send(JSON.createObjectNode().put("jsonrpc", "2.0").put("method", "notifications/initialized"));
        return initializeResult;
    }

    JsonNode initializeResult() {
        return initializeResult;
    }

    /** Sends a request and returns the future of its full response message. */
    CompletableFuture<JsonNode> requestAsync(String method, JsonNode params) {
        int id = nextId.getAndIncrement();
        CompletableFuture<JsonNode> future = new CompletableFuture<>();
        pending.put(id, future);
        ObjectNode message = JSON.createObjectNode().put("jsonrpc", "2.0").put("id", id).put("method", method);
        if (params != null) {
            message.set("params", params);
        }
        send(message);
        return future;
    }

    /** Sends a request and waits for its full response message. */
    JsonNode request(String method, JsonNode params, Duration timeout) {
        return await(requestAsync(method, params), timeout, method);
    }

    JsonNode request(String method, JsonNode params) {
        return request(method, params, DEFAULT_TIMEOUT);
    }

    /** tools/call; {@code meta} (may be null) goes to {@code params._meta}. Returns the full response message. */
    CompletableFuture<JsonNode> callToolAsync(String tool, Map<String, ?> arguments, Map<String, ?> meta) {
        ObjectNode params = JSON.createObjectNode().put("name", tool);
        params.set("arguments", JSON.valueToTree(arguments));
        if (meta != null) {
            params.set("_meta", JSON.valueToTree(meta));
        }
        return requestAsync("tools/call", params);
    }

    JsonNode callTool(String tool, Map<String, ?> arguments) {
        return await(callToolAsync(tool, arguments, null), DEFAULT_TIMEOUT, tool);
    }

    static JsonNode await(CompletableFuture<JsonNode> future, Duration timeout, String what) {
        try {
            return future.get(timeout.toMillis(), TimeUnit.MILLISECONDS);
        } catch (TimeoutException e) {
            throw new AssertionError("No response to " + what + " within " + timeout, e);
        } catch (ExecutionException e) {
            throw new AssertionError("Request " + what + " failed: " + e.getCause().getMessage(), e.getCause());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
    }

    List<JsonNode> notifications() {
        return List.copyOf(notifications);
    }

    List<String> stdoutLines() {
        return List.copyOf(stdoutLines);
    }

    String stderr() {
        return stderr.toString();
    }

    boolean isAlive() {
        return process.isAlive();
    }

    private synchronized void send(JsonNode message) {
        try {
            OutputStream out = process.getOutputStream();
            out.write((JSON.writeValueAsString(message) + "\n").getBytes(StandardCharsets.UTF_8));
            out.flush();
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot write to the server (alive=" + process.isAlive() + ", stderr="
                    + tail(stderr()) + ")", e);
        }
    }

    private void readStdout() {
        try (BufferedReader in = new BufferedReader(
                new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = in.readLine()) != null) {
                stdoutLines.add(line);
                if (line.isBlank()) {
                    continue;
                }
                JsonNode message;
                try {
                    message = JSON.readTree(line);
                } catch (IOException e) {
                    continue; // recorded in stdoutLines; scenarios that care check them
                }
                if (message.has("id") && (message.has("result") || message.has("error"))) {
                    CompletableFuture<JsonNode> future = pending.remove(message.get("id").asInt());
                    if (future != null) {
                        future.complete(message);
                    }
                } else if (message.has("method")) {
                    notifications.add(message);
                }
            }
        } catch (IOException e) {
            // process ended
        } finally {
            pending.values().forEach(f -> f.completeExceptionally(
                    new IllegalStateException("server stdout closed; stderr: " + tail(stderr()))));
        }
    }

    private void readStderr() {
        try (BufferedReader in = new BufferedReader(
                new InputStreamReader(process.getErrorStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = in.readLine()) != null) {
                stderr.append(line).append('\n');
            }
        } catch (IOException e) {
            // process ended
        }
    }

    static String tail(String text) {
        return text.length() <= 2000 ? text : text.substring(text.length() - 2000);
    }

    @Override
    public void close() {
        try {
            process.getOutputStream().close();
        } catch (IOException e) {
            // already closed
        }
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
