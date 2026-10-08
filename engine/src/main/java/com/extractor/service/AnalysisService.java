package com.extractor.service;

import com.extractor.analyzer.DotNetBridgeAnalyzer;
import com.extractor.analyzer.DotNetToolLocator;
import com.extractor.analyzer.JavaSpoonAnalyzer;
import com.extractor.analyzer.LanguageAnalyzer;
import com.extractor.analyzer.ProjectType;
import com.extractor.analyzer.ProjectTypeDetector;
import com.extractor.inference.ConsolidatedArchitecture;
import com.extractor.inference.InferenceEngine;
import com.extractor.inference.MicroserviceCandidates;
import com.extractor.inference.MicroserviceProposal;
import com.extractor.inference.MicroserviceRecommendationEngine;
import com.extractor.model.Component;
import com.extractor.model.DependencyGraph;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URISyntaxException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Shared core service that orchestrates the analysis pipeline.
 * Both CLI and MCP adapters delegate to this service (Constitution II).
 * Creates fresh analyzers per invocation.
 */
public final class AnalysisService {

    /** Logger of the service. */
    private static final Logger LOGGER =
            LoggerFactory.getLogger(AnalysisService.class);

    /** Viability level of "Alta". */
    private static final int HIGH = 3;

    /** Viability level of "Media". */
    private static final int MEDIUM = 2;

    /** Viability level of "Baja". */
    private static final int LOW = 1;

    /** Reuse of unchanged projects (server mode only), or null. */
    private final AnalysisCache cache;

    /**
     * Service without reuse (command line and tests).
     */
    public AnalysisService() {
        this(null);
    }

    /**
     * Service that reuses analyses of unchanged projects (server mode).
     *
     * @param reuse cache of analyses, null for none
     */
    public AnalysisService(final AnalysisCache reuse) {
        this.cache = reuse;
    }

    /**
     * Reuse cache of the server mode.
     *
     * @return the cache, or null when reuse is disabled
     */
    public AnalysisCache reuseCache() {
        return cache;
    }

    /**
     * Runs the full analysis pipeline: dependency graph, architecture
     * proposals and API contracts, with automatic language detection.
     *
     * @param projectRoot project directory
     * @return the analysis result
     * @throws Exception when the analysis fails
     */
    public AnalysisResult analyzeProject(final Path projectRoot)
            throws Exception {
        return analyzeProject(projectRoot, AnalysisOptions.DEFAULT,
                AnalysisProgressListener.NOOP);
    }

    /**
     * Runs the full analysis pipeline reporting its phases.
     *
     * @param projectRoot project directory
     * @param options     analysis options (language)
     * @param listener    receives DETECTION, EXTRACTION and INFERENCE
     * @return the analysis result
     * @throws Exception when the analysis fails
     */
    public AnalysisResult analyzeProject(final Path projectRoot,
            final AnalysisOptions options,
            final AnalysisProgressListener listener) throws Exception {
        validateProjectPath(projectRoot);
        if (cache == null) {
            return compute(projectRoot, options, listener);
        }
        AnalysisCache.Lookup lookup = cache.lookup(projectRoot,
                options.language(),
                () -> compute(projectRoot, options, listener));
        if (!lookup.computed()) {
            listener.onPhase(AnalysisPhase.DETECTION);
            listener.onPhase(AnalysisPhase.EXTRACTION);
            listener.onPhase(AnalysisPhase.INFERENCE);
        }
        return lookup.result();
    }

    /**
     * Full analysis used by the derived views when reuse is enabled.
     *
     * @param projectRoot project directory
     * @param options     analysis options
     * @return the (possibly reused) result
     * @throws Exception when the analysis fails
     */
    private AnalysisResult reused(final Path projectRoot,
            final AnalysisOptions options) throws Exception {
        return analyzeProject(projectRoot, options,
                AnalysisProgressListener.NOOP);
    }

    /**
     * Computes a full analysis without validation or reuse.
     *
     * @param projectRoot project directory
     * @param options     analysis options
     * @param listener    phase listener
     * @return the analysis result
     * @throws Exception when the analysis fails
     */
    private AnalysisResult compute(final Path projectRoot,
            final AnalysisOptions options,
            final AnalysisProgressListener listener) throws Exception {
        listener.onPhase(AnalysisPhase.DETECTION);
        LanguageAnalyzer analyzer =
                createAnalyzer(projectRoot, options.language());
        listener.onPhase(AnalysisPhase.EXTRACTION);
        DependencyGraph dependencyGraph = analyzer.analyzeProject(projectRoot);
        List<String> warnings = new ArrayList<>(analyzer.getWarnings());
        if (dependencyGraph.getComponents().isEmpty()) {
            Path name = projectRoot.toAbsolutePath().normalize().getFileName();
            warnings.add("No analyzable source files found in '"
                    + (name == null ? "." : name) + "'");
        }
        listener.onPhase(AnalysisPhase.INFERENCE);
        ConsolidatedArchitecture architecture =
                infer(projectRoot, analyzer, dependencyGraph);
        return new AnalysisResult(dependencyGraph, architecture,
                dependencyGraph.getApiContracts(), warnings);
    }

