package com.extractor.storedprocsbdd;

import com.extractor.inference.ConsolidatedArchitecture;
import com.extractor.inference.MicroserviceProposal;
import com.extractor.inference.ProcedureEntityHeuristic;
import com.extractor.inference.config.InferenceConfig;
import com.extractor.inference.config.InferenceConfigLoader;
import com.extractor.inference.config.InvalidConfigException;
import com.extractor.model.Component;
import com.extractor.model.DependencyGraph;
import com.extractor.schema.DemoOutputs;
import com.extractor.schema.SchemaRegistry;
import com.extractor.service.AnalysisService;
import com.extractor.service.InferenceInput;
import com.extractor.service.InferenceService;
import com.extractor.service.LoadedGraph;
import com.extractor.testsupport.CliRunner;
import com.extractor.testsupport.ProductLayout;
import com.extractor.testsupport.RegressionBaselines;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.cucumber.datatable.DataTable;
import io.cucumber.java.After;
import io.cucumber.java.Before;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/** TS-020..TS-029: shared procedures in the inference and the configuration through the engine (020). */
public class StoredProceduresSteps {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private Path tmp;
    private DependencyGraph graph;
    private ConsolidatedArchitecture architecture;
    private String architectureJson;
    private InvalidConfigException rejection;
    private Path project;
    private Path cliOut;
    private CliRunner.Result cli;
    private Path argvLog;
    private String derivedEntity;
    private boolean entityApplied;

    @Before
    public void createScratch() throws IOException {
        tmp = Files.createTempDirectory("devarch-020-engine-").toRealPath();
    }

    @After
    public void deleteScratch() throws IOException {
        try (Stream<Path> walk = Files.walk(tmp)) {
            walk.sorted(Comparator.reverseOrder()).forEach(p -> p.toFile().delete());
        }
    }

    // ------------------------------------------------------------------ graph and inference

    @Given("a dependency graph with two components without calls between them:")
    public void aDependencyGraph(DataTable table) {
        List<Component> components = new ArrayList<>();
        for (Map<String, String> row : table.asMaps()) {
            Component c = new Component(row.get("id"));
            c.setLayer(row.get("layer"));
            c.setDomain(row.get("id").substring(0, row.get("id").lastIndexOf('.')));
            c.setLoc(20);
            c.setTablesUsed(new ArrayList<>(Arrays.stream(row.get("tables_used").split(","))
                    .map(String::trim).filter(s -> !s.isEmpty()).toList()));
            components.add(c);
        }
        graph = new DependencyGraph(components, new ArrayList<>());
    }

    @When("the architecture is inferred with the default configuration")
    public void inferDefault() {
        infer(InferenceConfig.defaults());
    }

    @When("the architecture is inferred with the configuration:")
    public void inferWith(String json) {
        infer(InferenceConfigLoader.fromText(json));
    }

    private void infer(InferenceConfig config) {
        architecture = new InferenceService().infer(new InferenceInput(graph, Map.of(), List.of()), config);
    }

    @When("the architecture is re-inferred through the engine with the configuration:")
    public void reinferWith(String json) throws IOException {
        LoadedGraph loaded = new LoadedGraph(graph, Map.of(), List.of(), List.of(), tmp.resolve("graph.json"));
        architecture = new AnalysisService().reinfer(loaded, InferenceConfigLoader.fromText(json), null);
        architectureJson = DemoOutputs.cliMapper().writeValueAsString(architecture);
    }

    @Then("the components {string} and {string} belong to the same proposal")
    public void sameProposal(String a, String b) {
        MicroserviceProposal pa = proposalOf(a);
        MicroserviceProposal pb = proposalOf(b);
        assertEquals(pa.getId(), pb.getId(), a + " and " + b + " must share a proposal; proposals: " + describe());
    }

    @Then("the components {string} and {string} belong to different proposals")
    public void differentProposals(String a, String b) {
        assertNotEquals(proposalOf(a).getId(), proposalOf(b).getId(),
                a + " and " + b + " must be in different proposals; proposals: " + describe());
    }

    @Then("that proposal lists exactly the shared tables {string}")
    public void sharedTables(String csv) {
        MicroserviceProposal p = lastProposal;
        assertNotNull(p, "no proposal selected");
        List<String> expected = Arrays.stream(csv.split(",")).map(String::trim).toList();
        assertEquals(expected, p.getMetrics().getTables(), "tables_shared of " + p.getName());
    }

    @Then("that proposal lists the shared tables {string} followed by the shared procedures {string}")
    public void sharedTablesThenProcedures(String tablesCsv, String proceduresCsv) {
        MicroserviceProposal p = lastProposal;
        assertNotNull(p, "no proposal selected");
        List<String> tables = Arrays.stream(tablesCsv.split(",")).map(String::trim).sorted().toList();
        List<String> procedures = Arrays.stream(proceduresCsv.split(",")).map(String::trim).toList();
        List<String> actual = p.getMetrics().getTables();
        assertEquals(tables.size() + procedures.size(), actual.size(), "tables_shared: " + actual);
        // The tables keep their pre-020 order (existing outputs unchanged); the procedures follow, ordinal.
        assertEquals(tables, actual.subList(0, tables.size()).stream().sorted().toList(), "tables of " + actual);
        assertEquals(procedures, actual.subList(tables.size(), actual.size()), "procedures of " + actual);
    }

