package com.extractor.legacybdd.dotnet;

import com.extractor.analyzer.ProjectType;
import com.extractor.analyzer.ProjectTypeDetector;
import com.extractor.schema.DemoOutputs;
import com.extractor.schema.SchemaRegistry;
import com.extractor.testsupport.RegressionBaselines;
import com.fasterxml.jackson.databind.JsonNode;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Steps of {@code project-type-detection.feature} (US-002). */
public class ProjectTypeSteps {

    private static final String JAVA_CLASS = """
            package demo;

            public class Greeter {

                public String greet(String name) {
                    return "Hello " + name;
                }
            }
            """;

    private static final String CS_CLASS = """
            namespace Demo;

            public class Greeter
            {
                public string Greet(string name)
                {
                    return "Hello " + name;
                }
            }
            """;

    private static final String CSPROJ = """
            <Project Sdk="Microsoft.NET.Sdk">
              <PropertyGroup>
                <TargetFramework>net8.0</TargetFramework>
                <ImplicitUsings>enable</ImplicitUsings>
              </PropertyGroup>
            </Project>
            """;

    private static final String POM = """
            <?xml version="1.0" encoding="UTF-8"?>
            <project xmlns="http://maven.apache.org/POM/4.0.0">
              <modelVersion>4.0.0</modelVersion>
              <groupId>demo</groupId>
              <artifactId>greeter</artifactId>
              <version>1.0.0</version>
            </project>
            """;

    private static final String SLN = """
            Microsoft Visual Studio Solution File, Format Version 12.00
            # Visual Studio Version 17
            VisualStudioVersion = 17.0.31903.59
            MinimumVisualStudioVersion = 10.0.40219.1
            Project("{FAE04EC0-301F-11D3-BF4B-00C04F79EFBC}") = "App", "src\\App\\App.csproj", "{7D2C3E0A-1B5F-4C8E-9A6D-2F4B8C1E3D5A}"
            EndProject
            Global
            \tGlobalSection(SolutionConfigurationPlatforms) = preSolution
            \t\tDebug|Any CPU = Debug|Any CPU
            \tEndGlobalSection
            \tGlobalSection(ProjectConfigurationPlatforms) = postSolution
            \t\t{7D2C3E0A-1B5F-4C8E-9A6D-2F4B8C1E3D5A}.Debug|Any CPU.ActiveCfg = Debug|Any CPU
            \t\t{7D2C3E0A-1B5F-4C8E-9A6D-2F4B8C1E3D5A}.Debug|Any CPU.Build.0 = Debug|Any CPU
            \tEndGlobalSection
            EndGlobal
            """;

    // ---------------------------------------------------------------- TS-011

    @Given("a directory containing {string}")
    public void aDirectoryContaining(String marker) {
        boolean dotnet = marker.endsWith(".sln") || marker.endsWith(".csproj");
        if (dotnet) {
            LegacyDotnet.requireAnalyzer();
        }
        Path dir = LegacyDotnet.scratch("marker-" + marker);
        switch (marker) {
            case "project.sln" -> {
                LegacyDotnet.write(dir.resolve(marker), SLN);
                LegacyDotnet.write(dir.resolve("src/App/App.csproj"), CSPROJ);
                LegacyDotnet.write(dir.resolve("src/App/Greeter.cs"), CS_CLASS);
            }
            case "app.csproj" -> {
                LegacyDotnet.write(dir.resolve(marker), CSPROJ);
                LegacyDotnet.write(dir.resolve("Greeter.cs"), CS_CLASS);
            }
            case "pom.xml" -> {
                LegacyDotnet.write(dir.resolve(marker), POM);
                LegacyDotnet.write(dir.resolve("src/main/java/demo/Greeter.java"), JAVA_CLASS);
            }
            case "build.gradle" -> {
                LegacyDotnet.write(dir.resolve(marker), "plugins {\n    id 'java'\n}\n");
                LegacyDotnet.write(dir.resolve("src/main/java/demo/Greeter.java"), JAVA_CLASS);
            }
            default -> throw new AssertionError("unsupported marker in the examples: " + marker);
        }
        LegacyWorld.project = dir;
        LegacyWorld.data.put("expectedComponent", dotnet ? "Demo.Greeter" : "demo.Greeter");
        LegacyWorld.data.put("sourceExtension", dotnet ? ".cs" : ".java");
    }

