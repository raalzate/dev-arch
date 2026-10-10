package com.extractor.legacybdd.dotnet;

import com.extractor.inference.config.InferenceConfig;
import com.extractor.mcp.McpCalls;
import com.extractor.schema.DemoOutputs;
import com.extractor.schema.SchemaRegistry;
import com.extractor.service.AnalysisService;
import com.extractor.service.GraphSource;
import com.extractor.testsupport.RegressionBaselines;
import com.fasterxml.jackson.databind.JsonNode;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Steps of {@code dotnet-analysis.feature} (US-001) and the shared "analysis is executed" step. */
public class DotnetAnalysisSteps {

    /** Demo project used as the reference .NET monolith (controllers, services, repositories, EF Core). */
    static final String DOTNET_DEMO = "dotnet-ecommerce";

    private static final Pattern HTTP_ATTRIBUTE = Pattern.compile("\\[Http(Get|Post|Put|Delete|Patch)\\b");
    private static final Pattern DB_SET = Pattern.compile("DbSet<\\s*(\\w+)\\s*>\\s+(\\w+)");
    private static final Pattern CLASS_DECLARATION = Pattern.compile("\\bclass\\s+(\\w+)");

    // ---------------------------------------------------------------- Background and shared steps

    @Given("a .NET\\/C# project directory containing {string} or {string} files")
    public void aDotNetProjectDirectory(String sln, String csproj) {
        LegacyDotnet.requireAnalyzer();
        Path project = LegacyDotnet.demo(DOTNET_DEMO);
        assertTrue(LegacyDotnet.hasRootFile(project, sln) || LegacyDotnet.hasRootFile(project, csproj)
                        || !LegacyDotnet.sources(project, csproj).isEmpty(),
                project + " must contain " + sln + " or " + csproj + " files");
        LegacyWorld.project = project;
    }

    @When("the analysis is executed")
    public void theAnalysisIsExecuted() {
        assertTrue(LegacyWorld.project != null, "no project selected by a previous step");
        boolean fresh = Boolean.TRUE.equals(LegacyWorld.data.get("freshAnalysis"));
        long start = System.nanoTime();
        try {
            LegacyWorld.run = fresh ? LegacyDotnet.analyzeFresh(LegacyWorld.project)
                    : LegacyDotnet.engine(LegacyWorld.project);
        } catch (RuntimeException e) {
            LegacyWorld.error = e;
        }
        LegacyWorld.elapsed = fresh ? Duration.ofNanos(System.nanoTime() - start) : null;
        if (LegacyWorld.captureDiagnostics) {
            LegacyWorld.rawRun = LegacyDotnet.raw(LegacyWorld.project);
        }
        if (!Boolean.TRUE.equals(LegacyWorld.data.get("errorExpected")) && LegacyWorld.error != null) {
            throw new AssertionError("analysis of " + LegacyWorld.project + " failed", LegacyWorld.error);
        }
    }

    // ---------------------------------------------------------------- TS-001

    @Given("the project contains controllers, services, and repositories")
    public void theProjectContainsControllersServicesAndRepositories() {
        List<String> names = LegacyDotnet.sources(LegacyWorld.project, ".cs").stream()
                .map(p -> p.getFileName().toString()).toList();
        for (String suffix : List.of("Controller.cs", "Service.cs", "Repository.cs")) {
            assertTrue(names.stream().anyMatch(n -> n.endsWith(suffix)),
                    "the project must contain *" + suffix + " sources: " + names);
        }
    }

    @When("the user invokes {string} pointing at that directory")
    public void theUserInvokesPointingAtThatDirectory(String tool) {
        Path outDir = LegacyDotnet.scratch("analyze-project");
        McpCalls.Response response = new McpCalls(new AnalysisService()).call(tool,
                Map.of("projectPath", LegacyWorld.project.toString(), "outputDir", outDir.toString()));
        assertFalse(response.error(), tool + " failed: " + response.text());
        LegacyDotnet.assertValid("mcp/" + tool + ".response", response.text(), tool + " response");
        LegacyWorld.responses.put(tool, LegacyDotnet.json(response.text()));
        Path graph = outDir.resolve(DemoOutputs.GRAPH);
        assertTrue(Files.isRegularFile(graph), tool + " did not write " + graph);
        LegacyWorld.data.put("graphJson", LegacyDotnet.read(graph));
    }