    /**
     * Returns only the dependency graph for a project.
     *
     * @param projectRoot project directory
     * @return the dependency graph
     * @throws Exception when the analysis fails
     */
    public DependencyGraph getDependencyGraph(final Path projectRoot)
            throws Exception {
        return getDependencyGraph(projectRoot, AnalysisOptions.DEFAULT);
    }

    /**
     * Returns only the dependency graph for a project.
     *
     * @param projectRoot project directory
     * @param options     analysis options
     * @return the dependency graph
     * @throws Exception when the analysis fails
     */
    public DependencyGraph getDependencyGraph(final Path projectRoot,
            final AnalysisOptions options) throws Exception {
        if (cache != null) {
            return reused(projectRoot, options).getDependencyGraph();
        }
        validateProjectPath(projectRoot);
        return createAnalyzer(projectRoot, options.language())
                .analyzeProject(projectRoot);
    }

    /**
     * Returns architecture proposals, optionally filtered by minimum
     * viability.
     *
     * @param projectRoot  project directory
     * @param minViability "Alta", "Media", "Baja" or null for all
     * @return the architecture
     * @throws Exception when the analysis fails
     */
    public ConsolidatedArchitecture getArchitectureProposal(
            final Path projectRoot, final String minViability)
            throws Exception {
        return getArchitectureProposal(projectRoot, minViability,
                AnalysisOptions.DEFAULT);
    }

    /**
     * Returns architecture proposals, optionally filtered by minimum
     * viability.
     *
     * @param projectRoot  project directory
     * @param minViability "Alta", "Media", "Baja" or null for all
     * @param options      analysis options
     * @return the architecture
     * @throws Exception when the analysis fails
     */
    public ConsolidatedArchitecture getArchitectureProposal(
            final Path projectRoot, final String minViability,
            final AnalysisOptions options) throws Exception {
        if (cache != null) {
            return filterByViability(
                    reused(projectRoot, options).getArchitecture(),
                    minViability);
        }
        validateProjectPath(projectRoot);
        LanguageAnalyzer analyzer =
                createAnalyzer(projectRoot, options.language());
        DependencyGraph dependencyGraph = analyzer.analyzeProject(projectRoot);
        return filterByViability(infer(projectRoot, analyzer, dependencyGraph),
                minViability);
    }

    /**
     * Returns only the API contracts (endpoints and schemas) for a project.
     *
     * @param projectRoot project directory
     * @return the API contracts
     * @throws Exception when the analysis fails
     */
    public DependencyGraph.ApiContracts getApiContracts(
            final Path projectRoot) throws Exception {
        return getApiContracts(projectRoot, AnalysisOptions.DEFAULT);
    }

    /**
     * Returns only the API contracts (endpoints and schemas) for a project.
     *
     * @param projectRoot project directory
     * @param options     analysis options
     * @return the API contracts
     * @throws Exception when the analysis fails
     */
    public DependencyGraph.ApiContracts getApiContracts(
            final Path projectRoot, final AnalysisOptions options)
            throws Exception {
        return getDependencyGraph(projectRoot, options).getApiContracts();
    }

    /**
     * Returns metrics for a component identified by its qualified name.
     *
     * @param projectRoot project directory
     * @param componentId fully qualified type name
     * @return the component, or null if not found
     * @throws Exception when the analysis fails
     */
    public Component getComponentMetrics(final Path projectRoot,
            final String componentId) throws Exception {
        return getComponentMetrics(projectRoot, componentId,
                AnalysisOptions.DEFAULT);
    }

    /**
     * Returns metrics for a component identified by its qualified name.
     *
     * @param projectRoot project directory
     * @param componentId fully qualified type name
     * @param options     analysis options
     * @return the component, or null if not found
     * @throws Exception when the analysis fails
     */
    public Component getComponentMetrics(final Path projectRoot,
            final String componentId, final AnalysisOptions options)
            throws Exception {
        return getDependencyGraph(projectRoot, options).getComponents()
                .stream()
                .filter(c -> c.getId().equals(componentId))
                .findFirst()
                .orElse(null);
    }

    /**
     * Returns all component ids of the project (for error messages).
     *
     * @param projectRoot project directory
     * @return the sorted component ids
     * @throws Exception when the analysis fails
     */
    public List<String> getComponentIds(final Path projectRoot)
            throws Exception {
        return getComponentIds(projectRoot, AnalysisOptions.DEFAULT);
    }

    /**
     * Returns all component ids of the project (for error messages).
     *
     * @param projectRoot project directory
     * @param options     analysis options
     * @return the sorted component ids
     * @throws Exception when the analysis fails
     */
    public List<String> getComponentIds(final Path projectRoot,
            final AnalysisOptions options) throws Exception {
        DependencyGraph graph = cache != null
                ? reused(projectRoot, options).getDependencyGraph()
                : createAnalyzer(projectRoot, options.language())
                        .analyzeProject(projectRoot);
        return graph.getComponents().stream()
                .map(Component::getId)
                .sorted()
                .toList();
    }

