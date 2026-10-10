package com.extractor.legacybdd.codeissues;

import com.extractor.analyzer.DotNetToolLocator;
import com.extractor.bdd.ToolAvailability;
import com.extractor.testsupport.DemoProjects;
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
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;

/**
 * Real fixtures of the 003 scenarios: C# projects generated from the doc strings of the locked {@code .feature}
 * files and analyzed by the real {@code dotnet-analyzer} executable.
 * <p>
 * Every scenario owns one SDK-style project ({@code tsNNN/tsNNN.csproj}) inside a single solution, so the whole
 * suite pays the analyzer (MSBuildWorkspace) start-up once: the batch is analyzed on first use and cached for
 * the JVM. Components with the same id in different scenarios (e.g. {@code Sample.Service}) are told apart by
 * their declaring files, which the analyzer emits as absolute paths.
 */
final class CodeIssuesFixtures {

    /** System property that reports the .NET analyzer as absent (scenarios are skipped). */
    static final String ANALYZER_PROPERTY = "legacybdd.analyzer";

    private static final String CS_PROJECT_TYPE = "{9A19103F-16F7-4668-BE54-9A1E7A4F7556}";
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Duration TIMEOUT = Duration.ofMinutes(5);

    /** Scenario-specific sources that are not doc strings of the feature files. */
    static final String TS024_PROGRAM = "return;\n";
    static final String TS025_UNPARSEABLE = String.join("\n",
            "namespace LegacyBdd.Ts025 {",
            "    public class Broken {",
            "        public void Run( { int x = ; ",
            "    }",
            "");
    static final String TS025_VALID = String.join("\n",
            "namespace LegacyBdd.Ts025 {",
            "    public class Valid {",
            "        public void DoWork() {",
            "            try { System.Console.WriteLine(\"work\"); }",
            "            catch (System.Exception e) { }",
            "        }",
            "    }",
            "}",
            "");
    static final String TS025_UNPARSEABLE_FILE = "Ts025Unparseable.cs";
    static final String TS025_VALID_ID = "LegacyBdd.Ts025.Valid";
    static final String TS022_SOURCE = String.join("\n",
            "namespace LegacyBdd.Ts022 {",
            "    public class Known {",
            "        public string Describe(int x, string a, string b) {",
            "            System.Console.WriteLine(\"start\");",
            "            var password = \"p4ssw0rd!\";",
            "            try { System.Console.Write(password); }",
            "            catch (System.Exception e) { }",
            "            switch (x) { case 1: return \"one\"; }",
            "            return ReferenceEquals(a, b) ? \"same\" : \"other\";",
            "        }",
            "    }",
            "}",
            "");
    /** Probe class added to the empty / comments-only file projects: proves the project was really analyzed. */
    static final String PROBE_ID_PREFIX = "LegacyBdd.Probe.";

    private static Map<String, String> docStrings;
    private static Batch batch;

    private CodeIssuesFixtures() {
    }

    /** Result of one analyzer process. */
    record Run(int exitCode, String stdout, String stderr, JsonNode graph, Duration elapsed) {
    }

    /** The analyzed solution with one project per scenario. */
    record Batch(Path root, Run run) {
        Path project(String tsId) {
            return root.resolve(dirName(tsId));
        }
    }

    /** Skips the scenario (requires-dotnet) when the analyzer is reported absent or cannot be located. */
    static void requireAnalyzer() {
        if ("absent".equals(System.getProperty(ANALYZER_PROPERTY))) {
            Assumptions.abort("requires-dotnet: .NET analyzer reported absent (legacybdd.analyzer=absent)");
        }
        ToolAvailability.requireDotnetAnalyzer();
    }

    /** The {@code dotnet-analyzer} executable, located exactly as the engine does. */
    static Path analyzer() {
        return new DotNetToolLocator(ProductLayout.get().engineRoot().resolve("target")).locate();
    }

    static Path workRoot() {
        return ProductLayout.get().engineRoot().resolve("target").resolve("legacybdd").resolve("codeissues");
    }

    static String dirName(String tsId) {
        return tsId.toLowerCase().replace("-", "");
    }

