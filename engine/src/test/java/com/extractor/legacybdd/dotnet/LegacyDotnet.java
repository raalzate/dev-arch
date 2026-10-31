package com.extractor.legacybdd.dotnet;

import com.extractor.analyzer.DotNetToolLocator;
import com.extractor.bdd.ToolAvailability;
import com.extractor.schema.DemoOutputs;
import com.extractor.schema.SchemaRegistry;
import com.extractor.service.AnalysisResult;
import com.extractor.service.AnalysisService;
import com.extractor.testsupport.ProductLayout;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Assumptions;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Shared support of the 002 scenarios: tool guards, fixture copies, cached engine and raw analyzer runs, child
 * JVMs and JSON helpers. Analyses are cached per project directory for the lifetime of the JVM (the engine is
 * deterministic, BUG-001); scenarios that measure or repeat an analysis bypass the cache.
 */
public final class LegacyDotnet {

    /** System property that forces the .NET analyzer to be treated as absent. */
    public static final String ANALYZER_PROPERTY = "legacybdd.analyzer";

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Map<Path, EngineRun> ENGINE_RUNS = new ConcurrentHashMap<>();
    private static final Map<Path, RawRun> RAW_RUNS = new ConcurrentHashMap<>();
    private static final Map<String, Path> FIXTURE_COPIES = new ConcurrentHashMap<>();
    private static final AtomicInteger SCRATCH_COUNTER = new AtomicInteger();
    private static volatile Path workRoot;

    private LegacyDotnet() {
    }

    /** Result of an engine analysis serialized exactly as the CLI does. */
    public record EngineRun(Path project, String graphJson, String architectureJson, String entrypointsJson,
                     List<String> warnings, Duration elapsed) {

        JsonNode graph() {
            return json(graphJson);
        }

        JsonNode architecture() {
            return json(architectureJson);
        }

        /** Component of the graph by id, failing when it is absent. */
        JsonNode component(String id) {
            for (JsonNode component : graph().path("components")) {
                if (id.equals(component.path("id").asText())) {
                    return component;
                }
            }
            throw new AssertionError("component " + id + " not found in the graph of " + project
                    + "; components: " + componentIds());
        }

        List<String> componentIds() {
            List<String> ids = new ArrayList<>();
            graph().path("components").forEach(c -> ids.add(c.path("id").asText()));
            return ids;
        }
    }

    /** Raw run of the {@code dotnet-analyzer} executable. */
    public record RawRun(int exitCode, String stdout, String stderr) {
    }

    /** Output of a child JVM. */
    public record ChildRun(int exitCode, String stdout, String stderr) {
    }

    /**
     * Skips the scenario when the .NET analyzer is reported absent ({@code -Dlegacybdd.analyzer=absent}) or
     * cannot be located the way the engine locates it.
     */
    public static void requireAnalyzer() {
        if ("absent".equals(System.getProperty(ANALYZER_PROPERTY))) {
            Assumptions.abort("requires-dotnet: .NET analyzer reported absent (legacybdd.analyzer=absent)");
        }
        ToolAvailability.requireDotnetAnalyzer();
    }

    /** Engine root (Maven base directory). */
    public static Path engineRoot() {
        return ProductLayout.get().engineRoot();
    }

    /** Scratch root {@code target/legacybdd-dotnet}, emptied once per JVM. */
    public static Path workRoot() {
        Path root = workRoot;
        if (root == null) {
            synchronized (LegacyDotnet.class) {
                if (workRoot == null) {
                    Path candidate = engineRoot().resolve("target").resolve("legacybdd-dotnet");
                    deleteRecursively(candidate);
                    createDirectories(candidate);
                    workRoot = candidate.toAbsolutePath().normalize();
                }
                root = workRoot;
            }
        }
        return root;
    }

    /** New empty scratch directory. */
    public static Path scratch(String name) {
        Path dir = workRoot().resolve("scratch").resolve(SCRATCH_COUNTER.incrementAndGet() + "-" + name);
        createDirectories(dir);
        return dir;
    }

    /**
     * Copy of a fixture of {@code src/test/resources/legacybdd/dotnet/} (the analyzer may write build outputs
     * next to the project files, so it never runs on the sources). Created once per JVM.
     */
    public static Path fixture(String name) {
        return FIXTURE_COPIES.computeIfAbsent(name, n -> {
            Path source = engineRoot().resolve("src/test/resources/legacybdd/dotnet").resolve(n);
            assertTrue(Files.isDirectory(source), "fixture not found: " + source);
            Path target = workRoot().resolve("fixtures").resolve(n);
            copyTree(source, target);
            return target;
        });
    }

    /** Hermetic copy of a demo project of {@code test-for-demo/} (shared with the 005 tests). */
    public static Path demo(String project) {
        return DemoOutputs.projectDir(project).toAbsolutePath().normalize();
    }

    /** Engine analysis of a project, cached per directory. */
    public static EngineRun engine(Path project) {
        return ENGINE_RUNS.computeIfAbsent(project.toAbsolutePath().normalize(), LegacyDotnet::analyzeFresh);
    }

    /** Engine analysis of a project without cache (timed). */
    public static EngineRun analyzeFresh(Path project) {
        long start = System.nanoTime();
        try {
            AnalysisResult result = new AnalysisService().analyzeProject(project);
            Duration elapsed = Duration.ofNanos(System.nanoTime() - start);
            ObjectMapper cli = DemoOutputs.cliMapper();
            return new EngineRun(project, cli.writeValueAsString(result.getDependencyGraph()),
                    cli.writeValueAsString(result.getArchitecture()),
                    cli.writeValueAsString(result.getApiContracts()), List.copyOf(result.getWarnings()), elapsed);
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("analysis of " + project + " failed: " + e.getMessage(), e);
        }
    }

