package com.extractor.legacybdd.mcp;

import com.extractor.testsupport.DemoProjects;
import com.extractor.testsupport.ProductLayout;
import com.fasterxml.jackson.databind.JsonNode;

import java.io.File;
import java.io.IOException;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.jar.Attributes;
import java.util.jar.JarOutputStream;
import java.util.jar.Manifest;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

/**
 * Shared, run-wide support of the 001 steps: scratch area, the executable artifact, the shared stdio server,
 * demo-project copies and child-process runs. Expensive resources are created once per JVM.
 */
final class Support {

    /** The five tools of the 001 contract (FR-011). */
    static final List<String> TOOLS = List.of("analyze_project", "get_dependency_graph",
            "get_architecture_proposal", "get_api_contracts", "get_component_metrics");
    /** The three documents analyze_project / the CLI write (FR-003, SC-005). */
    static final List<String> DOCUMENTS = List.of("output.json", "output_architecture.json",
            "output_entrypoints.json");
    /** Executable archive name of the assembly plugin (pom finalName). */
    static final String JAR_NAME = "java-dependency-extractor.jar";

    private static final Map<String, Path> DEMOS = new ConcurrentHashMap<>();
    private static Path scratch;
    private static Path jar;
    private static StdioServer shared;

    private Support() {
    }

    static Path engineRoot() {
        return ProductLayout.get().engineRoot();
    }

    /** Scratch root of the run: {@code target/legacybdd-001} (recreated on first use). */
    static synchronized Path scratch() {
        if (scratch == null) {
            Path dir = engineRoot().resolve("target").resolve("legacybdd-001");
            deleteRecursively(dir);
            try {
                scratch = Files.createDirectories(dir).toRealPath();
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
        }
        return scratch;
    }

    static Path newDir(String prefix) {
        try {
            return Files.createTempDirectory(scratch(), prefix);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** Read-only (never written into) copy of a demo project, shared by the scenarios of the run. */
    static Path demo(String name) {
        return DEMOS.computeIfAbsent(name, n -> DemoProjects.copy(n, newDir("demo-")));
    }

    /** Private copy of a demo project under {@code parent}. */
    static Path freshDemo(String name, Path parent) {
        return DemoProjects.copy(name, parent);
    }

    static String java() {
        return Path.of(System.getProperty("java.home"), "bin", "java").toString();
    }

    /**
     * The single executable artifact: a launcher jar built from the compiled main classes of this run (a
     * previously packaged {@code target/java-dependency-extractor.jar} may be stale during {@code mvn verify}): its manifest
     * carries the {@code Main-Class} declared by the assembly plugin of {@code pom.xml} and a {@code Class-Path}
     * with the runtime classpath (test classes excluded), so {@code java -jar} starts exactly the same entry point.
     */
    static synchronized Path jar() {
        if (jar != null) {
            return jar;
        }
        Path out = scratch().resolve("artifact").resolve(JAR_NAME);
        Manifest manifest = new Manifest();
        Attributes attributes = manifest.getMainAttributes();
        attributes.put(Attributes.Name.MANIFEST_VERSION, "1.0");
        attributes.put(Attributes.Name.MAIN_CLASS, assemblyMainClass());
        List<String> classPath = new ArrayList<>();
        for (String entry : System.getProperty("java.class.path").split(File.pathSeparator)) {
            Path p = Path.of(entry).toAbsolutePath();
            if (entry.isBlank() || p.endsWith(Path.of("target", "test-classes"))) {
                continue;
            }
            classPath.add(p.toUri().toString());
        }
        attributes.put(Attributes.Name.CLASS_PATH, String.join(" ", classPath));
        try {
            Files.createDirectories(out.getParent());
            try (OutputStream os = Files.newOutputStream(out); JarOutputStream ignored = new JarOutputStream(os,
                    manifest)) {
                // manifest-only launcher
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        jar = out;
        return jar;
    }

    /** Main-Class of the executable jar as declared by the assembly plugin of {@code pom.xml}. */
    static String assemblyMainClass() {
        try {
            String pom = Files.readString(engineRoot().resolve("pom.xml"), StandardCharsets.UTF_8);
            Matcher m = Pattern.compile("maven-assembly-plugin.*?<manifest>\\s*<mainClass>([^<]+)</mainClass>",
                    Pattern.DOTALL).matcher(pom);
            if (!m.find()) {
                fail("pom.xml declares no Main-Class for the executable jar");
            }
            return m.group(1).trim();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** {@code java -jar <artifact> --mcp}. */
    static List<String> serverCommand() {
        return List.of(java(), "-jar", jar().toString(), "--mcp");
    }

    /** {@code java -jar <artifact> args...}. */
    static List<String> jarCommand(List<String> args) {
        List<String> command = new ArrayList<>(List.of(java(), "-jar", jar().toString()));
        command.addAll(args);
        return command;
    }

    /** The MCP server shared by the scenarios ("the MCP server is running"); restarted if it died. */
    static synchronized StdioServer sharedServer() {
        if (shared == null || !shared.isAlive()) {
            shared = StdioServer.start(serverCommand(), scratch());
        }
        return shared;
    }

    static synchronized void closeShared() {
        if (shared != null) {
            shared.close();
            shared = null;
        }
    }

    /** Exit code, standard output and standard error of a child process. */
    record Run(int exitCode, String stdout, String stderr) {
        String all() {
            return stdout + "\n" + stderr;
        }
    }

    /** Runs a command with stdin closed. */
    static Run run(List<String> command, Path workDir, Duration timeout) {
        try {
            Path out = Files.createTempFile(scratch(), "out", ".txt");
            Path err = Files.createTempFile(scratch(), "err", ".txt");
            ProcessBuilder pb = new ProcessBuilder(command).directory(workDir.toFile())
                    .redirectOutput(out.toFile()).redirectError(err.toFile());
            pb.environment().remove("STATIC_INFERENCE_INFERENCE_TOOLS");
            Process p = pb.start();
            p.getOutputStream().close();
            if (!p.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS)) {
                p.destroyForcibly();
                fail("Process did not finish within " + timeout + ": " + command);
            }
            return new Run(p.exitValue(), Files.readString(out, StandardCharsets.UTF_8),
                    Files.readString(err, StandardCharsets.UTF_8));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
    }

    /** Text of {@code result.content[0]} of a tools/call response. */
    static String text(JsonNode response) {
        assertTrue(response.has("result"), "tools/call answered with a JSON-RPC error: " + response);
        JsonNode content = response.get("result").path("content");
        assertTrue(content.isArray() && content.size() > 0, "tools/call result without content: " + response);
        assertTrue("text".equals(content.get(0).path("type").asText()), "content[0] is not text: " + response);
        return content.get(0).path("text").asText();
    }

    static boolean isError(JsonNode response) {
        return response.path("result").path("isError").asBoolean(false);
    }

    static JsonNode parse(String json) {
        try {
            return StdioServer.JSON.readTree(json);
        } catch (IOException e) {
            throw new AssertionError("Not JSON: " + StdioServer.tail(json), e);
        }
    }

    static JsonNode readJson(Path file) {
        try {
            return StdioServer.JSON.readTree(file.toFile());
        } catch (IOException e) {
            throw new AssertionError("Cannot read JSON " + file, e);
        }
    }

    static String read(Path file) {
        try {
            return Files.readString(file, StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    static void deleteRecursively(Path dir) {
        if (!Files.exists(dir)) {
            return;
        }
        try (Stream<Path> walk = Files.walk(dir)) {
            walk.sorted(Comparator.reverseOrder()).forEach(p -> p.toFile().delete());
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