    @Then("no proposal lists a shared table starting with {string}")
    public void noSharedTableStartingWith(String prefix) {
        for (MicroserviceProposal p : architecture.getProposals()) {
            for (String t : p.getMetrics().getTables()) {
                assertFalse(t.startsWith(prefix), p.getName() + " lists " + t);
            }
        }
    }

    @Then("the re-inference response validates against the contract {string}")
    public void reinferValidates(String kind) {
        assertNotNull(architectureJson, "no re-inference response");
        assertEquals(List.of(), SchemaRegistry.get().validate("mcp/" + kind + ".response", architectureJson));
    }

    @Then("no proposal name contains {string}")
    public void noProposalNameContains(String text) {
        for (MicroserviceProposal p : architecture.getProposals()) {
            assertFalse(p.getName().contains(text), p.getName());
        }
    }

    @Then("the proposal containing {string} has a name containing {string}")
    public void proposalNameContains(String component, String text) {
        MicroserviceProposal p = proposalOf(component);
        assertTrue(p.getName().contains(text), "name was '" + p.getName() + "'");
    }

    @Then("the component {string} still uses exactly the tables {string}")
    public void componentTables(String id, String csv) {
        Component c = graph.getComponents().stream().filter(x -> x.getId().equals(id)).findFirst().orElseThrow();
        assertEquals(Arrays.stream(csv.split(",")).map(String::trim).toList(), c.getTablesUsed());
    }

    private MicroserviceProposal lastProposal;

    private MicroserviceProposal proposalOf(String component) {
        for (MicroserviceProposal p : architecture.getProposals()) {
            if (p.getComponentNames().contains(component)) {
                lastProposal = p;
                return p;
            }
        }
        throw new AssertionError(component + " is in no proposal; proposals: " + describe());
    }

    private String describe() {
        StringBuilder sb = new StringBuilder();
        for (MicroserviceProposal p : architecture.getProposals()) {
            sb.append(p.getId()).append(' ').append(p.getName()).append(' ').append(p.getComponentNames()).append("; ");
        }
        return sb.toString();
    }

    // ------------------------------------------------------------------ configuration validation

    @When("the engine loads the configuration:")
    public void loadConfiguration(String json) {
        rejection = null;
        try {
            InferenceConfigLoader.fromText(json);
        } catch (InvalidConfigException e) {
            rejection = e;
        }
    }

    @Then("the configuration is rejected naming the parameter {string}")
    public void rejectedNaming(String parameter) {
        assertNotNull(rejection, "the configuration was accepted");
        assertTrue(rejection.getMessage().contains(parameter), rejection.getMessage());
    }

    // ------------------------------------------------------------------ demos and the bridge

    @Given("a copy of the demo project {string}")
    public void aCopyOfTheDemo(String name) {
        // The hermetic copy shared by the contract tests: the baselines reference its root.
        project = DemoOutputs.projectDir(name);
        if (DemoOutputs.isDotNet(name)) {
            assumeTrue(DemoOutputs.dotNetAnalyzerAvailable(), "requires-dotnet: analyzer not built");
        }
    }

    @Given("a copy of the synthetic VB project {string}")
    public void aCopyOfTheSynthetic(String name) throws IOException {
        assumeTrue(DemoOutputs.dotNetAnalyzerAvailable(), "requires-dotnet: analyzer not built");
        Path source = ProductLayout.get().engineRoot()
                .resolve("src/test/dotnet/DotNetAnalyzer.Tests/Fixtures/VbLegacy").resolve(name);
        project = tmp.resolve(name);
        try (Stream<Path> files = Files.walk(source)) {
            for (Path p : (Iterable<Path>) files.sorted()::iterator) {
                String rel = source.relativize(p).toString();
                if (rel.startsWith("bin") || rel.startsWith("obj")) {
                    continue;
                }
                Path dest = project.resolve(rel);
                if (Files.isDirectory(p)) {
                    Files.createDirectories(dest);
                } else {
                    Files.copy(p, dest, StandardCopyOption.REPLACE_EXISTING);
                }
            }
        }
    }

    @When("it is analyzed in command-line mode")
    public void cliMode() throws IOException {
        runCli(null);
    }

    @When("it is analyzed in command-line mode with the configuration:")
    public void cliModeWithConfig(String json) throws IOException {
        runCli(json);
    }