    /** Raw run of the located {@code dotnet-analyzer} on a project, cached per directory. */
    public static RawRun raw(Path project) {
        return RAW_RUNS.computeIfAbsent(project.toAbsolutePath().normalize(), LegacyDotnet::runAnalyzer);
    }

    private static RawRun runAnalyzer(Path project) {
        Path exe = new DotNetToolLocator(engineRoot().resolve("target")).locate();
        try {
            Process process = new ProcessBuilder(List.of(exe.toString(), project.toString())).start();
            process.getOutputStream().close();
            CompletableFuture<String> out = drain(process.getInputStream());
            CompletableFuture<String> err = drain(process.getErrorStream());
            if (!process.waitFor(10, TimeUnit.MINUTES)) {
                process.descendants().forEach(ProcessHandle::destroyForcibly);
                process.destroyForcibly();
                throw new AssertionError("dotnet-analyzer did not finish in 10 minutes on " + project);
            }
            return new RawRun(process.exitValue(), out.join(), err.join());
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
    }

    /**
     * Runs a main class of the test classpath in a child JVM.
     *
     * @param workDir   working directory
     * @param env       extra environment variables
     * @param mainClass fully qualified main class
     * @param args      program arguments
     * @return exit code and outputs
     */
    public static ChildRun java(Path workDir, Map<String, String> env, String mainClass, List<String> args) {
        List<String> command = new ArrayList<>();
        command.add(Path.of(System.getProperty("java.home"), "bin", "java").toString());
        command.add("-cp");
        command.add(System.getProperty("java.class.path"));
        command.add(mainClass);
        command.addAll(args);
        try {
            createDirectories(workDir);
            ProcessBuilder builder = new ProcessBuilder(command).directory(workDir.toFile());
            builder.environment().putAll(env);
            Process process = builder.start();
            process.getOutputStream().close();
            CompletableFuture<String> out = drain(process.getInputStream());
            CompletableFuture<String> err = drain(process.getErrorStream());
            if (!process.waitFor(10, TimeUnit.MINUTES)) {
                process.destroyForcibly();
                throw new AssertionError("child JVM did not finish in 10 minutes: " + mainClass + " " + args);
            }
            return new ChildRun(process.exitValue(), out.join(), err.join());
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
    }

    /** Runs the CLI ({@code MicroserviceInferenceMain}) in a child JVM. */
    public static ChildRun cli(Path workDir, Map<String, String> env, List<String> args) {
        return java(workDir, env, "com.extractor.MicroserviceInferenceMain", args);
    }

    /** Validates a document against a contract kind and fails with the errors. */
    public static void assertValid(String kind, String json, String what) {
        List<String> errors = SchemaRegistry.get().validate(kind, json);
        assertEquals(List.of(), errors, what + " must validate against " + kind);
    }

    public static JsonNode json(String text) {
        try {
            return MAPPER.readTree(text);
        } catch (IOException e) {
            throw new AssertionError("invalid JSON: " + e.getMessage() + "\n" + abbreviate(text), e);
        }
    }

    public static String read(Path file) {
        try {
            return Files.readString(file, StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public static void write(Path file, String content) {
        try {
            createDirectories(file.getParent());
            Files.writeString(file, content, StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** Source files with the given extension under a directory (build outputs excluded), sorted. */
    public static List<Path> sources(Path root, String extension) {
        try (Stream<Path> walk = Files.walk(root)) {
            return walk.filter(Files::isRegularFile)
                    .filter(p -> p.getFileName().toString().endsWith(extension))
                    .filter(p -> {
                        for (Path part : root.relativize(p)) {
                            String name = part.toString();
                            if (name.equals("bin") || name.equals("obj")) {
                                return false;
                            }
                        }
                        return true;
                    })
                    .sorted()
                    .toList();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** True when the directory (not its subdirectories) holds a file with the extension. */
    public static boolean hasRootFile(Path dir, String extension) {
        try (Stream<Path> list = Files.list(dir)) {
            return list.anyMatch(p -> Files.isRegularFile(p) && p.getFileName().toString().endsWith(extension));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public static String abbreviate(String text) {
        return text.length() <= 2000 ? text : text.substring(0, 2000) + "...";
    }

    public static void createDirectories(Path dir) {
        try {
            Files.createDirectories(dir);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static void copyTree(Path source, Path target) {
        try (Stream<Path> walk = Files.walk(source)) {
            for (Path p : (Iterable<Path>) walk.sorted()::iterator) {
                Path dest = target.resolve(source.relativize(p).toString());
                if (Files.isDirectory(p)) {
                    Files.createDirectories(dest);
                } else {
                    Files.copy(p, dest, StandardCopyOption.REPLACE_EXISTING);
                }
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static void deleteRecursively(Path dir) {
        if (!Files.exists(dir)) {
            return;
        }
        try (Stream<Path> walk = Files.walk(dir)) {
            for (Path p : walk.sorted(Comparator.reverseOrder()).toList()) {
                Files.delete(p);
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static CompletableFuture<String> drain(InputStream stream) {
        return CompletableFuture.supplyAsync(() -> {
            try (InputStream in = stream; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                in.transferTo(out);
                return out.toString(StandardCharsets.UTF_8);
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
        });
    }
}
