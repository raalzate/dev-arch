package com.extractor.legacybdd.codeissues;

import com.fasterxml.jackson.databind.JsonNode;
import io.cucumber.java.Before;
import io.cucumber.java.Scenario;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Step definitions of 003-dotnet-code-issues. Every scenario runs the real {@code dotnet-analyzer} (which hosts
 * {@code ProjectAnalyzer}, {@code TypeAnalyzer} and {@code RoslynCodeAnalyzer}) and inspects its JSON output.
 * <p>
 * Field names: since 005-json-schema-contract (research E3, contract 1.0.0) a {@code code_issue} is serialized as
 * {@code {type, severity, message, line, pattern}}; the C# {@code CodeIssue.Rule} property (the "rule" of these
 * scenarios) is emitted as {@code pattern}. {@code location} is no longer serialized.
 */
public class CodeIssuesSteps {

    /** Scenario wording → serialized JSON field (005 research E3). */
    private static final Map<String, String> SERIALIZED_AS = Map.of("rule", "pattern");
    private static final Pattern QUOTED = Pattern.compile("\"([^\"]*)\"");

    private String tsId;
    private Path analyzerExe;
    private Path project;
    private CodeIssuesFixtures.Run run;
    private String componentId;
    private List<JsonNode> issues = new ArrayList<>();
    private final List<CodeIssuesFixtures.Run> runs = new ArrayList<>();

    @Before
    public void captureScenario(Scenario scenario) {
        tsId = scenario.getSourceTagNames().stream()
                .filter(t -> t.matches("@TS-\\d+")).map(t -> t.substring(1)).findFirst().orElse(null);
    }

    // ─── Background ──────────────────────────────────────────────────────────────

    @Given("a RoslynCodeAnalyzer instance")
    public void aRoslynCodeAnalyzerInstance() {
        CodeIssuesFixtures.requireAnalyzer();
        analyzerExe = CodeIssuesFixtures.analyzer();
    }

    @Given("a TypeAnalyzer instance")
    public void aTypeAnalyzerInstance() {
        assertNotNull(analyzerExe, "dotnet-analyzer not located");
        assertTrue(Files.isRegularFile(analyzerExe) && Files.isExecutable(analyzerExe),
                "dotnet-analyzer is not an executable file: " + analyzerExe);
    }

    // ─── Given: fixtures ─────────────────────────────────────────────────────────

    @Given("^a (?:C# class|C# source file|\\.NET project with a clean C# class)(?: .*)?$")
    public void aCSharpSource(String docString) {
        assertNotNull(tsId, "scenario without @TS tag");
        String batched = CodeIssuesFixtures.docStrings().get(tsId);
        assertEquals(batched, docString, "doc string of " + tsId + " differs from the batched fixture");
        project = CodeIssuesFixtures.batch().project(tsId);
        String file = "Ts" + tsId.substring(3) + ".cs";
        assertEquals(docString.isEmpty() ? "" : docString + "\n", read(project.resolve(file)),
                "fixture source not written for " + tsId);
    }

    @Given("a component that references no source files")
    public void aComponentThatReferencesNoSourceFiles() {
        // A top-level-statements file: the compiler synthesizes the 'Program' type, no source file declares it.
        project = CodeIssuesFixtures.batch().project(tsId);
        assertEquals(CodeIssuesFixtures.TS024_PROGRAM, read(project.resolve("Program.cs")));
        componentId = "Program";
    }

    @Given("a .NET project containing one unparseable C# file and one valid C# file with violations")
    public void aProjectWithAnUnparseableFile() {
        project = CodeIssuesFixtures.batch().project(tsId);
        assertEquals(CodeIssuesFixtures.TS025_UNPARSEABLE,
                read(project.resolve(CodeIssuesFixtures.TS025_UNPARSEABLE_FILE)));
        componentId = CodeIssuesFixtures.TS025_VALID_ID;
    }

    @Given("a .NET project directory with C# files containing bug patterns")
    public void aProjectDirectoryWithBugPatterns() {
        project = CodeIssuesFixtures.ecommerceCopy();
        assertTrue(Files.isRegularFile(project.resolve("ECommerceApp.sln")), "dotnet-ecommerce copy incomplete");
    }

    @Given("a C# project with known bug patterns")
    public void aCSharpProjectWithKnownBugPatterns() {
        project = CodeIssuesFixtures.standaloneProject("ts022", Map.of("Known.cs", CodeIssuesFixtures.TS022_SOURCE));
    }

    // ─── When ────────────────────────────────────────────────────────────────────

    @When("the analyzer runs on the compiled project")
    public void theAnalyzerRuns() {
        assertNotNull(project, "no fixture project");
        run = CodeIssuesFixtures.batch().run();
        assertEquals(0, run.exitCode(), "dotnet-analyzer failed: " + run.stderr());
    }

