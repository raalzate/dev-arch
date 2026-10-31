package com.extractor.analyzer;

import com.extractor.model.DependencyGraph;
import com.extractor.model.SchemaVersion;
import com.extractor.utils.DependencyResolver;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import com.extractor.inference.config.AnalysisConfig;
import com.extractor.inference.config.DataAccessConfig;
import com.extractor.inference.config.DebtConfig;
import com.extractor.inference.config.DependenciesConfig;
import com.extractor.inference.config.IntegrationsConfig;
import com.extractor.inference.config.InferenceConfig;
import java.nio.file.Files;
import java.util.LinkedHashMap;
import java.util.Map;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

/**
 * Bridges Java and the .NET Roslyn analyzer by invoking the dotnet-analyzer
 * executable as a subprocess and deserializing its JSON output into a
 * {@link DependencyGraph}.
 * <p>
 * Implements {@link LanguageAnalyzer} so it can be used interchangeably with
 * {@link JavaSpoonAnalyzer}.
 */
public class DotNetBridgeAnalyzer implements LanguageAnalyzer {

    private static final Logger logger = LoggerFactory.getLogger(DotNetBridgeAnalyzer.class);
    /** Default subprocess timeout (shared with ExtractionService, 020). */
    public static final Duration DEFAULT_TIMEOUT = Duration.ofMinutes(5);
    /** Prefix of a user warning line on the analyzer's stderr (009). */
    private static final String WARNING_PREFIX = "[warning] ";

    private final DotNetToolLocator locator;
    private final Duration timeout;
    private final ObjectMapper objectMapper;
    /** Non-fatal warnings of the last parse (FR-022). */
    private final List<String> warnings = new ArrayList<>();
    private final DataAccessConfig dataAccess;
    private final DebtConfig debt;
    private final IntegrationsConfig integrations;
    private final DependenciesConfig dependencies;
    private final AnalysisConfig analysis;

    /**
     * Writes the analyzer section of the configuration to a temporary file (020, research D3), or returns null
     * when the defaults apply.
     */
    private Path writeConfigIfNeeded() throws IOException {
        boolean sendDataAccess = dataAccess != null && dataAccess.affectsAnalyzer();
        boolean sendDebt = debt != null && debt.affectsAnalyzer();
        boolean sendIntegrations = integrations != null && integrations.affectsAnalyzer();
        boolean sendDependencies = dependencies != null && dependencies.affectsAnalyzer();
        boolean sendAnalysis = analysis != null && analysis.affectsAnalyzer();
        if (!sendDataAccess && !sendDebt && !sendIntegrations && !sendDependencies && !sendAnalysis) {
            return null;
        }
        Map<String, Object> root = new LinkedHashMap<>();
        if (sendDataAccess) {
            Map<String, Object> section = new LinkedHashMap<>();
            section.put("procedures", dataAccess.procedures());
            section.put("procedureCatalog", dataAccess.procedureCatalog() == null ? null
                    : Path.of(dataAccess.procedureCatalog()).toAbsolutePath().normalize().toString());
            section.put("catalogMode", dataAccess.catalogMode());
            root.put("dataAccess", section);
        }
        if (sendDebt) {
            Map<String, Object> godClass = new LinkedHashMap<>();
            godClass.put("minLoc", debt.godClass().minLoc());
            godClass.put("minComplexity", debt.godClass().minComplexity());
            Map<String, Object> section = new LinkedHashMap<>();
            section.put("enabled", debt.enabled());
            section.put("godClass", godClass);
            root.put("debt", section);
        }
        if (sendIntegrations) {
            Map<String, Object> section = new LinkedHashMap<>();
            section.put("outbound", integrations.outbound());
            root.put("integrations", section);
        }
        if (sendDependencies) {
            Map<String, Object> section = new LinkedHashMap<>();
            section.put("enabled", dependencies.enabled());
            section.put("eol", dependencies.eol());
            root.put("dependencies", section);
        }
        if (sendAnalysis) {
            Map<String, Object> section = new LinkedHashMap<>();
            section.put("extended", analysis.extended());
            section.put("rules", analysis.rules());
            section.put("duplicateMinTokens", analysis.duplicateMinTokens());
            section.put("sarif", analysis.sarif());
            section.put("layerSuppressions", analysis.layerSuppressions());
            section.put("referenceAssemblies", analysis.referenceAssemblies() == null ? null
                    : Path.of(analysis.referenceAssemblies()).toAbsolutePath().normalize().toString());
            root.put("analysis", section);
        }
        Path file = Files.createTempFile("dev-arch-analyzer-config-", ".json");
        objectMapper.writeValue(file.toFile(), root);
        return file;
    }

    private static void deleteQuietly(Path file) {
        if (file != null) {
            try {
                Files.deleteIfExists(file);
            } catch (IOException e) {
                logger.debug("Could not delete {}: {}", file, e.getMessage());
            }
        }
    }

