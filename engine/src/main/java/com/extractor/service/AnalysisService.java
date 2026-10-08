package com.extractor.service;

import com.extractor.inference.ConsolidatedArchitecture;
import com.extractor.inference.MicroserviceProposal;
import com.extractor.inference.config.InferenceConfig;
import com.extractor.model.Component;
import com.extractor.model.DependencyGraph;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

/**
 * Shared core service that orchestrates the analysis pipeline.
 * Both CLI and MCP adapters delegate to this service (Constitution II).
 * Facade over {@link ExtractionService} and {@link InferenceService}
 * (008-configurable-inference, FR-002). Creates fresh analyzers per
 * invocation.
 */
public final class AnalysisService {

    /** Extraction stage. */
    private final ExtractionService extraction = new ExtractionService();

    /** Inference stage. */
    private final InferenceService inference = new InferenceService();

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
        return analyzeProject(projectRoot, options, listener,
                InferenceConfig.defaults());
    }

    /**
     * Runs the full analysis pipeline with an inference configuration
     * (008, FR-006, FR-007). Only default-configuration analyses are reused
     * (FR-011).
     *
     * @param projectRoot project directory
     * @param options     analysis options (language)
     * @param listener    receives DETECTION, EXTRACTION and INFERENCE
     * @param config      inference configuration
     * @return the analysis result
     * @throws Exception when the analysis fails
     */
    public AnalysisResult analyzeProject(final Path projectRoot,
            final AnalysisOptions options,
            final AnalysisProgressListener listener,
            final InferenceConfig config) throws Exception {
        validateProjectPath(projectRoot);
        if (cache == null || !config.isDefault()) {
            return compute(projectRoot, options, listener, config);
        }
        AnalysisCache.Lookup lookup = cache.lookup(projectRoot,
                options.language(),
                () -> compute(projectRoot, options, listener, config));
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
     * @param config      inference configuration
     * @return the analysis result
     * @throws Exception when the analysis fails
     */
    private AnalysisResult compute(final Path projectRoot,
            final AnalysisOptions options,
            final AnalysisProgressListener listener,
            final InferenceConfig config) throws Exception {
        ExtractionResult extracted = extraction.extract(projectRoot, options,
                config.detection(), listener);
        listener.onPhase(AnalysisPhase.INFERENCE);
        ConsolidatedArchitecture architecture =
                inference.infer(InferenceInput.of(extracted), config);
        DependencyGraph dependencyGraph = extracted.graph();
        return new AnalysisResult(dependencyGraph, architecture,
                dependencyGraph.getApiContracts(), extracted.warnings());
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
        return extraction.graph(projectRoot, options,
                InferenceConfig.defaults().detection());
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
        InferenceConfig config = InferenceConfig.defaults();
        ExtractionResult extracted = extraction.extract(projectRoot, options,
                config.detection(), AnalysisProgressListener.NOOP);
        return filterByViability(
                inference.infer(InferenceInput.of(extracted), config),
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
                : extraction.graph(projectRoot, options,
                        InferenceConfig.defaults().detection());
        return graph.getComponents().stream()
                .map(Component::getId)
                .sorted()
                .toList();
    }

    /**
     * Re-infers the architecture of a stored graph (008, FR-012).
     *
     * @param graph        the stored graph
     * @param config       inference configuration
     * @param minViability "Alta", "Media", "Baja" or null for all
     * @return the architecture
     */
    public ConsolidatedArchitecture reinfer(final LoadedGraph graph,
            final InferenceConfig config, final String minViability) {
        if (minViability != null && viabilityLevel(minViability) == 0) {
            throw new IllegalArgumentException("Invalid minViability '"
                    + minViability + "'. Allowed: Alta, Media, Baja");
        }
        return filterByViability(inference.infer(graph.input(), config),
                minViability);
    }

    /**
     * Scores a user-edited proposal over a stored graph (008, FR-018).
     *
     * @param graph      the stored graph
     * @param components component ids of the proposal
     * @param config     inference configuration
     * @return the score
     */
    public ProposalScore scoreProposal(final LoadedGraph graph,
            final List<String> components, final InferenceConfig config) {
        return new ProposalScorer().score(graph.graph(), components, config);
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