    /**
     * Runs the inference and the consolidated recommendation.
     *
     * @param projectRoot     project directory
     * @param analyzer        analyzer that produced the graph
     * @param dependencyGraph the graph
     * @return the consolidated architecture
     */
    private static ConsolidatedArchitecture infer(final Path projectRoot,
            final LanguageAnalyzer analyzer,
            final DependencyGraph dependencyGraph) {
        MicroserviceCandidates candidates =
                new InferenceEngine().analyze(dependencyGraph);
        DependencyGraph.ApiContracts apiContracts =
                dependencyGraph.getApiContracts();
        Map<String, String> projectDeps =
                analyzer.getDependencyResolver().getAllDependencies();
        return new MicroserviceRecommendationEngine().analyzeConsolidated(
                candidates, dependencyGraph.getComponents(), projectDeps,
                projectRoot, apiContracts.getEndpoints());
    }

    /**
     * Creates the analyzer for the language choice; AUTO detects it from
     * marker files.
     *
     * @param projectRoot project directory
     * @param language    analyzer choice
     * @return the analyzer
     */
    private LanguageAnalyzer createAnalyzer(final Path projectRoot,
            final AnalysisLanguage language) {
        if (language == AnalysisLanguage.JAVA) {
            return new JavaSpoonAnalyzer();
        }
        if (language == AnalysisLanguage.DOTNET) {
            return createDotNetAnalyzer();
        }
        ProjectType projectType = new ProjectTypeDetector().detect(projectRoot);
        return switch (projectType) {
            case JAVA -> new JavaSpoonAnalyzer();
            case DOTNET -> createDotNetAnalyzer();
            case AMBIGUOUS -> throw new IllegalArgumentException(
                    "Ambiguous project type: found both Java and .NET markers"
                            + " in '" + projectRoot + "'. Please specify the"
                            + " target language explicitly"
                            + " (use language=java|dotnet).");
            case UNKNOWN -> {
                // Projects without marker files were always analyzed as Java
                // (Constitution I).
                LOGGER.info("No project type markers found in '{}', "
                        + "defaulting to Java analyzer", projectRoot);
                yield new JavaSpoonAnalyzer();
            }
        };
    }

    /**
     * Creates the .NET bridge analyzer next to the engine archive.
     *
     * @return the analyzer
     */
    private LanguageAnalyzer createDotNetAnalyzer() {
        return new DotNetBridgeAnalyzer(
                new DotNetToolLocator(getJarDirectory()));
    }

    /**
     * Directory of the engine archive (or classes directory).
     *
     * @return the directory, or the current directory when unknown
     */
    private Path getJarDirectory() {
        try {
            Path jarPath = Paths.get(AnalysisService.class
                    .getProtectionDomain().getCodeSource().getLocation()
                    .toURI());
            return jarPath.getParent();
        } catch (URISyntaxException | NullPointerException e) {
            LOGGER.debug("Could not resolve JAR directory, using current "
                    + "directory: {}", e.getMessage());
            return Path.of(".");
        }
    }

    /**
     * Rejects missing paths and files.
     *
     * @param projectRoot project directory
     */
    private void validateProjectPath(final Path projectRoot) {
        if (projectRoot == null) {
            throw new IllegalArgumentException(
                    "Project path must not be null");
        }
        if (!Files.exists(projectRoot)) {
            throw new IllegalArgumentException(
                    "Project path '" + projectRoot + "' does not exist");
        }
        if (!Files.isDirectory(projectRoot)) {
            throw new IllegalArgumentException(
                    "Project path '" + projectRoot + "' is not a directory");
        }
    }

    /**
     * Keeps the proposals with at least the given viability.
     *
     * @param architecture the architecture (not modified)
     * @param minViability "Alta", "Media", "Baja", or null/empty for all
     * @return the architecture itself or a filtered copy
     */
    static ConsolidatedArchitecture filterByViability(
            final ConsolidatedArchitecture architecture,
            final String minViability) {
        if (minViability == null || minViability.isEmpty()) {
            return architecture;
        }
        int minLevel = viabilityLevel(minViability);
        List<MicroserviceProposal> filtered = architecture.getProposals()
                .stream()
                .filter(p -> viabilityLevel(p.getViability()) >= minLevel)
                .toList();
        return new ConsolidatedArchitecture(
                architecture.getProjectMetadata(),
                filtered,
                architecture.getSupportLibraries(),
                architecture.getSummary());
    }

    /**
     * Numeric level of a viability label.
     *
     * @param viability label
     * @return 3, 2, 1 or 0 for unknown labels
     */
    private static int viabilityLevel(final String viability) {
        return switch (viability) {
            case "Alta" -> HIGH;
            case "Media" -> MEDIUM;
            case "Baja" -> LOW;
            default -> 0;
        };
    }
}