    @Then("the result contains a {string} with the same JSON schema as Java analysis")
    public void theResultContainsADependencyGraphWithTheSameSchema(String document) {
        assertEquals("DependencyGraph", document);
        String graphJson = LegacyWorld.get("graphJson");
        LegacyDotnet.assertValid(SchemaRegistry.DEPENDENCY_GRAPH, graphJson, ".NET " + document);
        JsonNode graph = LegacyDotnet.json(graphJson);
        JsonNode java = LegacyDotnet.json(RegressionBaselines.load("java-standar").get(DemoOutputs.GRAPH));
        assertEquals(fieldNames(java), fieldNames(graph), "top-level properties of the .NET and Java graphs");
        assertEquals(fieldNames(java.path("components").path(0)), fieldNames(graph.path("components").path(0)),
                "component properties of the .NET and Java graphs");
        assertEquals(fieldNames(java.path("edges").path(0)), fieldNames(graph.path("edges").path(0)),
                "edge properties of the .NET and Java graphs");
        JsonNode summary = LegacyWorld.responses.get("analyze_project");
        assertEquals(graph.path("components").size(), summary.path("componentCount").asInt(),
                "analyze_project componentCount");
    }

    @Then("the result includes a non-empty {string} list")
    public void theResultIncludesANonEmptyList(String property) {
        JsonNode list = LegacyDotnet.json(LegacyWorld.<String>get("graphJson")).path(property);
        assertTrue(list.isArray() && !list.isEmpty(), property + " must be a non-empty list: " + list);
    }

    @Then("the result includes an {string} section")
    public void theResultIncludesASection(String property) {
        JsonNode section = LegacyDotnet.json(LegacyWorld.<String>get("graphJson")).path(property);
        assertTrue(section.isObject(), property + " section missing");
        assertTrue(section.path("endpoints").isArray(), property + ".endpoints must be a list");
    }

    // ---------------------------------------------------------------- TS-002

    @Given("the project contains controllers decorated with {string}, {string}, and {string}")
    public void theProjectContainsDecoratedControllers(String api, String get, String post) {
        Map<String, List<String>> verbsByController = new TreeMap<>();
        String all = "";
        for (Path source : LegacyDotnet.sources(LegacyWorld.project, ".cs")) {
            String text = LegacyDotnet.read(source);
            if (!text.contains(api)) {
                continue;
            }
            all += text;
            List<String> verbs = new ArrayList<>();
            Matcher m = HTTP_ATTRIBUTE.matcher(text);
            while (m.find()) {
                verbs.add(m.group(1).toUpperCase());
            }
            Matcher cls = CLASS_DECLARATION.matcher(text);
            assertTrue(cls.find(), "no class in " + source);
            verbsByController.put(cls.group(1), sorted(verbs));
        }
        assertFalse(verbsByController.isEmpty(), "no " + api + " controller in " + LegacyWorld.project);
        assertTrue(all.contains(get) && all.contains(post), "controllers must use " + get + " and " + post);
        LegacyWorld.data.put("verbsByController", verbsByController);
    }

    @Then("the REST endpoints appear in the {string} section of the result")
    public void theRestEndpointsAppear(String section) {
        Map<String, List<String>> expected = LegacyWorld.get("verbsByController");
        JsonNode endpoints = LegacyWorld.run.graph().path(section).path("endpoints");
        Map<String, List<String>> actual = new TreeMap<>();
        for (JsonNode endpoint : endpoints) {
            String controller = simpleName(endpoint.path("component_id").asText());
            actual.computeIfAbsent(controller, k -> new ArrayList<>()).add(endpoint.path("method").asText());
        }
        actual.replaceAll((k, v) -> sorted(v));
        assertEquals(expected, actual, "HTTP verbs per controller (sources vs " + section + ")");
    }

