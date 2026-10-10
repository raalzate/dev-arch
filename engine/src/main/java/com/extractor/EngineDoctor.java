package com.extractor;

import com.extractor.analyzer.DotNetToolLocator;
import com.extractor.model.SchemaVersion;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.net.URISyntaxException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.CodeSource;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Self-diagnosis of the engine: {@code java -jar engine.jar --doctor}
 * (012-install-doctor-docker).
 * <p>
 * Prints one JSON line with the engine version, the output schema version
 * and whether {@code dotnet-analyzer} is located exactly as an analysis
 * locates it ({@link DotNetToolLocator}). It never analyzes a project, so
 * analysis outputs and the MCP tools are unchanged.
 */
public final class EngineDoctor {

    /** Name of the engine in the report. */
    static final String ENGINE = "static-inference";

    private EngineDoctor() {
    }

    /**
     * Builds the report with a fixed key order.
     *
     * @param version the engine version
     * @param locator locator of the .NET analyzer
     * @return the report
     */
    public static Map<String, Object> report(final String version,
            final DotNetToolLocator locator) {
        Map<String, Object> analyzer = new LinkedHashMap<>();
        try {
            Path path = locator.locate();
            analyzer.put("found", Boolean.TRUE);
            analyzer.put("path", path.toString());
        } catch (IllegalStateException e) {
            analyzer.put("found", Boolean.FALSE);
            analyzer.put("path", null);
        }
        Map<String, Object> report = new LinkedHashMap<>();
        report.put("engine", ENGINE);
        report.put("version", version);
        report.put("schema_version", SchemaVersion.CURRENT);
        report.put("java_version", System.getProperty("java.version"));
        report.put("dotnet_analyzer", analyzer);
        return report;
    }

    /**
     * Renders the report as one JSON line.
     *
     * @param report the report
     * @return the JSON text
     * @throws JsonProcessingException when the report cannot be written
     */
    public static String toJson(final Map<String, Object> report)
            throws JsonProcessingException {
        return new ObjectMapper().writeValueAsString(report);
    }

    /**
     * Runs the diagnosis for this engine archive and prints it.
     *
     * @param version the engine version
     * @return the process exit code: 0, or 1 when the report cannot be
     *         written
     */
    public static int run(final String version) {
        Map<String, Object> report = report(version,
                new DotNetToolLocator(jarDirectory()));
        try {
            System.out.println(toJson(report));
            return 0;
        } catch (JsonProcessingException e) {
            System.err.println("[doctor] " + e.getMessage());
            return 1;
        }
    }

    /**
     * Directory of the running engine archive, as the analysis uses it.
     *
     * @return the directory, or the working directory when unknown
     */
    static Path jarDirectory() {
        CodeSource source = EngineDoctor.class.getProtectionDomain()
                .getCodeSource();
        if (source == null || source.getLocation() == null) {
            return Path.of(".");
        }
        try {
            Path parent = Paths.get(source.getLocation().toURI()).getParent();
            return parent == null ? Path.of(".") : parent;
        } catch (URISyntaxException | IllegalArgumentException e) {
            return Path.of(".");
        }
    }
}