    @When("the full project analysis pipeline runs")
    public void theFullPipelineRuns() {
        theAnalyzerRuns();
    }

    @When("the full project analysis pipeline runs via ProjectAnalyzer")
    public void theFullPipelineRunsViaProjectAnalyzer() {
        run = CodeIssuesFixtures.analyze(project);
        assertEquals(0, run.exitCode(), "dotnet-analyzer failed: " + run.stderr());
    }

    @When("the full project analysis pipeline runs three times on the same input")
    public void theFullPipelineRunsThreeTimes() {
        for (int i = 0; i < 3; i++) {
            CodeIssuesFixtures.Run r = CodeIssuesFixtures.analyze(project);
            assertEquals(0, r.exitCode(), "dotnet-analyzer run " + (i + 1) + " failed: " + r.stderr());
            runs.add(r);
        }
    }

    // ─── Then: component-level ───────────────────────────────────────────────────

    @Then("^the component \"([^\"]*)\" has exactly (\\d+) code issues?$")
    public void theComponentHasExactly(String id, int count) {
        theComponentHasCodeIssues(id, count);
    }

    @Then("^the component \"([^\"]*)\" has (\\d+) code issues$")
    public void theComponentHasCodeIssues(String id, int count) {
        JsonNode list = codeIssues(id);
        assertEquals(count, list.size(), "code_issues of " + id + ": " + list);
        issues = elements(list);
    }

    @Then("the component {string} has at least {int} code issue with rule {string}")
    public void theComponentHasAtLeastWithRule(String id, int min, String rule) {
        issues = withRule(codeIssues(id), rule);
        assertTrue(issues.size() >= min,
                "expected >= " + min + " " + rule + " issues in " + id + ", got: " + codeIssues(id));
    }

    @Then("the component {string} has no issues with rule {string}")
    public void theComponentHasNoIssuesWithRule(String id, String rule) {
        JsonNode list = codeIssues(id);
        assertTrue(withRule(list, rule).isEmpty(), "unexpected " + rule + " in " + id + ": " + list);
    }

    @Then("^the component \"([^\"]*)\" has code_issues as an empty list \\(not null\\)$")
    public void theComponentHasEmptyCodeIssuesNotNull(String id) {
        JsonNode list = codeIssues(id);
        assertEquals(0, list.size(), "code_issues of " + id + ": " + list);
    }

    @Then("the component has code_issues as an empty list")
    public void theComponentHasEmptyCodeIssues() {
        theComponentHasEmptyCodeIssuesNotNull(componentId);
    }

    // ─── Then: issue-level ───────────────────────────────────────────────────────

    @Then("the issue has rule {string}")
    public void theIssueHasRule(String rule) {
        assertFalse(issues.isEmpty(), "no issue selected");
        for (JsonNode issue : issues) {
            assertEquals(rule, field(issue, "rule"), "issue " + issue);
        }
    }

    @Then("the issue has severity {string}")
    public void theIssueHasSeverity(String severity) {
        assertFalse(issues.isEmpty(), "no issue selected");
        for (JsonNode issue : issues) {
            assertEquals(severity, field(issue, "severity"), "issue " + issue);
        }
    }

    @Then("the issue has a non-empty message")
    public void theIssueHasANonEmptyMessage() {
        assertFalse(issues.isEmpty(), "no issue selected");
        for (JsonNode issue : issues) {
            String message = field(issue, "message");
            assertTrue(message != null && !message.isBlank(), "issue without message: " + issue);
        }
    }

    @Then("the issue has a location matching pattern {string}")
    public void theIssueHasALocationMatching(String regex) {
        assertFalse(issues.isEmpty(), "no issue selected");
        assertFieldMatches(issues, "location", regex);
    }

    @Then("each code issue in component {string} has a non-null {string} field")
    public void eachCodeIssueHasANonNullField(String id, String name) {
        List<JsonNode> all = nonEmpty(id);
        for (JsonNode issue : all) {
            assertNotNull(field(issue, name), "issue without \"" + name + "\" (serialized as \""
                    + SERIALIZED_AS.getOrDefault(name, name) + "\"): " + issue);
        }
    }

    @Then("each code issue in component {string} has a {string} field matching {string}")
    public void eachCodeIssueHasAFieldMatching(String id, String name, String regex) {
        assertFieldMatches(nonEmpty(id), name, regex);
    }

