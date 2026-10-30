package com.extractor.legacybdd.dotnet;

import com.extractor.analyzer.DotNetBridgeAnalyzer;
import com.extractor.analyzer.DotNetToolLocator;
import com.extractor.inference.Cluster;
import com.extractor.inference.MicroserviceNameGenerator;
import com.extractor.inference.config.InferenceConfig;
import com.extractor.model.DependencyGraph;
import com.extractor.schema.DemoOutputs;
import com.extractor.testsupport.ProductLayout;
import com.fasterxml.jackson.databind.JsonNode;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.snakeyaml.engine.v2.api.Load;
import org.snakeyaml.engine.v2.api.LoadSettings;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.stream.Stream;
import java.util.concurrent.TimeoutException;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Steps of the bugfix feature files {@code bugfix_BUG-001..006.feature} and {@code bugfix_BUG-008.feature}. */
public class BugfixSteps {

    /** Size of the diagnostics written before the result: four times the usual 64 KiB pipe buffer. */
    private static final int DIAGNOSTIC_BYTES = 256 * 1024;
    private static final Duration SHORT_TIMEOUT = Duration.ofSeconds(2);
    private static final Duration TIMEOUT_GRACE = Duration.ofSeconds(5);
    private static final int NAME_PROCESSES = 5;
    private static final Pattern WALL_CLOCK = Pattern.compile("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}");

    // ---------------------------------------------------------------- BUG-001

    @Given("a project that has already been analyzed once")
    public void aProjectThatHasAlreadyBeenAnalyzedOnce() {
        Path project = LegacyDotnet.demo("java-standar");
        LegacyWorld.project = project;
        LegacyWorld.data.put("firstGraph", cliGraph(project, Map.of(), "first"));
    }

    @When("the same project is analyzed again without changes")
    public void theSameProjectIsAnalyzedAgain() {
        LegacyWorld.data.put("secondGraph", cliGraph(LegacyWorld.project, Map.of(), "second"));
    }

    @Then("the dependency graph output is byte-identical to the first run")
    public void theGraphIsByteIdentical() throws IOException {
        Path first = LegacyWorld.get("firstGraph");
        Path second = LegacyWorld.get("secondGraph");
        assertEquals(-1L, Files.mismatch(first, second), "first byte that differs between " + first + " and "
                + second);
    }

    @Then("the output contains no wall-clock timestamp unless the user explicitly opts in")
    public void theOutputContainsNoWallClockTimestamp() {
        String graph = LegacyDotnet.read(LegacyWorld.get("secondGraph"));
        JsonNode meta = LegacyDotnet.json(graph).path("meta");
        assertTrue(meta.isObject(), "meta missing");
        assertFalse(LegacyDotnet.json(graph).findParents("collected_at").size() > 0,
                "collected_at present without opt-in: " + meta);
        assertFalse(WALL_CLOCK.matcher(meta.toString()).find(), "timestamp in meta without opt-in: " + meta);

        Instant before = Instant.now().minusSeconds(1);
        Path optedIn = cliGraph(LegacyWorld.project,
                Map.of(DependencyGraph.Meta.COLLECTED_AT_OPT_IN, "true"), "opt-in");
        Instant after = Instant.now().plusSeconds(1);
        JsonNode collectedAt = LegacyDotnet.json(LegacyDotnet.read(optedIn)).path("meta").path("collected_at");
        assertTrue(collectedAt.isTextual(), "collected_at must be emitted on explicit opt-in: " + collectedAt);
        Instant stamp = Instant.parse(collectedAt.asText());
        assertTrue(!stamp.isBefore(before) && !stamp.isAfter(after), "collected_at " + stamp
                + " is not the wall-clock time of the run");
    }