    /**
     * Creates a new analyzer that uses the given locator to find the dotnet-analyzer executable.
     *
     * @param locator the tool locator for finding the dotnet-analyzer executable
     */
    public DotNetBridgeAnalyzer(DotNetToolLocator locator) {
        this(locator, DEFAULT_TIMEOUT);
    }

    /**
     * Creates a new analyzer with an explicit subprocess timeout.
     *
     * @param locator the tool locator for finding the dotnet-analyzer executable
     * @param timeout maximum wall-clock time the subprocess may run
     */
    public DotNetBridgeAnalyzer(DotNetToolLocator locator, Duration timeout) {
        this(locator, timeout, InferenceConfig.defaults().dataAccess());
    }

    /**
     * Bridge with data access parameters (020): when they differ from the defaults the analyzer receives them
     * through a temporary {@code --config=<file>}; otherwise the command line is exactly the historical one.
     *
     * @param locator    locates the dotnet-analyzer executable
     * @param timeout    maximum wall-clock time the subprocess may run
     * @param dataAccess data access parameters
     */
    public DotNetBridgeAnalyzer(DotNetToolLocator locator, Duration timeout, DataAccessConfig dataAccess) {
        this(locator, timeout, dataAccess, InferenceConfig.defaults().debt());
    }

    /**
     * Bridge with the data access and debt sections (021).
     *
     * @param locator    locates the dotnet-analyzer executable
     * @param timeout    maximum wall-clock time the subprocess may run
     * @param dataAccess data access parameters
     * @param debt       legacy debt rule parameters
     */
    public DotNetBridgeAnalyzer(DotNetToolLocator locator, Duration timeout, DataAccessConfig dataAccess,
            DebtConfig debt) {
        this(locator, timeout, dataAccess, debt, InferenceConfig.defaults().integrations(),
                InferenceConfig.defaults().dependencies());
    }

    /**
     * Bridge with every analyzer section (022).
     *
     * @param locator      locates the dotnet-analyzer executable
     * @param timeout      maximum wall-clock time the subprocess may run
     * @param dataAccess   data access parameters
     * @param debt         legacy debt rule parameters
     * @param integrations outbound integration parameters
     * @param dependencies external dependency parameters
     */
    public DotNetBridgeAnalyzer(DotNetToolLocator locator, Duration timeout, DataAccessConfig dataAccess,
            DebtConfig debt, IntegrationsConfig integrations, DependenciesConfig dependencies) {
        this(locator, timeout, dataAccess, debt, integrations, dependencies,
                InferenceConfig.defaults().analysis());
    }

    /**
     * Bridge with every analyzer section including the extended analysis (024).
     *
     * @param locator      locates the dotnet-analyzer executable
     * @param timeout      maximum wall-clock time the subprocess may run
     * @param dataAccess   data access parameters
     * @param debt         legacy debt rule parameters
     * @param integrations outbound integration parameters
     * @param dependencies external dependency parameters
     * @param analysis     extended analysis parameters
     */
    public DotNetBridgeAnalyzer(DotNetToolLocator locator, Duration timeout, DataAccessConfig dataAccess,
            DebtConfig debt, IntegrationsConfig integrations, DependenciesConfig dependencies,
            AnalysisConfig analysis) {
        this.analysis = analysis;
        this.locator = locator;
        this.timeout = timeout;
        this.dataAccess = dataAccess;
        this.debt = debt;
        this.integrations = integrations;
        this.dependencies = dependencies;
        this.objectMapper = new ObjectMapper();
        this.objectMapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    }

    /**
     * Analyze a .NET project by invoking the dotnet-analyzer subprocess.
     *
     * @param projectRoot root directory of the .NET project
     * @return the computed dependency graph
     * @throws Exception if the subprocess fails or output cannot be parsed
     */
    @Override
    public DependencyGraph analyzeProject(Path projectRoot) throws Exception {
        Path executablePath = locator.locate();
        logger.info("Running dotnet-analyzer: {} {}", executablePath, projectRoot);

        List<String> command = new ArrayList<>(List.of(executablePath.toString(), projectRoot.toString()));
        Path configFile = writeConfigIfNeeded();
        if (configFile != null) {
            command.add("--config=" + configFile);
        }
        ProcessBuilder pb = new ProcessBuilder(command);
        pb.redirectErrorStream(false);

        Process process;
        try {
            process = pb.start();
        } catch (IOException e) {
            deleteQuietly(configFile);
            throw e;
        }
        try {
            return analyze(process, configFile);
        } finally {
            deleteQuietly(configFile);
        }
    }