    @Then("^all code issues in component \"([^\"]*)\" have severity in \\[(.*)\\]$")
    public void allCodeIssuesHaveSeverityIn(String id, String values) {
        Set<String> allowed = quoted(values);
        assertEquals(Set.of("INFO", "WARNING", "ERROR", "CRITICAL"), allowed, "unexpected enum in scenario");
        List<JsonNode> all = nonEmpty(id);
        Set<String> rules = all.stream().map(i -> field(i, "rule")).collect(Collectors.toSet());
        assertTrue(rules.size() >= 3, "expected several patterns in " + id + ": " + all);
        for (JsonNode issue : all) {
            assertTrue(allowed.contains(field(issue, "severity")), "severity outside enum: " + issue);
        }
    }

    @Then("the code issues in component {string} are sorted by location ascending")
    public void theCodeIssuesAreSortedByLocation(String id) {
        List<JsonNode> all = nonEmpty(id);
        assertTrue(all.size() >= 3, "expected several issues in " + id + ": " + all);
        // Single-file component: location (file:line) order is the line order.
        assertEquals(1, component(id).get("files").size(), "component spans several files");
        Set<Integer> lines = new java.util.TreeSet<>();
        int previous = Integer.MIN_VALUE;
        for (JsonNode issue : all) {
            int line = issue.get("line").asInt();
            assertTrue(line >= previous, "issues not in ascending location order: " + all);
            previous = line;
            lines.add(line);
        }
        assertTrue(lines.size() >= 2, "violations expected on different lines: " + all);
    }

    // ─── Then: pipeline / degradation ────────────────────────────────────────────

    @Then("the output dependency graph contains components with non-empty code_issues arrays")
    public void theGraphContainsNonEmptyCodeIssues() {
        JsonNode components = run.graph().get("components");
        assertTrue(components != null && components.size() > 0, "graph without components");
        int withIssues = 0;
        for (JsonNode c : components) {
            JsonNode list = c.get("code_issues");
            assertTrue(list != null && list.isArray(), "component without code_issues array: " + c.get("id"));
            if (list.size() > 0) {
                withIssues++;
            }
        }
        assertTrue(withIssues > 0, "no component of dotnet-ecommerce has code issues");
    }

    @Then("the analysis completes without requiring manual intervention")
    public void theAnalysisCompletesWithoutManualIntervention() {
        // stdin was closed at start-up and the process ended on its own, within the timeout, with exit code 0.
        assertEquals(0, run.exitCode());
        assertEquals("roslyn", run.graph().path("meta").path("source").asText(), "unexpected analysis mode");
    }

    @Then("the analysis completes without throwing an exception")
    public void theAnalysisCompletesWithoutThrowing() {
        assertEquals(0, run.exitCode(), run.stderr());
        assertNoFailureDiagnostics();
        assertFalse(components().isEmpty(), "project of " + tsId + " produced no component: not analyzed");
    }

    @Then("the overall analysis does not throw an unhandled exception")
    public void theOverallAnalysisDoesNotThrow() {
        assertEquals(0, run.exitCode(), run.stderr());
        assertNoFailureDiagnostics();
    }

    @Then("the valid component has its code_issues populated")
    public void theValidComponentHasItsCodeIssuesPopulated() {
        JsonNode list = codeIssues(componentId);
        Set<String> rules = elements(list).stream().map(i -> field(i, "rule")).collect(Collectors.toSet());
        assertTrue(rules.containsAll(Set.of("CONSOLE_LOGGING", "EMPTY_CATCH_BLOCK", "CATCH_GENERIC_EXCEPTION")),
                "valid component issues: " + list);
    }

    @Then("a warning is emitted for the unparseable file")
    public void aWarningIsEmittedForTheUnparseableFile() {
        List<String> warnings = run.stderr().lines()
                .filter(l -> l.startsWith("[WARN]") || l.startsWith("[warning]"))
                .filter(l -> l.contains(CodeIssuesFixtures.TS025_UNPARSEABLE_FILE))
                .toList();
        assertFalse(warnings.isEmpty(), "no warning names " + CodeIssuesFixtures.TS025_UNPARSEABLE_FILE
                + "; analyzer stderr:\n" + run.stderr());
    }

    @Then("no code issues are reported")
    public void noCodeIssuesAreReported() {
        List<JsonNode> components = components();
        assertTrue(components.stream().anyMatch(c -> c.get("id").asText().startsWith(CodeIssuesFixtures.PROBE_ID_PREFIX)),
                "project of " + tsId + " was not analyzed (probe component missing)");
        for (JsonNode c : components) {
            JsonNode list = c.get("code_issues");
            assertTrue(list != null && list.isArray() && list.size() == 0,
                    "code issues reported for " + c.get("id") + ": " + list);
        }
    }

    @Then("the code_issues list is identical in all three runs")
    public void theCodeIssuesListIsIdenticalInAllThreeRuns() {
        Map<String, JsonNode> first = issuesByComponent(runs.get(0));
        assertFalse(first.values().stream().allMatch(l -> l.size() == 0), "no code issues detected: " + first);
        for (int i = 1; i < runs.size(); i++) {
            assertEquals(first, issuesByComponent(runs.get(i)), "run " + (i + 1) + " differs from run 1");
        }
    }