    @When("the analysis is invoked without specifying a language")
    public void theAnalysisIsInvokedWithoutSpecifyingALanguage() {
        theAnalysisIsInvoked();
        assertNull(LegacyWorld.error, "analysis failed: " + LegacyWorld.error);
    }

    @Then("the system automatically uses the {string} analyzer")
    public void theSystemAutomaticallyUsesTheAnalyzer(String analyzer) {
        String source = LegacyWorld.run.graph().path("meta").path("source").asText();
        switch (analyzer) {
            case ".NET" -> {
                assertEquals(ProjectType.DOTNET, new ProjectTypeDetector().detect(LegacyWorld.project));
                assertTrue(source.startsWith("roslyn"), "meta.source of a .NET analysis: " + source);
            }
            case "Java" -> {
                assertEquals(ProjectType.JAVA, new ProjectTypeDetector().detect(LegacyWorld.project));
                assertEquals("spoon", source, "meta.source of a Java analysis");
            }
            default -> throw new AssertionError("unknown analyzer " + analyzer);
        }
    }

    @Then("the result is a valid DependencyGraph for the detected project type")
    public void theResultIsAValidDependencyGraphForTheDetectedType() {
        LegacyDotnet.assertValid(SchemaRegistry.DEPENDENCY_GRAPH, LegacyWorld.run.graphJson(), "graph");
        String expected = LegacyWorld.get("expectedComponent");
        String extension = LegacyWorld.get("sourceExtension");
        JsonNode component = LegacyWorld.run.component(expected);
        assertTrue(component.path("files").path(0).asText().endsWith("Greeter" + extension),
                "file of " + expected + ": " + component.path("files"));
        assertEquals(List.of(expected), LegacyWorld.run.componentIds(), "components");
    }

    // ---------------------------------------------------------------- TS-012

    @Given("a directory that contains {string} or {string} but no {string} or {string} files")
    public void aDirectoryWithOnlyJavaMarkers(String pom, String gradle, String sln, String csproj) {
        Path project = LegacyDotnet.demo("java-standar");
        assertTrue(Files.exists(project.resolve(pom)) || Files.exists(project.resolve(gradle)),
                project + " must contain " + pom + " or " + gradle);
        assertFalse(LegacyDotnet.hasRootFile(project, sln) || LegacyDotnet.hasRootFile(project, csproj),
                project + " must not contain " + sln + " or " + csproj + " files");
        LegacyWorld.project = project;
    }

    @When("the analysis is invoked")
    public void theAnalysisIsInvoked() {
        assertTrue(LegacyWorld.project != null, "no project selected by a previous step");
        try {
            LegacyWorld.run = LegacyDotnet.analyzeFresh(LegacyWorld.project);
        } catch (RuntimeException e) {
            LegacyWorld.error = e;
        }
    }

    @Then("the system automatically uses the Java analyzer")
    public void theSystemAutomaticallyUsesTheJavaAnalyzer() {
        assertNull(LegacyWorld.error, "analysis failed: " + LegacyWorld.error);
        theSystemAutomaticallyUsesTheAnalyzer("Java");
    }

    @Then("the behavior is identical to the current version")
    public void theBehaviorIsIdenticalToTheCurrentVersion() {
        Map<String, String> baseline = RegressionBaselines.load("java-standar");
        assertEquals(baseline.get(DemoOutputs.GRAPH), LegacyWorld.run.graphJson(), DemoOutputs.GRAPH);
        assertEquals(baseline.get(DemoOutputs.ARCHITECTURE), LegacyWorld.run.architectureJson(),
                DemoOutputs.ARCHITECTURE);
        assertEquals(baseline.get(DemoOutputs.ENTRYPOINTS), LegacyWorld.run.entrypointsJson(),
                DemoOutputs.ENTRYPOINTS);
    }

    // ---------------------------------------------------------------- TS-013

    @Given("a directory that contains both {string} and {string} files")
    public void aDirectoryWithBothMarkers(String csproj, String pom) {
        Path dir = LegacyDotnet.scratch("mixed");
        LegacyDotnet.write(dir.resolve("app" + csproj), CSPROJ);
        LegacyDotnet.write(dir.resolve("Greeter.cs"), CS_CLASS);
        LegacyDotnet.write(dir.resolve(pom), POM);
        LegacyDotnet.write(dir.resolve("src/main/java/demo/Greeter.java"), JAVA_CLASS);
        LegacyWorld.project = dir;
    }