    private static Path cliGraph(Path project, Map<String, String> env, String label) {
        Path out = LegacyDotnet.scratch("bug001-" + label);
        Path graph = out.resolve(DemoOutputs.GRAPH);
        LegacyDotnet.ChildRun run = LegacyDotnet.cli(out, env, List.of(project.toString(), graph.toString()));
        assertEquals(0, run.exitCode(), "CLI run " + label + " failed:\n" + LegacyDotnet.abbreviate(run.stderr()));
        assertTrue(Files.isRegularFile(graph), "CLI run " + label + " wrote no " + graph);
        return graph;
    }

    // ---------------------------------------------------------------- BUG-002

    @Given("a .NET analyzer that writes more diagnostics than the OS pipe buffer before its result")
    public void aVerboseDotNetAnalyzer() {
        Path bin = LegacyDotnet.scratch("bug002-verbose");
        String graph = "{\"components\":[{\"id\":\"Verbose.Orders.OrderService\",\"files\":[\"OrderService.cs\"],"
                + "\"loc\":12,\"layer\":\"Negocio\"}],\"edges\":[],"
                + "\"meta\":{\"source\":\"roslyn\",\"schema_version\":\"1.0.0\"}}";
        LegacyDotnet.write(bin.resolve("graph.json"), graph);
        script(bin, "#!/usr/bin/env bash\n"
                + "head -c " + DIAGNOSTIC_BYTES + " /dev/zero | tr '\\0' 'd' >&2\n"
                + "printf '\\n' >&2\n"
                + "cat \"$(dirname \"$0\")/graph.json\"\n");
        LegacyWorld.data.put("analyzerDir", bin);
        LegacyWorld.data.put("expectedComponent", "Verbose.Orders.OrderService");
    }

    @Given("a .NET analyzer that does not terminate")
    public void aDotNetAnalyzerThatDoesNotTerminate() {
        Path bin = LegacyDotnet.scratch("bug002-hang");
        script(bin, "#!/usr/bin/env bash\n"
                + "echo $$ > \"$(dirname \"$0\")/pid\"\n"
                + "while true; do sleep 1; done\n");
        LegacyWorld.data.put("analyzerDir", bin);
    }

    @When("the .NET project is analyzed")
    public void theDotNetProjectIsAnalyzed() {
        analyzeWithBridge(Duration.ofSeconds(60));
    }

    @When("the .NET project is analyzed with a short timeout")
    public void theDotNetProjectIsAnalyzedWithAShortTimeout() {
        analyzeWithBridge(SHORT_TIMEOUT);
    }

    @Then("the analysis completes and returns the dependency graph")
    public void theAnalysisCompletesAndReturnsTheGraph() {
        assertNull(LegacyWorld.error, "bridge failed: " + LegacyWorld.error);
        DependencyGraph graph = LegacyWorld.get("bridgeGraph");
        assertEquals(1, graph.getComponents().size(), "components returned by the bridge");
        assertEquals(LegacyWorld.<String>get("expectedComponent"), graph.getComponents().get(0).getId());
    }

    @Then("the analysis fails with a timeout error within that timeout")
    public void theAnalysisFailsWithATimeoutError() throws Exception {
        assertTrue(LegacyWorld.error != null, "the bridge returned instead of timing out");
        assertTrue(String.valueOf(LegacyWorld.error.getMessage()).contains("timed out"),
                "timeout error expected: " + LegacyWorld.error);
        assertTrue(LegacyWorld.elapsed.compareTo(SHORT_TIMEOUT.plus(TIMEOUT_GRACE)) < 0,
                "the bridge gave up after " + LegacyWorld.elapsed + " (timeout " + SHORT_TIMEOUT + ")");
        Path pidFile = LegacyWorld.<Path>get("analyzerDir").resolve("pid");
        assertTrue(Files.isRegularFile(pidFile), "the fake analyzer never started");
        long pid = Long.parseLong(Files.readString(pidFile).trim());
        Optional<ProcessHandle> handle = ProcessHandle.of(pid);
        if (handle.isPresent()) {
            handle.get().onExit().get(5, TimeUnit.SECONDS);
        }
        assertFalse(ProcessHandle.of(pid).map(ProcessHandle::isAlive).orElse(false),
                "the timed-out analyzer process " + pid + " is still running");
    }

