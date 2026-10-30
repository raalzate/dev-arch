package com.extractor.analyzer;

import com.extractor.inference.config.DataAccessConfig;
import com.extractor.inference.config.InferenceConfig;
import com.extractor.model.DependencyGraph;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.DisabledOnOs;
import org.junit.jupiter.api.condition.OS;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;
import java.time.Duration;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 020 T017: the bridge adds --config only when the dataAccess section is not the default (TS-026, TS-027). */
@DisabledOnOs(OS.WINDOWS)
class DotNetBridgeConfigTest {

    private static final String GRAPH = "{\"components\":[],\"edges\":[],\"meta\":{\"source\":\"roslyn\",\"schema_version\":\"1.0.0\"}}";

    @TempDir
    Path tmp;

    private Path installFakeAnalyzer() throws IOException {
        Path bin = Files.createDirectories(tmp.resolve("bin"));
        Path exe = bin.resolve("dotnet-analyzer");
        Path log = bin.resolve("argv.log");
        Files.writeString(exe, "#!/usr/bin/env bash\nprintf '%s\\n' \"$@\" > '" + log + "'\n"
                + "for a in \"$@\"; do case \"$a\" in --config=*) cp \"${a#--config=}\" '" + log + ".config';; esac; done\n"
                + "printf '%s' '" + GRAPH + "'\n");
        Files.setPosixFilePermissions(exe, PosixFilePermissions.fromString("rwxr-xr-x"));
        return log;
    }

    private DependencyGraph run(DataAccessConfig dataAccess) throws Exception {
        Path project = Files.createDirectories(tmp.resolve("project"));
        DotNetBridgeAnalyzer bridge = new DotNetBridgeAnalyzer(
                new DotNetToolLocator(tmp.resolve("bin"), false), Duration.ofSeconds(30), dataAccess);
        return bridge.analyzeProject(project);
    }

    @Test
    void defaultDataAccessKeepsTheHistoricalCommandLine() throws Exception {
        Path log = installFakeAnalyzer();
        run(InferenceConfig.defaults().dataAccess());
        assertEquals(List.of(tmp.resolve("project").toString()), Files.readAllLines(log));
    }

    @Test
    void nonDefaultDataAccessPassesATemporaryConfigFileAndDeletesIt() throws Exception {
        Path log = installFakeAnalyzer();
        DataAccessConfig d = InferenceConfig.defaults().dataAccess();
        run(new DataAccessConfig(d.procedures(), "Catalog/procs.csv", "replace", 0.5, true));
        List<String> argv = Files.readAllLines(log);
        assertEquals(2, argv.size(), argv.toString());
        assertTrue(argv.get(1).startsWith("--config="), argv.get(1));
        JsonNode config = new ObjectMapper().readTree(Files.readString(Path.of(log + ".config")));
        assertEquals("replace", config.path("dataAccess").path("catalogMode").asText());
        assertEquals("auto", config.path("dataAccess").path("procedures").asText());
        assertTrue(Path.of(config.path("dataAccess").path("procedureCatalog").asText()).isAbsolute());
        assertFalse(config.path("dataAccess").has("procedureWeight"), "inference-only keys are not forwarded");
        assertFalse(Files.exists(Path.of(argv.get(1).substring("--config=".length()))), "temp file deleted");
    }
}