    @Then("each endpoint includes the HTTP method, path, and controller name")
    public void eachEndpointIncludesMethodPathAndController() {
        JsonNode graph = LegacyWorld.run.graph();
        JsonNode endpoints = graph.path("api_contracts").path("endpoints");
        assertFalse(endpoints.isEmpty(), "no endpoints");
        for (JsonNode endpoint : endpoints) {
            assertTrue(Set.of("GET", "POST", "PUT", "DELETE", "PATCH").contains(endpoint.path("method").asText()),
                    "HTTP method of " + endpoint);
            assertTrue(endpoint.path("path").asText().startsWith("/"), "path of " + endpoint);
            String controller = endpoint.path("component_id").asText();
            JsonNode component = LegacyWorld.run.component(controller);
            assertTrue(component.path("annotations").toString().contains("\"ApiController\""),
                    controller + " must be an [ApiController]");
        }
    }

    // ---------------------------------------------------------------- TS-003

    @Given("the project contains Entity Framework DbContext with DbSet properties")
    public void theProjectContainsDbContext() {
        for (Path source : LegacyDotnet.sources(LegacyWorld.project, ".cs")) {
            String text = LegacyDotnet.read(source);
            Matcher cls = Pattern.compile("class\\s+(\\w+)\\s*(?:\\([^)]*\\))?\\s*:\\s*DbContext\\b").matcher(text);
            if (!cls.find()) {
                continue;
            }
            Map<String, String> dbSets = new TreeMap<>();
            Matcher m = DB_SET.matcher(text);
            while (m.find()) {
                dbSets.put(m.group(1), m.group(2));
            }
            assertFalse(dbSets.isEmpty(), "DbContext " + cls.group(1) + " declares no DbSet");
            LegacyWorld.data.put("dbContext", cls.group(1));
            LegacyWorld.data.put("dbSets", dbSets);
            return;
        }
        throw new AssertionError("no DbContext in " + LegacyWorld.project);
    }

    @Then("the components include the referenced database tables in their {string} field")
    public void theComponentsIncludeTheTables(String field) {
        Map<String, String> dbSets = LegacyWorld.get("dbSets");
        JsonNode context = componentBySimpleName(LegacyWorld.get("dbContext"));
        Set<String> contextTables = texts(context.path(field));
        assertEquals(dbSets.size(), contextTables.size(),
                "one table per DbSet in the DbContext " + field + ": " + contextTables + " vs " + dbSets);
        for (String entity : dbSets.keySet()) {
            Set<String> tables = texts(componentBySimpleName(entity).path(field));
            assertEquals(1, tables.size(), "entity " + entity + " " + field + ": " + tables);
            assertTrue(contextTables.containsAll(tables),
                    "table of " + entity + " " + tables + " must be referenced by the DbContext " + contextTables);
        }
    }

    // ---------------------------------------------------------------- TS-004

    @Given("a .NET project with up to {int} classes")
    public void aDotNetProjectWithUpToClasses(int classes) {
        Path project = LegacyDotnet.scratch("generated-" + classes);
        LegacyDotnet.write(project.resolve("Generated.csproj"), """
                <Project Sdk="Microsoft.NET.Sdk">
                  <PropertyGroup>
                    <TargetFramework>net8.0</TargetFramework>
                    <ImplicitUsings>enable</ImplicitUsings>
                  </PropertyGroup>
                </Project>
                """);
        Map<String, Path> expected = new LinkedHashMap<>();
        for (int i = 0; i < classes; i++) {
            String module = "Module" + (i % 10);
            String name = "Unit" + i + "Service";
            String dependency = i >= 10 ? "Unit" + (i - 10) + "Service" : null;
            StringBuilder body = new StringBuilder();
            body.append("namespace Generated.").append(module).append(";\n\n");
            body.append("[Serializable]\n");
            body.append("public class ").append(name).append("\n{\n");
            if (dependency != null) {
                body.append("    private readonly ").append(dependency).append(" _next;\n\n");
                body.append("    public ").append(name).append("(").append(dependency).append(" next)\n");
                body.append("    {\n        _next = next;\n    }\n\n");
                body.append("    public int Compute(int value)\n    {\n");
                body.append("        return _next.Compute(value) + ").append(i).append(";\n    }\n");
            } else {
                body.append("    public int Compute(int value)\n    {\n");
                body.append("        return value + ").append(i).append(";\n    }\n");
            }
            body.append("}\n");
            Path file = project.resolve(module).resolve(name + ".cs");
            LegacyDotnet.write(file, body.toString());
            expected.put("Generated." + module + "." + name, file);
        }
        // Same-namespace references only: classes i and i-10 share Module(i % 10).
        LegacyWorld.project = project;
        LegacyWorld.data.put("expectedClasses", expected);
        LegacyWorld.data.put("freshAnalysis", true);
    }