    @Then("the issue order is the same in all three runs")
    public void theIssueOrderIsTheSameInAllThreeRuns() {
        assertEquals(3, runs.size());
        List<String> first = order(runs.get(0));
        assertTrue(first.size() >= 2, "too few issues to compare order: " + first);
        for (int i = 1; i < runs.size(); i++) {
            assertEquals(first, order(runs.get(i)), "issue order of run " + (i + 1) + " differs");
        }
    }

    // ─── helpers ─────────────────────────────────────────────────────────────────

    /** Components of the graph declared in the scenario project (ids repeat across scenario projects). */
    private List<JsonNode> components() {
        assertNotNull(run, "analyzer not run");
        Path root = realPath(project);
        List<JsonNode> result = new ArrayList<>();
        for (JsonNode c : run.graph().get("components")) {
            JsonNode files = c.get("files");
            boolean inProject = files != null && files.size() > 0;
            for (JsonNode f : files == null ? List.<JsonNode>of() : elements(files)) {
                inProject &= realPath(Path.of(f.asText())).startsWith(root);
            }
            if (inProject) {
                result.add(c);
            }
        }
        return result;
    }

    private JsonNode component(String id) {
        List<JsonNode> matches = components().stream().filter(c -> id.equals(c.get("id").asText())).toList();
        assertEquals(1, matches.size(), "component " + id + " in " + project + ": found "
                + components().stream().map(c -> c.get("id").asText()).toList());
        return matches.get(0);
    }

    private JsonNode codeIssues(String id) {
        JsonNode list = component(id).get("code_issues");
        assertTrue(list != null && list.isArray(), "code_issues of " + id + " is not a list: " + list);
        return list;
    }

    private List<JsonNode> nonEmpty(String id) {
        List<JsonNode> all = elements(codeIssues(id));
        assertFalse(all.isEmpty(), "component " + id + " has no code issues");
        return all;
    }

    private static List<JsonNode> withRule(JsonNode list, String rule) {
        return elements(list).stream().filter(i -> rule.equals(field(i, "rule"))).toList();
    }

    private static List<JsonNode> elements(JsonNode array) {
        List<JsonNode> out = new ArrayList<>();
        array.forEach(out::add);
        return out;
    }

    /** Text of a scenario field, read under its serialized name; null when absent or JSON null. */
    private static String field(JsonNode issue, String name) {
        JsonNode value = issue.get(SERIALIZED_AS.getOrDefault(name, name));
        return value == null || value.isNull() ? null : value.asText();
    }

    private static void assertFieldMatches(List<JsonNode> list, String name, String regex) {
        Pattern pattern = Pattern.compile(regex);
        for (JsonNode issue : list) {
            String value = field(issue, name);
            assertNotNull(value, "issue has no \"" + name + "\" field: " + issue);
            assertTrue(pattern.matcher(value).find(), "\"" + name + "\" " + value + " does not match " + regex);
        }
    }

    private void assertNoFailureDiagnostics() {
        List<String> failures = run.stderr().lines()
                .filter(l -> l.startsWith("Error:") || l.contains("Unhandled exception")
                        || l.contains("Error analyzing") || l.contains("fallback also failed"))
                .toList();
        assertTrue(failures.isEmpty(), "analyzer reported failures: " + failures);
    }

    private static Map<String, JsonNode> issuesByComponent(CodeIssuesFixtures.Run r) {
        Map<String, JsonNode> out = new LinkedHashMap<>();
        for (JsonNode c : r.graph().get("components")) {
            out.put(c.get("id").asText() + " " + c.get("files"), c.get("code_issues"));
        }
        return out;
    }

    private static List<String> order(CodeIssuesFixtures.Run r) {
        List<String> out = new ArrayList<>();
        for (JsonNode c : r.graph().get("components")) {
            for (JsonNode i : c.get("code_issues")) {
                out.add(c.get("id").asText() + "|" + field(i, "rule") + "|" + i.get("line").asInt());
            }
        }
        return out;
    }

    private static Set<String> quoted(String values) {
        Matcher m = QUOTED.matcher(values);
        Set<String> out = new java.util.HashSet<>();
        while (m.find()) {
            out.add(m.group(1));
        }
        assertEquals(Arrays.stream(values.split(",")).count(), out.size(), "malformed list " + values);
        return out;
    }

    private static Path realPath(Path p) {
        try {
            return Files.exists(p) ? p.toRealPath() : p.toAbsolutePath().normalize();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static String read(Path file) {
        try {
            return Files.readString(file);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