    /** Doc strings of the 003 scenarios keyed by their {@code @TS-NNN} tag (Gherkin indentation removed). */
    static synchronized Map<String, String> docStrings() {
        if (docStrings == null) {
            Path features = ProductLayout.get().productRoot()
                    .resolve("specs").resolve("003-dotnet-code-issues").resolve("tests").resolve("features");
            Map<String, String> result = new TreeMap<>();
            try (Stream<Path> files = Files.list(features)) {
                for (Path feature : files.filter(p -> p.toString().endsWith(".feature")).sorted().toList()) {
                    parseDocStrings(Files.readAllLines(feature, StandardCharsets.UTF_8), result);
                }
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
            docStrings = result;
        }
        return docStrings;
    }

    private static void parseDocStrings(List<String> lines, Map<String, String> into) {
        String current = null;
        int indent = -1;
        List<String> body = null;
        for (String line : lines) {
            String trimmed = line.trim();
            if (body != null) {
                if (trimmed.equals("\"\"\"")) {
                    into.put(current, String.join("\n", body));
                    body = null;
                } else {
                    body.add(line.substring(Math.min(indent, leading(line))));
                }
                continue;
            }
            if (trimmed.startsWith("@")) {
                for (String tag : trimmed.split("\\s+")) {
                    if (tag.matches("@TS-\\d+")) {
                        current = tag.substring(1);
                    }
                }
            } else if (trimmed.equals("\"\"\"") && current != null) {
                indent = leading(line);
                body = new ArrayList<>();
            }
        }
    }

    private static int leading(String line) {
        int i = 0;
        while (i < line.length() && line.charAt(i) == ' ') {
            i++;
        }
        return i;
    }

    /** Generates the solution (one project per scenario) and analyzes it once per JVM. */
    static synchronized Batch batch() {
        if (batch == null) {
            Path root = workRoot().resolve("batch");
            deleteRecursively(root);
            Map<String, Map<String, String>> projects = new LinkedHashMap<>();
            for (Map.Entry<String, String> e : docStrings().entrySet()) {
                Map<String, String> sources = new LinkedHashMap<>();
                String cls = "Ts" + e.getKey().substring(3);
                sources.put(cls + ".cs", e.getValue().isEmpty() ? "" : e.getValue() + "\n");
                if (e.getKey().equals("TS-026") || e.getKey().equals("TS-027")) {
                    sources.put("Probe.cs", "namespace LegacyBdd.Probe { public class " + cls + "Loaded { } }\n");
                }
                projects.put(e.getKey(), sources);
            }
            projects.put("TS-024", Map.of("Program.cs", TS024_PROGRAM));
            Map<String, String> ts025 = new LinkedHashMap<>();
            ts025.put(TS025_UNPARSEABLE_FILE, TS025_UNPARSEABLE);
            ts025.put("Ts025Valid.cs", TS025_VALID);
            projects.put("TS-025", ts025);

            StringBuilder sln = new StringBuilder()
                    .append("Microsoft Visual Studio Solution File, Format Version 12.00\n")
                    .append("# Visual Studio Version 17\n")
                    .append("VisualStudioVersion = 17.0.31903.59\n")
                    .append("MinimumVisualStudioVersion = 10.0.40219.1\n");
            int index = 0;
            for (Map.Entry<String, Map<String, String>> p : new TreeMap<>(projects).entrySet()) {
                String name = dirName(p.getKey());
                writeProject(root.resolve(name), name, p.getValue(), p.getKey().equals("TS-024"));
                sln.append("Project(\"").append(CS_PROJECT_TYPE).append("\") = \"").append(name).append("\", \"")
                        .append(name).append('\\').append(name).append(".csproj\", \"")
                        .append(String.format("{00000003-0000-0000-0000-%012X}", ++index)).append("\"\n")
                        .append("EndProject\n");
            }
            sln.append("Global\nEndGlobal\n");
            write(root.resolve("LegacyBdd003.sln"), sln.toString());
            batch = new Batch(root, analyze(root));
        }
        return batch;
    }

    /** Generates a standalone single-project directory (outside the batch solution). */
    static Path standaloneProject(String name, Map<String, String> sources) {
        Path dir = workRoot().resolve(name);
        deleteRecursively(dir);
        writeProject(dir, name, sources, false);
        return dir;
    }

    /** Copies the {@code dotnet-ecommerce} demo project (SC-001 reference project) into a scratch directory. */
    static Path ecommerceCopy() {
        Path parent = workRoot().resolve("ts020");
        deleteRecursively(parent);
        return DemoProjects.copy("dotnet-ecommerce", parent);
    }

    private static void writeProject(Path dir, String name, Map<String, String> sources, boolean exe) {
        write(dir.resolve(name + ".csproj"), String.join("\n",
                "<Project Sdk=\"Microsoft.NET.Sdk\">",
                "  <PropertyGroup>",
                "    <TargetFramework>net8.0</TargetFramework>",
                "    <ImplicitUsings>enable</ImplicitUsings>",
                exe ? "    <OutputType>Exe</OutputType>" : "    <OutputType>Library</OutputType>",
                "  </PropertyGroup>",
                "</Project>",
                ""));
        sources.forEach((file, text) -> write(dir.resolve(file), text));
    }

    /** Runs the analyzer on {@code target} (stdin closed: no manual intervention possible). */
    static Run analyze(Path target) {
        long start = System.nanoTime();
        try {
            Process process = new ProcessBuilder(List.of(analyzer().toString(), target.toString())).start();
            process.getOutputStream().close();
            CompletableFuture<String> out = drain(process.getInputStream());
            CompletableFuture<String> err = drain(process.getErrorStream());
            if (!process.waitFor(TIMEOUT.toMillis(), TimeUnit.MILLISECONDS)) {
                process.descendants().forEach(ProcessHandle::destroyForcibly);
                process.destroyForcibly();
                throw new AssertionError("dotnet-analyzer did not finish within " + TIMEOUT + " on " + target);
            }
            String stdout = out.join();
            String stderr = err.join();
            JsonNode graph = null;
            if (process.exitValue() == 0) {
                try {
                    graph = MAPPER.readTree(stdout);
                } catch (IOException e) {
                    throw new AssertionError("dotnet-analyzer stdout is not JSON: " + e.getMessage()
                            + "\nstderr: " + stderr, e);
                }
            }
            return new Run(process.exitValue(), stdout, stderr, graph, Duration.ofNanos(System.nanoTime() - start));
        } catch (IOException e) {
            throw new UncheckedIOException("cannot run dotnet-analyzer on " + target, e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
    }

    private static CompletableFuture<String> drain(InputStream in) {
        return CompletableFuture.supplyAsync(() -> {
            try (in; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                in.transferTo(out);
                return out.toString(StandardCharsets.UTF_8);
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
        });
    }

    private static void write(Path file, String text) {
        try {
            Files.createDirectories(file.getParent());
            Files.writeString(file, text, StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static void deleteRecursively(Path dir) {
        if (!Files.exists(dir)) {
            return;
        }
        try (Stream<Path> paths = Files.walk(dir)) {
            for (Path p : paths.sorted(Comparator.reverseOrder()).toList()) {
                Files.delete(p);
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
