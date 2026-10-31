package com.extractor.enginedebtbdd;

import com.extractor.legacybdd.dotnet.LegacyDotnet;
import com.extractor.legacybdd.dotnet.LegacyWorld;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Steps of {@code specs/014b-engine-debt/tests/features/bugfix_BUG-008.feature} (file enumeration order independent
 * of the file system). Own glue package (011 TS-006) reusing the 002 helpers {@link LegacyDotnet} / {@link LegacyWorld}.
 */
public class EngineDebtSteps {

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

}