    private void runCli(String configJson) throws IOException {
        cliOut = Files.createTempDirectory(tmp, "cli-out");
        List<String> args = new ArrayList<>(List.of(project.toString(), cliOut.resolve("output.json").toString()));
        if (configJson != null) {
            Path config = cliOut.resolve("config.json");
            Files.writeString(config, configJson.replace("Catalog/procs.csv",
                    project.resolve("Catalog/procs.csv").toString()));
            args.add("--config=" + config);
        }
        argvLog = installRecordingAnalyzer();
        // The engine locates dotnet-analyzer next to its own classes first: the child JVM loads the engine
        // classes through a link placed next to the recording wrapper.
        Path classesLink = argvLog.getParent().resolve("classes");
        // Surefire forks with a booter jar: the real class path is in surefire.test.class.path.
        String realClassPath = System.getProperty("surefire.test.class.path", System.getProperty("java.class.path"));
        String classPath = Arrays.stream(realClassPath.split(java.io.File.pathSeparator))
                .map(entry -> entry.endsWith(java.io.File.separator + "target" + java.io.File.separator + "classes")
                        ? classesLink.toString() : entry)
                .collect(java.util.stream.Collectors.joining(java.io.File.pathSeparator));
        assertTrue(classPath.contains(classesLink.toString()),
                "no target/classes entry found in the class path: " + realClassPath);
        cli = CliRunner.run(cliOut, args, Map.of(), classPath);
        assertEquals(0, cli.exitCode(), cli.stderr());
    }

    /** A dotnet-analyzer wrapper that records its arguments (and copies any --config file) before delegating. */
    private Path installRecordingAnalyzer() throws IOException {
        Path real = ProductLayout.get().engineRoot().resolve("target/dotnet-analyzer");
        assumeTrue(Files.isExecutable(real), "requires-dotnet: " + real);
        Path dir = Files.createTempDirectory(tmp, "wrapper");
        // A real copy: the JVM reports the code source of a linked directory through its target, so a link would
        // still make the locator find engine/target/dotnet-analyzer first.
        Path classes = ProductLayout.get().engineRoot().resolve("target/classes");
        Path copy = dir.resolve("classes");
        try (Stream<Path> files = Files.walk(classes)) {
            for (Path p : (Iterable<Path>) files.sorted()::iterator) {
                Path dest = copy.resolve(classes.relativize(p).toString());
                if (Files.isDirectory(p)) {
                    Files.createDirectories(dest);
                } else {
                    Files.copy(p, dest, StandardCopyOption.REPLACE_EXISTING);
                }
            }
        }
        Path log = dir.resolve("argv.log");
        Path exe = dir.resolve("dotnet-analyzer");
        Files.writeString(exe, "#!/usr/bin/env bash\n"
                + "printf '%s\\n' \"$@\" > '" + log + "'\n"
                + "for a in \"$@\"; do case \"$a\" in --config=*) cp \"${a#--config=}\" '" + log + ".config';; esac; done\n"
                + "exec '" + real + "' \"$@\"\n");
        Files.setPosixFilePermissions(exe, PosixFilePermissions.fromString("rwxr-xr-x"));
        return log;
    }

    @Then("the output documents are byte-identical to the versioned baseline of {string}")
    public void outputsMatchBaseline(String demo) throws IOException {
        // baseline-v1.2.0 (008): default outputs of the hermetic demo copies, byte for byte.
        Map<String, String> baseline = RegressionBaselines.load(demo);
        for (String artifact : baseline.keySet()) {
            String current = Files.readString(cliOut.resolve(artifact), StandardCharsets.UTF_8);
            assertEquals(baseline.get(artifact), current, artifact + " of " + demo);
        }
    }

    @Then("the .NET analyzer was invoked with exactly the arguments {string}")
    public void invokedWithExactly(String spec) throws IOException {
        assertEquals(List.of(project.toString()), argv(), "argv of dotnet-analyzer");
    }

    @Then("the .NET analyzer was invoked with the arguments {string} and {string}")
    public void invokedWithConfig(String first, String second) throws IOException {
        List<String> argv = argv();
        assertEquals(2, argv.size(), "argv of dotnet-analyzer: " + argv);
        assertEquals(project.toString(), argv.get(0));
        assertTrue(argv.get(1).startsWith("--config="), argv.get(1));
    }

    @Then("that configuration file contained the section {string} with {string} equal to {string}")
    public void configFileContained(String section, String key, String value) throws IOException {
        Path copy = Path.of(argvLog + ".config");
        assertTrue(Files.exists(copy), "the wrapper saw no --config file");
        assertEquals(value, MAPPER.readTree(Files.readString(copy)).path(section).path(key).asText());
    }

    @Then("that configuration file no longer exists after the analysis")
    public void configFileDeleted() throws IOException {
        String arg = argv().get(1);
        assertFalse(Files.exists(Path.of(arg.substring("--config=".length()))), arg + " must be deleted");
    }

    private List<String> argv() throws IOException {
        assertTrue(Files.exists(argvLog), "the wrapper was not invoked");
        return Files.readAllLines(argvLog).stream().filter(l -> !l.isEmpty()).toList();
    }

    // ------------------------------------------------------------------ entity heuristic

    @When("the entity heuristic is applied to {string}")
    public void heuristicApplied(String procedure) {
        derivedEntity = ProcedureEntityHeuristic.entityOf(procedure);
        entityApplied = true;
    }

    @Then("the derived entity is {string}")
    public void derivedEntityIs(String expected) {
        assertTrue(entityApplied);
        if ("(none)".equals(expected)) {
            assertNull(derivedEntity, "expected no entity");
        } else {
            assertEquals(expected, derivedEntity);
        }
    }
}