    private static void analyzeWithBridge(Duration timeout) {
        Path bin = LegacyWorld.get("analyzerDir");
        Path project = LegacyDotnet.scratch("bug002-project");
        LegacyDotnet.write(project.resolve("App.csproj"), "<Project Sdk=\"Microsoft.NET.Sdk\" />\n");
        DotNetBridgeAnalyzer bridge = new DotNetBridgeAnalyzer(new DotNetToolLocator(bin, false), timeout);
        long start = System.nanoTime();
        CompletableFuture<DependencyGraph> future = CompletableFuture.supplyAsync(() -> {
            try {
                return bridge.analyzeProject(project);
            } catch (Exception e) {
                throw new IllegalStateException(e.getMessage(), e);
            }
        });
        try {
            // Guard well above the bridge timeout: a hang fails the scenario instead of blocking the suite.
            LegacyWorld.data.put("bridgeGraph", future.get(timeout.toSeconds() + 60, TimeUnit.SECONDS));
        } catch (ExecutionException e) {
            Throwable cause = e.getCause();
            LegacyWorld.error = cause instanceof IllegalStateException && cause.getCause() != null
                    ? cause.getCause() : cause;
        } catch (TimeoutException e) {
            throw new AssertionError("the bridge hung: no result after " + (timeout.toSeconds() + 60) + " s", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
        LegacyWorld.elapsed = Duration.ofNanos(System.nanoTime() - start);
    }

    // ---------------------------------------------------------------- BUG-008

    /** {@code var x = Directory.GetFiles(...)} followed, within the next 300 characters, by an ordinal sort. */
    private static final Pattern DOTNET_ENUMERATION = Pattern.compile(
            "var\\s+(\\w+)\\s*=\\s*Directory\\.GetFiles\\([^;]*\\);");

    @Given("two directories with the same loose C# sources created in opposite order and no project file")
    public void twoDirectoriesWithTheSameLooseSources() {
        LegacyDotnet.requireAnalyzer();
        Map<String, String> sources = new LinkedHashMap<>();
        sources.put("Alpha.cs", "namespace Loose { public class Alpha { public void Run() { new Beta().Go(); } } }\n");
        sources.put("Beta.cs", "namespace Loose { public class Beta { public void Go() { new Gamma().Do(); } } }\n");
        sources.put("Gamma.cs", "namespace Loose { public class Gamma { public void Do() { } } }\n");
        Path forward = LegacyDotnet.scratch("bug008-forward");
        Path backward = LegacyDotnet.scratch("bug008-backward");
        List<String> names = new ArrayList<>(sources.keySet());
        for (String name : names) {
            LegacyDotnet.write(forward.resolve(name), sources.get(name));
        }
        Collections.reverse(names);
        for (String name : names) {
            LegacyDotnet.write(backward.resolve(name), sources.get(name));
        }
        LegacyWorld.data.put("forward", forward);
        LegacyWorld.data.put("backward", backward);
    }

    @When("both directories are analyzed with the .NET analyzer")
    public void bothDirectoriesAreAnalyzed() {
        for (String key : List.of("forward", "backward")) {
            Path dir = LegacyWorld.get(key);
            LegacyDotnet.RawRun run = LegacyDotnet.raw(dir);
            assertEquals(0, run.exitCode(), key + " analysis failed:\n" + LegacyDotnet.abbreviate(run.stderr()));
            LegacyWorld.data.put(key + "Json", run.stdout().replace(dir.toString(), "<ROOT>"));
        }
    }

    @Then("both dependency graphs are identical once the directory path is replaced")
    public void bothGraphsAreIdentical() {
        String forward = LegacyWorld.get("forwardJson");
        String backward = LegacyWorld.get("backwardJson");
        assertTrue(forward.contains("Loose.Alpha"), "the loose sources were not analyzed:\n" + forward);
        assertEquals(forward, backward, "the two enumeration orders produced different graphs");
    }

    @Then("every file enumeration of the engine that feeds the analysis is sorted before use")
    public void everyEnumerationIsSorted() throws IOException {
        List<String> unsorted = new ArrayList<>();
        Path javaRoot = LegacyDotnet.engineRoot().resolve("src/main/java");
        try (Stream<Path> walk = Files.walk(javaRoot)) {
            for (Path file : walk.filter(p -> p.toString().endsWith(".java")).sorted().toList()) {
                String text = Files.readString(file);
                int from = 0;
                while ((from = text.indexOf("Files.walk(", from)) >= 0) {
                    int end = text.indexOf(';', from);
                    String statement = text.substring(from, end < 0 ? text.length() : end);
                    if (!statement.contains(".sorted(")) {
                        unsorted.add(javaRoot.relativize(file) + ": " + statement.lines().findFirst().orElse(""));
                    }
                    from += "Files.walk(".length();
                }
            }
        }
        Path dotnetRoot = LegacyDotnet.engineRoot().resolve("src/main/dotnet/DotNetAnalyzer/Analysis");
        try (Stream<Path> walk = Files.walk(dotnetRoot)) {
            for (Path file : walk.filter(p -> p.toString().endsWith(".cs")).sorted().toList()) {
                String text = Files.readString(file);
                Matcher matcher = DOTNET_ENUMERATION.matcher(text);
                while (matcher.find()) {
                    String variable = matcher.group(1);
                    String following = text.substring(matcher.end(), Math.min(text.length(), matcher.end() + 300));
                    if (!following.contains("Array.Sort(" + variable + ", StringComparer.Ordinal)")) {
                        unsorted.add(dotnetRoot.relativize(file) + ": " + matcher.group());
                    }
                }
            }
        }
        assertTrue(unsorted.isEmpty(), "file enumerations used without an ordinal sort:\n" + String.join("\n", unsorted));
    }

    private static void script(Path dir, String content) {
        Path exe = dir.resolve("dotnet-analyzer");
        LegacyDotnet.write(exe, content);
        try {
            Files.setPosixFilePermissions(exe, PosixFilePermissions.fromString("rwxr-xr-x"));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    // ---------------------------------------------------------------- BUG-003 / BUG-006

    @Given("the platform is Windows")
    public void thePlatformIsWindows() {
        LegacyWorld.data.put("windows", true);
    }

    @Given("the analyzer executable with the Windows extension sits next to the tool")
    public void theWindowsExecutableSitsNextToTheTool() {
        Path toolDir = LegacyDotnet.scratch("bug003-tool");
        LegacyDotnet.write(toolDir.resolve("dotnet-analyzer.exe"), "MZ placeholder\n");
        LegacyWorld.data.put("toolDir", toolDir);
    }

    @Given("the analyzer location variable is set in the developer environment")
    public void theAnalyzerLocationVariableIsSet() {
        Path developerDir = LegacyDotnet.scratch("bug006-developer");
        script(developerDir, "#!/usr/bin/env bash\necho developer analyzer\n");
        LegacyWorld.data.put("developerDir", developerDir);
    }

    @Given("the locator is given an empty environment and an empty search path")
    public void theLocatorIsGivenAnEmptyEnvironment() {
        LegacyWorld.data.put("toolDir", LegacyDotnet.scratch("bug006-empty"));
        LegacyWorld.data.put("hermetic", true);
    }

    @When("the analyzer is located")
    public void theAnalyzerIsLocated() {
        Path toolDir = LegacyWorld.get("toolDir");
        if (Boolean.TRUE.equals(LegacyWorld.data.get("hermetic"))) {
            Path developerDir = LegacyWorld.get("developerDir");
            LegacyDotnet.ChildRun run = LegacyDotnet.java(LegacyDotnet.scratch("bug006-work"),
                    Map.of("DOTNET_ANALYZER_PATH", developerDir.toString(),
                            "PATH", developerDir + java.io.File.pathSeparator + System.getenv("PATH")),
                    ProbeMain.class.getName(), List.of("locate-hermetic", toolDir.toString()));
            assertEquals(0, run.exitCode(), "probe failed:\n" + run.stderr());
            LegacyWorld.data.put("probe", run.stdout());
            return;
        }
        boolean windows = Boolean.TRUE.equals(LegacyWorld.data.get("windows"));
        try {
            LegacyWorld.data.put("located", new DotNetToolLocator(toolDir, windows).locate());
        } catch (IllegalStateException e) {
            LegacyWorld.error = e;
        }
    }

    @Then("the Windows executable is returned")
    public void theWindowsExecutableIsReturned() {
        assertNull(LegacyWorld.error, "lookup failed: " + LegacyWorld.error);
        Path expected = LegacyWorld.<Path>get("toolDir").resolve("dotnet-analyzer.exe").toAbsolutePath();
        assertEquals(expected, LegacyWorld.get("located"));
    }

    @Then("the lookup fails with installation instructions")
    public void theLookupFailsWithInstallationInstructions() {
        String probe = LegacyWorld.get("probe");
        String hermetic = line(probe, "HERMETIC ");
        String control = line(probe, "CONTROL ");
        Path developerDir = LegacyWorld.get("developerDir");
        assertTrue(control.startsWith("FOUND ") && control.contains(developerDir.getFileName().toString()),
                "the developer environment must point at an analyzer (control lookup): " + control);
        assertTrue(hermetic.startsWith("NOTFOUND "), "hermetic lookup must fail: " + hermetic);
        assertTrue(hermetic.contains("Could not find 'dotnet-analyzer' executable"), hermetic);
        assertTrue(hermetic.contains("Installation:") && hermetic.contains("DOTNET_ANALYZER_PATH"),
                "installation instructions expected: " + hermetic);
    }

    private static String line(String output, String prefix) {
        return output.lines().filter(l -> l.startsWith(prefix)).map(l -> l.substring(prefix.length()))
                .findFirst().orElseThrow(() -> new AssertionError("no " + prefix + "line in:\n" + output));
    }

    // ---------------------------------------------------------------- BUG-004

    @Given("a cluster whose only member is named with two role keywords such as {string}")
    public void aClusterWithTwoRoleKeywords(String simpleName) {
        List<String> roles = InferenceConfig.defaults().naming().roleKeywords();
        String lower = simpleName.toLowerCase();
        List<String> matching = new ArrayList<>();
        for (String role : roles) {
            if (lower.contains(role)) {
                matching.add(role);
            }
        }
        assertTrue(matching.size() >= 2, simpleName + " must contain two role keywords of " + roles);
        String member = "com.shop.sales." + simpleName;
        Cluster cluster = new Cluster(1);
        cluster.setMembers(List.of(member));
        LegacyWorld.data.put("member", member);
        LegacyWorld.data.put("cluster", cluster);
        LegacyWorld.data.put("matchingRoles", matching);
        LegacyWorld.data.put("simpleName", lower);
    }

    @When("the proposal name is generated")
    public void theProposalNameIsGenerated() {
        Cluster cluster = LegacyWorld.get("cluster");
        LegacyWorld.data.put("name", MicroserviceNameGenerator.generateName(Set.of(1), List.of(cluster)));
    }

    @Then("the role keyword declared first in the fixed precedence list is used")
    public void theFirstDeclaredRoleKeywordIsUsed() {
        List<String> matching = LegacyWorld.get("matchingRoles");
        String lower = LegacyWorld.get("simpleName");
        String name = LegacyWorld.get("name");
        String chosen = capitalize(lower.substring(0, lower.indexOf(matching.get(0))));
        assertTrue(Pattern.compile("\\b" + chosen + "\\b").matcher(name).find(),
                "name must use the token before '" + matching.get(0) + "' (" + chosen + "): " + name);
        for (String other : matching.subList(1, matching.size())) {
            String token = capitalize(lower.substring(0, lower.indexOf(other)));
            if (!token.equals(chosen)) {
                assertFalse(Pattern.compile("\\b" + token + "\\b").matcher(name).find(),
                        "name must not use the token before the later keyword '" + other + "' (" + token + "): "
                                + name);
            }
        }
    }

    @Then("the generated name is the same in every process")
    public void theGeneratedNameIsTheSameInEveryProcess() {
        String expected = LegacyWorld.get("name");
        String member = LegacyWorld.get("member");
        for (int i = 0; i < NAME_PROCESSES; i++) {
            LegacyDotnet.ChildRun run = LegacyDotnet.java(LegacyDotnet.scratch("bug004"), Map.of(),
                    ProbeMain.class.getName(), List.of("name", member));
            assertEquals(0, run.exitCode(), "probe failed:\n" + run.stderr());
            assertEquals(expected, run.stdout().strip(), "name generated in process " + (i + 1));
        }
    }

    private static String capitalize(String token) {
        return token.isEmpty() ? token : Character.toUpperCase(token.charAt(0)) + token.substring(1);
    }

    // ---------------------------------------------------------------- BUG-005

    @Given("the release pipeline definition")
    public void theReleasePipelineDefinition() {
        Path workflow = ProductLayout.get().ciWorkflow();
        Object loaded = new Load(LoadSettings.builder().build()).loadFromString(LegacyDotnet.read(workflow));
        Map<?, ?> jobs = (Map<?, ?>) ((Map<?, ?>) loaded).get("jobs");
        assertTrue(jobs != null && jobs.get("release") instanceof Map, "no release job in " + workflow);
        List<?> steps = (List<?>) ((Map<?, ?>) jobs.get("release")).get("steps");
        assertTrue(steps != null && !steps.isEmpty(), "release job has no steps");
        LegacyWorld.data.put("releaseSteps", steps);
    }

    @When("the .NET analyzer is published for a release")
    public void theDotNetAnalyzerIsPublishedForARelease() {
        List<?> steps = LegacyWorld.get("releaseSteps");
        List<String> publishCommands = new ArrayList<>();
        StringBuilder notes = new StringBuilder();
        for (Object step : steps) {
            Object run = ((Map<?, ?>) step).get("run");
            if (!(run instanceof String script)) {
                continue;
            }
            String joined = script.replace("\\\n", " ");
            for (String line : joined.split("\n")) {
                if (line.contains("dotnet publish") && line.contains("DotNetAnalyzer")) {
                    publishCommands.add(line.trim().replaceAll("\\s+", " "));
                }
            }
            if (script.contains("README")) {
                notes.append(script).append('\n');
            }
        }
        assertFalse(publishCommands.isEmpty(), "the release job does not publish the .NET analyzer");
        LegacyWorld.data.put("publishCommands", publishCommands);
        LegacyWorld.data.put("releaseNotes", notes.toString());
    }

    @Then("it is published as a framework-dependent application, not as a single-file bundle")
    public void itIsPublishedFrameworkDependent() {
        List<String> commands = LegacyWorld.get("publishCommands");
        for (String command : commands) {
            assertTrue(command.contains("--self-contained false"), "framework-dependent publish expected: "
                    + command);
            assertFalse(command.contains("PublishSingleFile=true"), "single-file bundle: " + command);
            assertFalse(command.contains("--self-contained true"), "self-contained publish: " + command);
        }
    }

    @Then("the release notes state the .NET runtime requirement")
    public void theReleaseNotesStateTheRuntimeRequirement() {
        String notes = LegacyWorld.get("releaseNotes");
        assertFalse(notes.isEmpty(), "the release job writes no release notes (README)");
        assertTrue(Pattern.compile("\\.NET \\d+ runtime").matcher(notes).find(),
                "release notes must state the .NET runtime requirement:\n" + LegacyDotnet.abbreviate(notes));
        assertFalse(notes.contains("runtime is bundled inside the binary"), "obsolete self-contained note");
    }
}