    @Then("it completes in less than {int} minutes")
    public void itCompletesInLessThanMinutes(int minutes) {
        assertTrue(LegacyWorld.elapsed != null, "analysis was not timed");
        assertTrue(LegacyWorld.elapsed.compareTo(Duration.ofMinutes(minutes)) < 0,
                "analysis took " + LegacyWorld.elapsed);
    }

    @Then("the result contains all components with metadata \\(qualified name, file path, LOC, annotations)")
    public void theResultContainsAllComponentsWithMetadata() throws IOException {
        Map<String, Path> expected = LegacyWorld.get("expectedClasses");
        assertEquals(new TreeSet<>(expected.keySet()), new TreeSet<>(LegacyWorld.run.componentIds()),
                "qualified names of the analyzed components");
        for (Map.Entry<String, Path> entry : expected.entrySet()) {
            JsonNode component = LegacyWorld.run.component(entry.getKey());
            JsonNode files = component.path("files");
            assertEquals(1, files.size(), "files of " + entry.getKey());
            assertEquals(entry.getValue().toRealPath(), Path.of(files.path(0).asText()).toRealPath(),
                    "file path of " + entry.getKey());
            assertTrue(component.path("loc").asInt() > 0, "LOC of " + entry.getKey());
            assertTrue(texts(component.path("annotations")).contains("Serializable"),
                    "annotations of " + entry.getKey() + ": " + component.path("annotations"));
        }
    }

    // ---------------------------------------------------------------- TS-005

    @Given("the analysis produces a valid DependencyGraph for a .NET project")
    public void theAnalysisProducesAValidDependencyGraph() {
        LegacyWorld.run = LegacyDotnet.engine(LegacyWorld.project);
        LegacyDotnet.assertValid(SchemaRegistry.DEPENDENCY_GRAPH, LegacyWorld.run.graphJson(), ".NET graph");
        assertFalse(LegacyWorld.run.componentIds().isEmpty(), "the .NET graph has no components");
    }

    @When("the inference engine processes that DependencyGraph")
    public void theInferenceEngineProcessesThatDependencyGraph() throws IOException {
        Path out = LegacyDotnet.scratch("reinfer");
        DemoOutputs.writeArtifacts(new DemoOutputs.Artifacts(DOTNET_DEMO, LegacyWorld.run.graphJson(),
                LegacyWorld.run.architectureJson(), LegacyWorld.run.entrypointsJson(), List.of()), out);
        var architecture = new AnalysisService().reinfer(GraphSource.fromPath(out.resolve(DemoOutputs.GRAPH)),
                InferenceConfig.defaults(), null);
        LegacyWorld.data.put("architectureJson", DemoOutputs.cliMapper().writeValueAsString(architecture));
    }

