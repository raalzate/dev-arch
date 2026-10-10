package com.extractor.legacybdd.mcp;

import com.extractor.schema.DemoOutputs;
import com.extractor.testsupport.RegressionBaselines;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** US-004 (TS-020, TS-021): command-line compatibility of the single artifact. */
public class CliCompatibilitySteps {

    /** Demo project with a stored output baseline of the previous release. */
    private static final String PROJECT = "java-standar";
    /** A usage line of the command-line mode: program followed by two positional placeholders. */
    private static final Pattern CLI_USAGE = Pattern.compile("(?im)^.*\\b(uso|usage)\\b.*<[^>]+>\\s+<[^>]+>");
    /** A usage line of the server mode. */
    private static final Pattern MCP_USAGE = Pattern.compile("(?im)^.*\\s--mcp\\b.*$");

    @When("executed with the original CLI arguments {string}")
    public void executedWithOriginalArguments(String template) {
        // Hermetic copy the baseline of the previous release was produced from (${REPO} placeholder root).
        Path project = DemoOutputs.projectDir(PROJECT);
        World.cliOut = Support.newDir("ts020-");
        List<String> args = new ArrayList<>();
        for (String token : template.trim().split("\\s+")) {
            switch (token) {
                case "<project-path>" -> args.add(project.toString());
                case "<output-file>" -> args.add(World.cliOut.resolve("output.json").toString());
                default -> throw new AssertionError("unknown placeholder " + token);
            }
        }
        World.run = Support.run(Support.jarCommand(args), World.cliOut, Duration.ofMinutes(5));
    }

    @Then("it produces the same JSON files with the same content as the previous CLI version")
    public void sameAsPreviousVersion() {
        assertEquals(0, World.run.exitCode(), World.run.all());
        Map<String, String> baseline = RegressionBaselines.load(PROJECT);
        for (String document : Support.DOCUMENTS) {
            assertEquals(baseline.get(document), Support.read(World.cliOut.resolve(document)),
                    document + " differs from the previous release (baseline " + RegressionBaselines.dir(PROJECT)
                            + ")");
        }
    }

    @When("executed without arguments or with {string}")
    public void executedWithoutArgumentsOrHelp(String flag) {
        Path dir = Support.newDir("ts021-");
        World.runs = List.of(Support.run(Support.jarCommand(List.of()), dir, Duration.ofMinutes(1)),
                Support.run(Support.jarCommand(List.of(flag)), dir, Duration.ofMinutes(1)));
    }

    @Then("it displays usage instructions for both CLI mode and MCP mode")
    public void displaysUsage() {
        for (Support.Run run : World.runs) {
            String out = run.all();
            assertTrue(CLI_USAGE.matcher(out).find(), "no CLI usage in: " + out);
            assertTrue(MCP_USAGE.matcher(out).find(), "no MCP usage in: " + out);
            assertFalse(out.contains("\"jsonrpc\""), "must not start the server: " + out);
            assertFalse(out.contains("\tat "), "usage must not be an exception: " + out);
        }
    }
}
