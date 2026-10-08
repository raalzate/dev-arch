package com.extractor.vblegacybdd;

import com.extractor.mcp.McpServerMain;
import com.extractor.mcp.tools.AnalyzeProjectTool;
import com.extractor.service.AnalysisService;
import com.extractor.testsupport.CliRunner;
import com.extractor.testsupport.DemoProjects;
import com.extractor.testsupport.ProductLayout;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.cucumber.datatable.DataTable;
import io.cucumber.java.After;
import io.cucumber.java.Before;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import io.modelcontextprotocol.spec.McpSchema;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;

/** TS-090, TS-091, TS-092, TS-093: reduced-fidelity warnings of VB analyses through the engine (009). */
public class VbWarningsSteps {

    private static final List<String> DOCS =
            List.of("output.json", "output_architecture.json", "output_entrypoints.json");

    private Path tmp;
    private Path project;
    private Path serverOut;
    private McpSchema.CallToolResult result;
    private CliRunner.Result cli;
    private Path cliOut;
    private String warning;
    private String language;

    @Before
    public void createScratch() throws IOException {
        tmp = Files.createTempDirectory("devarch-009-engine-").toRealPath();
    }

    @After
    public void deleteScratch() throws IOException {
        try (Stream<Path> walk = Files.walk(tmp)) {
            walk.sorted(Comparator.reverseOrder()).forEach(p -> p.toFile().delete());
        }
    }

    @Given("the engine host cannot load .NET Framework reference assemblies")
    public void nonWindowsHost() {
        assumeFalse(System.getProperty("os.name", "").toLowerCase(Locale.ROOT).startsWith("windows"),
                "Windows hosts may resolve .NET Framework reference assemblies (full fidelity)");
    }

    @Given("a copy of the synthetic VB project {string}")
    public void copySynthetic(String name) throws IOException {
        Path source = ProductLayout.get().engineRoot()
                .resolve("src/test/dotnet/DotNetAnalyzer.Tests/Fixtures/VbLegacy").resolve(name);
        project = tmp.resolve(name);
        try (Stream<Path> files = Files.walk(source)) {
            for (Path p : (Iterable<Path>) files.sorted()::iterator) {
                Path rel = source.relativize(p);
                if (rel.toString().startsWith("bin") || rel.toString().startsWith("obj")) {
                    continue;
                }
                Path dest = project.resolve(rel.toString());
                if (Files.isDirectory(p)) {
                    Files.createDirectories(dest);
                } else {
                    Files.copy(p, dest, StandardCopyOption.REPLACE_EXISTING);
                }
            }
        }
    }

    @Given("a copy of the demo project {string}")
    public void copyDemo(String name) throws IOException {
        project = DemoProjects.copy(name, Files.createTempDirectory(tmp, "p"));
        // The .NET demos are C# analyses: dotnet-unstructured has no project file at its root, so the
        // automatic detection would not pick the .NET analyzer for it.
        language = "dotnet";
    }

    @When("it is analyzed in server mode")
    public void serverMode() throws IOException {
        AnalysisService service = McpServerMain.createService();
        serverOut = Files.createTempDirectory(tmp, "server-out");
        Map<String, Object> args = new HashMap<>();
        args.put("projectPath", project.toString());
        args.put("outputDir", serverOut.toString());
        if (language != null) {
            args.put("language", language);
        }
        result = AnalyzeProjectTool.handle(service, new McpSchema.CallToolRequest("analyze_project", args));
        assertFalse(Boolean.TRUE.equals(result.isError()), text(result));
    }

    @When("it is analyzed in command-line mode")
    public void cliMode() throws IOException {
        cliOut = Files.createTempDirectory(tmp, "cli-out");
        cli = CliRunner.run(cliOut, List.of(project.toString(), cliOut.resolve("output.json").toString()));
        assertEquals(0, cli.exitCode(), cli.stderr());
    }

    @Then("the tool result metadata lists exactly one warning")
    public void exactlyOneWarning() {
        List<String> warnings = warnings(result);
        assertNotNull(warnings, "no warning metadata");
        assertEquals(1, warnings.size(), warnings.toString());
        warning = warnings.get(0);
    }

    @Then("that warning starts with {string}")
    public void warningStartsWith(String prefix) {
        assertTrue(warning.startsWith(prefix), warning);
    }

    @Then("that warning mentions {string}")
    public void warningMentions(String text) {
        assertTrue(warning.contains(text), warning);
        assertFalse(warning.contains(project.toString()), "warnings must not carry absolute paths: " + warning);
    }

    @Then("the dependency graph written in server mode declares the source {string}")
    public void graphSource(String source) throws IOException {
        String json = Files.readString(serverOut.resolve("output.json"));
        assertEquals(source, new ObjectMapper().readTree(json).path("meta").path("source").asText());
    }

    @Then("the command error output contains a line starting with {string}")
    public void cliWarningLine(String prefix) {
        assertTrue(cli.stderr().lines().anyMatch(l -> l.startsWith(prefix)), cli.stderr());
    }

    @Then("the command standard output does not contain {string}")
    public void cliStdout(String text) {
        assertFalse(cli.stdout().contains(text), cli.stdout());
    }

    @Then("both modes produce byte-identical output documents")
    public void identicalDocuments() {
        List<String> server = documents(serverOut);
        assertTrue(server.stream().allMatch(d -> d != null), "server mode wrote every document");
        assertEquals(server, documents(cliOut));
    }

    @Then("the tool result has no warning metadata")
    public void noWarnings() {
        assertNull(warnings(result), String.valueOf(warnings(result)));
    }

    @Then("the product document {string} mentions each of:")
    public void documentMentions(String document, DataTable table) throws IOException {
        Path doc = ProductLayout.get().productRoot().resolve(document);
        assertTrue(Files.exists(doc), doc + " must exist");
        String content = Files.readString(doc);
        List<String> missing = new ArrayList<>();
        for (Map<String, String> row : table.asMaps()) {
            if (!content.contains(row.get("text"))) {
                missing.add(row.get("text"));
            }
        }
        assertEquals(List.of(), missing, "texts missing in " + document);
    }

    private static String text(McpSchema.CallToolResult r) {
        return r.content().isEmpty() ? "" : ((McpSchema.TextContent) r.content().get(0)).text();
    }

    @SuppressWarnings("unchecked")
    private static List<String> warnings(McpSchema.CallToolResult r) {
        return r.meta() == null ? null : (List<String>) r.meta().get("static-inference/warnings");
    }

    private static List<String> documents(Path out) {
        List<String> docs = new ArrayList<>();
        for (String name : DOCS) {
            try {
                Path f = out.resolve(name);
                docs.add(Files.exists(f) ? Files.readString(f) : null);
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
        }
        return docs;
    }
}