    @Then("coherent microservice decomposition proposals are generated")
    public void coherentProposalsAreGenerated() {
        String architectureJson = LegacyWorld.get("architectureJson");
        LegacyDotnet.assertValid(SchemaRegistry.ARCHITECTURE, architectureJson, "architecture");
        JsonNode proposals = LegacyDotnet.json(architectureJson).path("proposals");
        assertFalse(proposals.isEmpty(), "no proposals");
        Set<String> graphIds = new HashSet<>(LegacyWorld.run.componentIds());
        Map<String, Integer> owner = new HashMap<>();
        for (JsonNode proposal : proposals) {
            JsonNode components = proposal.path("components");
            assertFalse(components.isEmpty(), "proposal without components: " + proposal.path("name"));
            for (JsonNode component : components) {
                String id = component.asText();
                assertTrue(graphIds.contains(id), "proposal component " + id + " is not in the graph");
                Integer previous = owner.put(id, proposal.path("id").asInt());
                assertNull(previous, id + " assigned to proposals " + previous + " and " + proposal.path("id"));
            }
        }
    }

    @Then("the proposals include cluster assignments and viability scores")
    public void theProposalsIncludeClustersAndViability() {
        JsonNode proposals = LegacyDotnet.json(LegacyWorld.<String>get("architectureJson")).path("proposals");
        for (JsonNode proposal : proposals) {
            JsonNode clusters = proposal.path("clusters");
            assertTrue(clusters.isArray() && !clusters.isEmpty(), "clusters of " + proposal.path("name"));
            clusters.forEach(c -> assertTrue(c.isInt(), "cluster id " + c));
            assertTrue(Set.of("Alta", "Media", "Baja").contains(proposal.path("viability").asText()),
                    "viability of " + proposal.path("name") + ": " + proposal.path("viability"));
        }
    }

    // ---------------------------------------------------------------- TS-006

    @Given("a running MCP server and a .NET project directory")
    public void aRunningMcpServerAndADotNetProject() throws IOException {
        McpStdioClient client = McpStdioClient.start(LegacyDotnet.scratch("mcp-server"));
        LegacyWorld.closeables.add(client);
        LegacyWorld.data.put("mcp", client);
        assertTrue(Files.isDirectory(LegacyWorld.project), "project directory " + LegacyWorld.project);
    }

    @When("each of the {int} MCP tools is invoked with the .NET project path")
    public void eachOfTheMcpToolsIsInvoked(int count) throws IOException {
        McpStdioClient client = LegacyWorld.get("mcp");
        List<String> tools = List.of("analyze_project", "get_dependency_graph", "get_architecture_proposal",
                "get_component_metrics", "get_api_contracts");
        assertEquals(count, tools.size());
        assertTrue(client.toolNames().containsAll(tools), "server tools " + client.toolNames());
        String projectPath = LegacyWorld.project.toString();
        Path outDir = LegacyDotnet.scratch("mcp-analyze");
        LegacyWorld.data.put("mcpOutDir", outDir);
        LegacyWorld.responses.put("analyze_project", client.callTool("analyze_project",
                Map.of("projectPath", projectPath, "outputDir", outDir.toString())));
        for (String tool : List.of("get_dependency_graph", "get_architecture_proposal", "get_api_contracts")) {
            LegacyWorld.responses.put(tool, client.callTool(tool, Map.of("projectPath", projectPath)));
        }
        JsonNode graph = LegacyDotnet.json(McpStdioClient.text(LegacyWorld.responses.get("get_dependency_graph")));
        Map<String, JsonNode> metrics = new TreeMap<>();
        for (JsonNode component : graph.path("components")) {
            String id = component.path("id").asText();
            metrics.put(id, client.callTool("get_component_metrics",
                    Map.of("projectPath", projectPath, "componentId", id)));
        }
        LegacyWorld.data.put("metricsResponses", metrics);
    }

    @Then("{string} returns a valid DependencyGraph")
    public void returnsAValidDependencyGraph(String tool) {
        String text = successfulText(tool);
        LegacyDotnet.assertValid("mcp/" + tool + ".response", text, tool + " response");
        Path graphFile = LegacyWorld.<Path>get("mcpOutDir").resolve(DemoOutputs.GRAPH);
        assertTrue(Files.isRegularFile(graphFile), tool + " did not write " + graphFile);
        String graphJson = LegacyDotnet.read(graphFile);
        LegacyDotnet.assertValid(SchemaRegistry.DEPENDENCY_GRAPH, graphJson, tool + " output.json");
        int components = LegacyDotnet.json(graphJson).path("components").size();
        assertTrue(components > 0, "no components in " + graphFile);
        assertEquals(components, LegacyDotnet.json(text).path("componentCount").asInt(), "componentCount");
    }

