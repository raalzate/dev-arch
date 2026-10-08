package com.extractor.configbdd;

import com.extractor.analyzer.Detection;
import com.extractor.analyzer.ProjectType;
import com.extractor.analyzer.ProjectTypeDetector;
import com.extractor.schema.DemoOutputs;
import com.extractor.testsupport.DemoProjects;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Steps of detection.feature (US6, TS-033..TS-038, TS-048). */
public class DetectionSteps {

    private Path folder;
    private Detection detection;
    private String message;

    private static void touch(Path root, String relative) throws Exception {
        Path file = root.resolve(relative);
        Files.createDirectories(file.getParent());
        Files.writeString(file, relative.endsWith(".xml") ? "<project/>" : "");
    }

    @When("the project type of the demo project {string} is detected with the default configuration")
    public void detectDemoDefault(String project) {
        detection = new ProjectTypeDetector().detect(DemoOutputs.projectDir(project), 0);
    }

    @When("the project type of the demo project {string} is detected with {string} = {int}")
    public void detectDemo(String project, String parameter, int depth) {
        assertEquals("detection.maxDepth", parameter);
        detection = new ProjectTypeDetector().detect(DemoOutputs.projectDir(project), depth);
    }

    @Given("^a project folder without root markers containing (.*)$")
    public void folderWith(String markers) throws Exception {
        folder = Files.createDirectories(World.tmp.resolve("nested"));
        Matcher m = Pattern.compile("\"([^\"]+)\"").matcher(markers);
        List<String> files = new ArrayList<>();
        while (m.find()) {
            files.add(m.group(1));
        }
        assertFalse(files.isEmpty());
        for (String f : files) {
            touch(folder, f);
        }
    }

    @Given("a project folder with a root {string} and a nested {string}")
    public void folderWithRoot(String root, String nested) throws Exception {
        folder = Files.createDirectories(World.tmp.resolve("rooted"));
        touch(folder, root);
        touch(folder, nested);
    }

    @When("its project type is detected with {string} = {int}")
    public void detectFolder(String parameter, int depth) {
        assertEquals("detection.maxDepth", parameter);
        detection = new ProjectTypeDetector().detect(folder, depth);
        if (detection.type() == ProjectType.AMBIGUOUS) {
            message = detection.ambiguityMessage(folder);
        }
    }

    @Then("the detected type is {string}")
    public void detectedType(String type) {
        assertEquals(ProjectType.valueOf(type), detection.type());
    }

    @Then("no nested-marker warning is reported")
    public void noWarning() {
        assertNull(detection.warning());
    }

    @Then("the nested-marker warning lists {string}")
    public void warningLists(String modules) {
        assertTrue(detection.warning() != null && detection.warning().endsWith("): " + modules),
                String.valueOf(detection.warning()));
    }

    @Then("the detection fails with a message containing {string}")
    public void detectionFails(String text) {
        assertEquals(ProjectType.AMBIGUOUS, detection.type());
        assertTrue(message.contains(text), message);
    }

    @Then("the message lists {string} and {string}")
    public void messageLists(String a, String b) {
        assertTrue(message.contains("java: " + a) && message.contains("dotnet: " + b), message);
    }

    @Given("a copy of the demo project {string} moved into the subfolder {string} of an empty folder")
    public void nestedCopy(String project, String sub) throws Exception {
        folder = Files.createDirectories(World.tmp.resolve("wrapper"));
        DemoProjects.copy(project, Files.createDirectories(folder.resolve(sub)));
        Path copied = folder.resolve(sub).resolve(project);
        if (Files.isDirectory(copied)) {
            // DemoProjects.copy creates <target>/<project>: move the content up to <sub>
            try (var stream = Files.list(copied)) {
                for (Path p : stream.toList()) {
                    Files.move(p, folder.resolve(sub).resolve(p.getFileName()));
                }
            }
            Files.delete(copied);
        }
        World.inferenceTools = true;
    }

    @When("^that folder is analyzed with the analyze_project tool with the inline configuration (\\{.*\\})$")
    public void analyzeFolder(String config) {
        Support.mcpAnalyze(folder, Support.newDir("mcp"), Support.object(config), null);
    }

    @Then("the analysis succeeds with at least one component")
    public void succeeds() {
        assertFalse(Support.isError(World.result), Support.text(World.result));
        assertTrue(Support.json(World.analyses.get(World.analyses.size() - 1).get(0)).path("components").size() > 0);
    }
}
