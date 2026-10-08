package com.extractor.cli;

import com.extractor.testsupport.CliRunner;
import com.extractor.testsupport.DemoProjects;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 007-native-engine-runtime FR-024, FR-026, contracts/engine-mcp.md (CLI). */
class CliLanguageAndWarningsTest {

    private static final List<String> DOCS =
            List.of("output.json", "output_architecture.json", "output_entrypoints.json");

    @TempDir
    Path tmp;

    private static List<String> docs(Path dir) throws Exception {
        List<String> out = new ArrayList<>();
        for (String d : DOCS) {
            out.add(Files.readString(dir.resolve(d)));
        }
        return out;
    }

    private CliRunner.Result run(Path project, Path out, String... extra) throws Exception {
        Files.createDirectories(out);
        List<String> args = new ArrayList<>(List.of(project.toString(), out.resolve("output.json").toString()));
        args.addAll(List.of(extra));
        return CliRunner.run(out, args);
    }

    @Test
    void languageOptionsKeepOrSelectTheAnalyzer() throws Exception {
        Path project = DemoProjects.copy("java-standar", tmp);
        CliRunner.Result plain = run(project, tmp.resolve("plain"));
        assertEquals(0, plain.exitCode(), plain.stderr());
        for (String option : List.of("--language=auto", "--language=java")) {
            CliRunner.Result r = run(project, tmp.resolve(option.substring(11)), option);
            assertEquals(0, r.exitCode(), r.stderr());
            assertEquals(docs(tmp.resolve("plain")), docs(tmp.resolve(option.substring(11))), option);
        }
        assertFalse(plain.stderr().contains("[warning]"), plain.stderr());
    }

    @Test
    void ambiguousProjectIsResolvedWithDotnet() throws Exception {
        Path project = DemoProjects.copy("dotnet-ecommerce", tmp);
        Files.writeString(project.resolve("pom.xml"), "<project/>");
        CliRunner.Result auto = run(project, tmp.resolve("auto"));
        assertEquals(1, auto.exitCode());
        assertTrue(auto.stderr().contains("language=java|dotnet"), auto.stderr());
        CliRunner.Result dotnet = run(project, tmp.resolve("dotnet"), "--language=dotnet");
        assertEquals(0, dotnet.exitCode(), dotnet.stderr());
        assertTrue(Files.readString(tmp.resolve("dotnet/output.json")).contains("\"source\" : \"roslyn"));
    }

    @Test
    void invalidLanguageExitsWithoutWritingOutputs() throws Exception {
        Path project = DemoProjects.copy("java-standar", tmp);
        CliRunner.Result r = run(project, tmp.resolve("bad"), "--language=cobol");
        assertEquals(1, r.exitCode());
        assertTrue(r.stderr().contains("Invalid language 'cobol'. Allowed: java, dotnet, auto"), r.stderr());
        for (String d : DOCS) {
            assertFalse(Files.exists(tmp.resolve("bad").resolve(d)), d);
        }
    }

    @Test
    void warningsArePrintedToTheErrorOutputAfterWriting() throws Exception {
        Path project = tmp.resolve("docs-only");
        Files.createDirectories(project);
        Files.writeString(project.resolve("README.md"), "# readme");
        CliRunner.Result r = run(project, tmp.resolve("w"));
        assertEquals(0, r.exitCode(), r.stderr());
        assertTrue(r.stderr().lines().anyMatch(
                l -> l.equals("[warning] No analyzable source files found in 'docs-only'")), r.stderr());
        assertFalse(r.stdout().contains("[warning]"));
        assertTrue(Files.exists(tmp.resolve("w/output.json")));
    }
}