    @Then("{string} returns the edges for the .NET project")
    public void returnsTheEdges(String tool) {
        String text = successfulText(tool);
        LegacyDotnet.assertValid("mcp/" + tool + ".response", text, tool + " response");
        JsonNode graph = LegacyDotnet.json(text);
        assertTrue(graph.path("meta").path("source").asText().startsWith("roslyn"),
                "graph must come from the .NET analyzer: " + graph.path("meta"));
        Set<String> ids = new HashSet<>();
        graph.path("components").forEach(c -> ids.add(c.path("id").asText()));
        JsonNode edges = graph.path("edges");
        assertFalse(edges.isEmpty(), "no edges");
        for (JsonNode edge : edges) {
            assertTrue(ids.contains(edge.path("from").asText()), "edge source not a component: " + edge);
        }
    }

    @Then("{string} returns microservice proposals")
    public void returnsMicroserviceProposals(String tool) {
        String text = successfulText(tool);
        LegacyDotnet.assertValid("mcp/" + tool + ".response", text, tool + " response");
        assertFalse(LegacyDotnet.json(text).path("proposals").isEmpty(), "no proposals");
    }

    @Then("{string} returns metrics for each component")
    public void returnsMetricsForEachComponent(String tool) {
        Map<String, JsonNode> metrics = LegacyWorld.get("metricsResponses");
        assertFalse(metrics.isEmpty(), "no component was queried");
        // Types declared with the class/interface keyword always get numeric metrics; the contract
        // (common#Component) allows null cbo/lcom, which the analyzer emits for C# records and top-level statements.
        Set<String> classesAndInterfaces = new TreeSet<>();
        Pattern declaration = Pattern.compile("\\b(?:class|interface)\\s+(\\w+)");
        for (Path source : LegacyDotnet.sources(LegacyWorld.project, ".cs")) {
            Matcher m = declaration.matcher(LegacyDotnet.read(source));
            while (m.find()) {
                classesAndInterfaces.add(m.group(1));
            }
        }
        int numeric = 0;
        for (Map.Entry<String, JsonNode> entry : metrics.entrySet()) {
            assertFalse(McpStdioClient.isError(entry.getValue()), tool + " failed for " + entry.getKey()
                    + ": " + McpStdioClient.text(entry.getValue()));
            String text = McpStdioClient.text(entry.getValue());
            LegacyDotnet.assertValid("mcp/" + tool + ".response", text, tool + " " + entry.getKey());
            JsonNode component = LegacyDotnet.json(text);
            assertEquals(entry.getKey(), component.path("id").asText(), "component id");
            assertTrue(component.path("loc").isInt() && component.path("loc").asInt() > 0, "loc of " + entry.getKey());
            for (String metric : List.of("cbo", "lcom")) {
                assertTrue(component.has(metric), metric + " missing for " + entry.getKey());
            }
            if (classesAndInterfaces.contains(simpleName(entry.getKey()))) {
                assertTrue(component.path("cbo").isInt() && component.path("lcom").isNumber(),
                        "cbo/lcom of class or interface " + entry.getKey() + ": " + component.path("cbo") + ", "
                                + component.path("lcom"));
                numeric++;
            }
        }
        assertTrue(numeric > 0, "no class or interface among the queried components");
    }

    @Then("{string} returns the REST endpoints")
    public void returnsTheRestEndpoints(String tool) {
        String text = successfulText(tool);
        LegacyDotnet.assertValid("mcp/" + tool + ".response", text, tool + " response");
        JsonNode endpoints = LegacyDotnet.json(text).path("endpoints");
        assertFalse(endpoints.isEmpty(), "no endpoints");
        for (JsonNode endpoint : endpoints) {
            assertFalse(endpoint.path("method").asText().isBlank(), "method of " + endpoint);
            assertTrue(endpoint.path("path").asText().startsWith("/"), "path of " + endpoint);
        }
    }