    @Then("the system reports an AMBIGUOUS project type error")
    public void theSystemReportsAnAmbiguousError() {
        assertEquals(ProjectType.AMBIGUOUS, new ProjectTypeDetector().detect(LegacyWorld.project));
        assertTrue(LegacyWorld.error instanceof IllegalArgumentException,
                "expected an IllegalArgumentException, got " + LegacyWorld.error);
        assertTrue(LegacyWorld.error.getMessage().startsWith("Ambiguous project type"),
                "message: " + LegacyWorld.error.getMessage());
    }

    @Then("the error message instructs the user to specify the target language explicitly")
    public void theErrorMessageInstructsToSpecifyTheLanguage() {
        String message = LegacyWorld.error.getMessage();
        assertTrue(message.contains("specify the target language explicitly"), "message: " + message);
        assertTrue(message.contains("language=java|dotnet"), "message must name the option: " + message);
    }

    // ---------------------------------------------------------------- TS-014

    @Given("a directory that contains neither Java nor .NET marker files")
    public void aDirectoryWithoutMarkers() {
        Path dir = LegacyDotnet.scratch("no-markers");
        LegacyDotnet.write(dir.resolve("notes.txt"), "No build files here.\n");
        assertEquals(ProjectType.UNKNOWN, new ProjectTypeDetector().detect(dir));
        LegacyWorld.project = dir;
    }

    @Then("the system returns a clear error indicating no recognized project type was found")
    public void theSystemReturnsAnUnknownError() {
        assertTrue(LegacyWorld.error != null, "expected an error for a directory without project markers, but "
                + "the analysis succeeded (Java fallback) with " + LegacyWorld.run.componentIds().size()
                + " components and warnings " + LegacyWorld.run.warnings());
        String message = String.valueOf(LegacyWorld.error.getMessage()).toLowerCase();
        assertTrue(message.contains("no recognized") || message.contains("unknown project type"),
                "message: " + LegacyWorld.error.getMessage());
    }

    @Then("the error message lists the supported marker files")
    public void theErrorMessageListsTheSupportedMarkers() {
        String message = LegacyWorld.error.getMessage();
        for (String marker : List.of(".sln", ".csproj", "pom.xml", "build.gradle")) {
            assertTrue(message.contains(marker), "message must list " + marker + ": " + message);
        }
    }

    // ---------------------------------------------------------------- TS-015

    @Given("a .NET Framework project \\(not .NET Core) with a {string} targeting {string} or earlier")
    public void aDotNetFrameworkProject(String extension, String framework) {
        LegacyDotnet.requireAnalyzer();
        Path project = LegacyDotnet.fixture("netfx48");
        List<Path> projects = LegacyDotnet.sources(project, extension);
        assertEquals(1, projects.size(), extension + " files: " + projects);
        String csproj = LegacyDotnet.read(projects.get(0));
        assertTrue(csproj.contains("<TargetFrameworkVersion>v4.8</TargetFrameworkVersion>"),
                "fixture must target " + framework);
        assertFalse(csproj.contains("Sdk=\""), "fixture must be a classic (non-SDK) .NET Framework project");
        LegacyWorld.project = project;
    }

    @Then("the system successfully analyzes the project using the .NET analyzer")
    public void theSystemAnalyzesTheProjectUsingTheDotNetAnalyzer() {
        assertNull(LegacyWorld.error, "analysis failed: " + LegacyWorld.error);
        assertEquals(ProjectType.DOTNET, new ProjectTypeDetector().detect(LegacyWorld.project));
        String source = LegacyWorld.run.graph().path("meta").path("source").asText();
        assertTrue(source.startsWith("roslyn"), "meta.source: " + source);
        assertEquals(List.of("LegacyPayroll.Domain.Employee", "LegacyPayroll.Domain.EmployeeRepository",
                "LegacyPayroll.Domain.PayrollService"), LegacyWorld.run.componentIds().stream().sorted().toList(),
                "components of the .NET Framework project");
    }

    @Then("the result contains a valid DependencyGraph")
    public void theResultContainsAValidDependencyGraph() {
        LegacyDotnet.assertValid(SchemaRegistry.DEPENDENCY_GRAPH, LegacyWorld.run.graphJson(), "graph");
        String service = "LegacyPayroll.Domain.PayrollService";
        boolean edge = false;
        for (JsonNode e : LegacyWorld.run.graph().path("edges")) {
            edge |= service.equals(e.path("from").asText())
                    && "LegacyPayroll.Domain.EmployeeRepository".equals(e.path("to").asText());
        }
        assertTrue(edge, "dependency PayrollService -> EmployeeRepository missing");
    }
}
