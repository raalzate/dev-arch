package com.extractor.configbdd;

import com.fasterxml.jackson.databind.JsonNode;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

/** Minimal JSON-RPC client of the engine server mode over stdio (newline-delimited messages). */
final class StdioMcp implements AutoCloseable {

    private final Process process;
    private final BlockingQueue<String> lines = new LinkedBlockingQueue<>();
    private int nextId = 1;

    private StdioMcp(List<String> command) throws IOException {
        process = new ProcessBuilder(command).redirectError(ProcessBuilder.Redirect.DISCARD).start();
        Thread reader = new Thread(() -> {
            try (BufferedReader in = new BufferedReader(
                    new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = in.readLine()) != null) {
                    lines.add(line);
                }
            } catch (IOException e) {
                // process ended
            }
        });
        reader.setDaemon(true);
        reader.start();
    }

    /** Server from the test classpath. */
    static StdioMcp classpath() throws IOException {
        return start(List.of(java(), "-cp", System.getProperty("java.class.path"),
                "com.extractor.MicroserviceInferenceMain", "--mcp"));
    }

    /** Server from an engine archive. */
    static StdioMcp jar(Path jar) throws IOException {
        return start(List.of(java(), "-jar", jar.toString(), "--mcp"));
    }

    private static String java() {
        return Path.of(System.getProperty("java.home"), "bin", "java").toString();
    }

    private static StdioMcp start(List<String> command) throws IOException {
        StdioMcp client = new StdioMcp(command);
        client.request("initialize", "{\"protocolVersion\":\"2025-06-18\",\"capabilities\":{},"
                + "\"clientInfo\":{\"name\":\"008-steps\",\"version\":\"1\"}}");
        client.send("{\"jsonrpc\":\"2.0\",\"method\":\"notifications/initialized\"}");
        return client;
    }

    /** Sends a request and waits for its response (30 s). */
    JsonNode request(String method, String paramsJson) throws IOException {
        int id = nextId++;
        send("{\"jsonrpc\":\"2.0\",\"id\":" + id + ",\"method\":\"" + method + "\",\"params\":" + paramsJson + "}");
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(30);
        while (System.nanoTime() < deadline) {
            String line;
            try {
                line = lines.poll(1, TimeUnit.SECONDS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IOException(e);
            }
            if (line == null || line.isBlank()) {
                continue;
            }
            JsonNode message = Support.json(line);
            if (message.path("id").asInt(-1) == id) {
                return message;
            }
        }
        throw new IOException("no response to " + method);
    }

    private void send(String json) throws IOException {
        OutputStream out = process.getOutputStream();
        out.write((json + "\n").getBytes(StandardCharsets.UTF_8));
        out.flush();
    }

    @Override
    public void close() {
        process.destroy();
        try {
            process.waitFor(10, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        process.destroyForcibly();
    }
}