    private DependencyGraph analyze(Process process, Path configFile) throws Exception {
        process.getOutputStream().close();

        // Drain both streams concurrently so a full stderr pipe cannot block stdout (BUG-002)
        CompletableFuture<String> stdoutFuture = drain(process.getInputStream());
        CompletableFuture<String> stderrFuture = drain(process.getErrorStream());

        boolean finished = process.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS);
        if (!finished) {
            process.descendants().forEach(ProcessHandle::destroyForcibly);
            process.destroyForcibly();
            throw new RuntimeException(
                    "dotnet-analyzer timed out after " + timeout.toSeconds() + " seconds");
        }

        String stdout = stdoutFuture.join();
        String stderr = stderrFuture.join();

        int exitCode = process.exitValue();
        if (exitCode != 0) {
            throw new RuntimeException(
                    "dotnet-analyzer exited with code " + exitCode + ": " + stderr);
        }

        logger.info("dotnet-analyzer completed successfully, parsing output ({} chars)", stdout.length());
        if (!stderr.isEmpty()) {
            logger.debug("dotnet-analyzer stderr: {}", stderr);
        }

        DependencyGraph graph = parseOutput(stdout);
        collectUserWarnings(stderr);
        return graph;
    }

    /**
     * Adds the user warnings of the .NET analyzer to {@link #getWarnings()}:
     * each stderr line starting with exactly {@value #WARNING_PREFIX}, in
     * order, without duplicates (009-vb-legacy-completion,
     * contracts/dotnet-warnings-channel.md). Diagnostic lines are ignored.
     *
     * @param stderr the standard error of a successful run
     */
    void collectUserWarnings(final String stderr) {
        for (String line : stderr.split("\n", -1)) {
            String text = line.endsWith("\r")
                    ? line.substring(0, line.length() - 1) : line;
            if (!text.startsWith(WARNING_PREFIX)) {
                continue;
            }
            String warning = text.substring(WARNING_PREFIX.length());
            if (!warning.isEmpty() && !warnings.contains(warning)) {
                warnings.add(warning);
            }
        }
    }

    private static CompletableFuture<String> drain(InputStream stream) {
        return CompletableFuture.supplyAsync(() -> {
            try (InputStream in = stream; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                in.transferTo(out);
                return out.toString(StandardCharsets.UTF_8);
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
        });
    }

    /**
     * Deserialize the JSON output from the dotnet-analyzer into a {@link DependencyGraph}.
     * <p>
     * Package-private for testability: unit tests can call this directly with sample JSON
     * without needing to spawn a subprocess.
     *
     * @param json the JSON string produced by the dotnet-analyzer
     * @return the deserialized dependency graph
     * @throws RuntimeException if the JSON is empty or malformed
     */
    DependencyGraph parseOutput(String json) {
        if (json == null || json.trim().isEmpty()) {
            throw new RuntimeException("dotnet-analyzer produced empty output");
        }

        try {
            JsonNode tree = objectMapper.readTree(json);
            DependencyGraph graph =
                    objectMapper.treeToValue(tree, DependencyGraph.class);
            reconcileSchemaVersion(tree, graph);
            return graph;
        } catch (JsonProcessingException e) {
            throw new RuntimeException(
                    "Failed to parse dotnet-analyzer JSON output: " + e.getMessage(), e);
        }
    }

    /**
     * Compares the contract version declared by the .NET analyzer with
     * the engine's (FR-022): a missing or different value is reported as
     * a warning naming both versions, and the engine version is emitted.
     *
     * @param tree  the raw .NET analyzer output
     * @param graph the deserialized graph
     */
    private void reconcileSchemaVersion(final JsonNode tree,
                                        final DependencyGraph graph) {
        JsonNode declared = tree.path("meta").path("schema_version");
        String dotnetVersion = declared.isTextual()
                ? declared.asText() : "absent";
        if (!SchemaVersion.CURRENT.equals(dotnetVersion)) {
            String warning = "dotnet-analyzer schema_version " + dotnetVersion
                    + " != engine " + SchemaVersion.CURRENT;
            logger.warn(warning);
            warnings.add(warning);
        }
        if (graph.getMeta() == null) {
            graph.setMeta(new DependencyGraph.Meta());
        }
        graph.getMeta().setSchemaVersion(SchemaVersion.CURRENT);
        if (graph.getApiContracts() == null) {
            graph.setApiContracts(new DependencyGraph.ApiContracts());
        }
        graph.getApiContracts().getMeta()
                .setSchemaVersion(SchemaVersion.CURRENT);
    }

    /**
     * Warnings collected while parsing the .NET analyzer output
     * (e.g. contract version mismatch).
     *
     * @return an unmodifiable view of the warnings
     */
    @Override
    public List<String> getWarnings() {
        return Collections.unmodifiableList(warnings);
    }

    /**
     * Return the .NET-specific dependency resolver that parses .csproj PackageReference elements.
     *
     * @return a {@link DotNetDependencyResolver}
     */
    @Override
    public DependencyResolver getDependencyResolver() {
        return new DotNetDependencyResolver();
    }
}