    // ---------------------------------------------------------------- TS-007

    @Given("a .NET project that has missing NuGet dependencies or does not build")
    public void aDotNetProjectThatDoesNotBuild() {
        Path project = LegacyDotnet.fixture("broken-build");
        String csproj = LegacyDotnet.read(project.resolve("Ledger.csproj"));
        assertTrue(csproj.contains("9.9.9-missing") && csproj.contains("Missing.Shared.csproj"),
                "fixture must reference a missing package and a missing project");
        assertFalse(Files.exists(project.resolve("../Missing.Shared/Missing.Shared.csproj").normalize()),
                "the referenced project must not exist");
        LegacyWorld.project = project;
        LegacyWorld.captureDiagnostics = true;
        LegacyWorld.data.put("errorExpected", true);
    }

    @Then("partial results are returned with available components")
    public void partialResultsAreReturned() {
        assertNull(LegacyWorld.error, "analysis aborted: " + LegacyWorld.error);
        Set<String> declared = new TreeSet<>();
        for (Path source : LegacyDotnet.sources(LegacyWorld.project, ".cs")) {
            Matcher m = CLASS_DECLARATION.matcher(LegacyDotnet.read(source));
            while (m.find()) {
                declared.add(m.group(1));
            }
        }
        Set<String> analyzed = new TreeSet<>();
        LegacyWorld.run.componentIds().forEach(id -> analyzed.add(simpleName(id)));
        assertEquals(declared, analyzed, "components of the non-building project");
    }

    @Then("a warning indicates which parts were skipped due to compilation errors")
    public void aWarningIndicatesSkippedParts() {
        LegacyDotnet.RawRun raw = LegacyWorld.rawRun;
        assertTrue(raw != null, "analyzer diagnostics were not captured");
        List<String> warnings = raw.stderr().lines().filter(l -> l.startsWith("[WARN]")).toList();
        assertTrue(warnings.stream().anyMatch(l -> l.contains("Missing.Shared")),
                "a warning must name the unresolved project reference Missing.Shared; warnings: " + warnings);
    }

    @Then("the overall analysis does not abort")
    public void theOverallAnalysisDoesNotAbort() {
        assertNull(LegacyWorld.error, "engine analysis aborted: " + LegacyWorld.error);
        assertEquals(0, LegacyWorld.rawRun.exitCode(), "dotnet-analyzer exit code; stderr:\n"
                + LegacyDotnet.abbreviate(LegacyWorld.rawRun.stderr()));
        LegacyDotnet.assertValid(SchemaRegistry.DEPENDENCY_GRAPH, LegacyWorld.run.graphJson(), "partial graph");
    }

    // ---------------------------------------------------------------- helpers

    static String successfulText(String tool) {
        JsonNode result = LegacyWorld.responses.get(tool);
        assertTrue(result != null, "tool " + tool + " was not invoked");
        assertFalse(McpStdioClient.isError(result), tool + " failed: " + McpStdioClient.text(result));
        return McpStdioClient.text(result);
    }

    static JsonNode componentBySimpleName(String simpleName) {
        List<String> matches = LegacyWorld.run.componentIds().stream()
                .filter(id -> simpleName(id).equals(simpleName)).toList();
        assertEquals(1, matches.size(), "components named " + simpleName + ": " + matches);
        return LegacyWorld.run.component(matches.get(0));
    }

    static String simpleName(String id) {
        return id.substring(id.lastIndexOf('.') + 1);
    }

    static Set<String> texts(JsonNode array) {
        Set<String> values = new TreeSet<>();
        array.forEach(v -> values.add(v.asText()));
        return values;
    }

    static Set<String> fieldNames(JsonNode node) {
        Set<String> names = new TreeSet<>();
        Iterator<String> it = node.fieldNames();
        it.forEachRemaining(names::add);
        return names;
    }

    private static List<String> sorted(List<String> values) {
        List<String> copy = new ArrayList<>(values);
        copy.sort(String::compareTo);
        return copy;
    }
}
