package com.extractor.legacybdd.dotnet;

import com.fasterxml.jackson.databind.JsonNode;
import io.cucumber.java.After;
import io.cucumber.java.Before;

import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Per-scenario state shared by the 002 step classes (reset before every scenario). */
public class LegacyWorld {

    /** Project under analysis. */
    public static Path project;
    /** Engine analysis of {@link #project} (When step). */
    public static LegacyDotnet.EngineRun run;
    /** Raw analyzer run of {@link #project}, when the scenario inspects the analyzer diagnostics. */
    public static LegacyDotnet.RawRun rawRun;
    /** Whether the When step must also capture the raw analyzer diagnostics. */
    public static boolean captureDiagnostics;
    /** Failure of the When step, when the scenario expects one. */
    public static Throwable error;
    /** Wall-clock time of the When step. */
    public static Duration elapsed;
    /** Free-form scenario data (expected values derived from the fixture sources). */
    public static Map<String, Object> data = new LinkedHashMap<>();
    /** Tool responses (MCP) by tool name. */
    public static Map<String, JsonNode> responses = new LinkedHashMap<>();
    /** Resources to close after the scenario. */
    public static List<AutoCloseable> closeables = new ArrayList<>();

    @Before
    public void reset() {
        project = null;
        run = null;
        rawRun = null;
        captureDiagnostics = false;
        error = null;
        elapsed = null;
        data = new LinkedHashMap<>();
        responses = new LinkedHashMap<>();
        closeables = new ArrayList<>();
    }

    @After
    public void close() throws Exception {
        for (AutoCloseable closeable : closeables) {
            closeable.close();
        }
        closeables.clear();
    }

    @SuppressWarnings("unchecked")
    public static <T> T get(String key) {
        Object value = data.get(key);
        if (value == null) {
            throw new AssertionError("scenario data '" + key + "' was not set by a previous step");
        }
        return (T) value;
    }
}
