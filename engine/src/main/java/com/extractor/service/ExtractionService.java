package com.extractor.service;

import com.extractor.analyzer.Detection;
import com.extractor.analyzer.DotNetBridgeAnalyzer;
import com.extractor.analyzer.DotNetToolLocator;
import com.extractor.analyzer.JavaSpoonAnalyzer;
import com.extractor.analyzer.LanguageAnalyzer;
import com.extractor.analyzer.ProjectTypeDetector;
import com.extractor.inference.config.DataAccessConfig;
import com.extractor.inference.config.InferenceConfig;
import com.extractor.inference.config.DebtConfig;
import com.extractor.inference.config.DependenciesConfig;
import com.extractor.inference.config.IntegrationsConfig;
import com.extractor.inference.config.DetectionConfig;
import com.extractor.model.DependencyGraph;
import com.extractor.model.SecretLocation;
import com.extractor.utils.SecretLocationScanner;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URISyntaxException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Extraction stage (008, FR-001, FR-003): project type detection, Spoon or
 * Roslyn analysis, declared dependencies and secret locations.
 */
public final class ExtractionService {

    /** Logger of the stage. */
    private static final Logger LOGGER =
            LoggerFactory.getLogger(ExtractionService.class);

    /**
     * Extracts the graph and the project-level data.
     *
     * @param projectRoot project directory (already validated)
     * @param options     analysis options (language)
     * @param detection   detection parameters
     * @param listener    receives DETECTION and EXTRACTION
     * @return the extraction result
     * @throws Exception when the analysis fails
     */
    public ExtractionResult extract(final Path projectRoot,
            final AnalysisOptions options, final DetectionConfig detection,
            final AnalysisProgressListener listener) throws Exception {
        return extract(projectRoot, options, detection,
                InferenceConfig.defaults().dataAccess(), listener);
    }

    /**
     * Extraction with data access parameters (020: forwarded to the .NET analyzer).
     *
     * @param projectRoot project directory (already validated)
     * @param options     analysis options (language)
     * @param detection   detection parameters
     * @param dataAccess  data access parameters
     * @param listener    receives DETECTION and EXTRACTION
     * @return the extraction result
     * @throws Exception when the analysis fails
     */
    public ExtractionResult extract(final Path projectRoot,
            final AnalysisOptions options, final DetectionConfig detection,
            final DataAccessConfig dataAccess,
            final AnalysisProgressListener listener) throws Exception {
        return extract(projectRoot, options, detection, dataAccess,
                InferenceConfig.defaults().debt(), listener);
    }

    /**
     * Extraction with the data access and debt sections (021).
     *
     * @param projectRoot project directory (already validated)
     * @param options     analysis options (language)
     * @param detection   detection parameters
     * @param dataAccess  data access parameters
     * @param debt        legacy debt rule parameters
     * @param listener    receives DETECTION and EXTRACTION
     * @return the extraction result
     * @throws Exception when the analysis fails
     */
    public ExtractionResult extract(final Path projectRoot,
            final AnalysisOptions options, final DetectionConfig detection,
            final DataAccessConfig dataAccess, final DebtConfig debt,
            final AnalysisProgressListener listener) throws Exception {
        listener.onPhase(AnalysisPhase.DETECTION);
        List<String> warnings = new ArrayList<>();
        LanguageAnalyzer analyzer = createAnalyzer(projectRoot,
                options.language(), detection, dataAccess, debt, warnings);
        listener.onPhase(AnalysisPhase.EXTRACTION);
        DependencyGraph graph = analyzer.analyzeProject(projectRoot);
        warnings.addAll(analyzer.getWarnings());
        if (graph.getComponents().isEmpty()) {
            Path name = projectRoot.toAbsolutePath().normalize().getFileName();
            warnings.add("No analyzable source files found in '"
                    + (name == null ? "." : name) + "'");
        }
        Map<String, String> dependencies =
                analyzer.getDependencyResolver().getAllDependencies();
        return new ExtractionResult(graph, dependencies,
                scanSecrets(projectRoot), warnings);
    }

    /**
     * Extracts only the dependency graph.
     *
     * @param projectRoot project directory (already validated)
     * @param options     analysis options
     * @param detection   detection parameters
     * @return the graph
     * @throws Exception when the analysis fails
     */
    public DependencyGraph graph(final Path projectRoot,
            final AnalysisOptions options, final DetectionConfig detection)
            throws Exception {
        return createAnalyzer(projectRoot, options.language(), detection,
                InferenceConfig.defaults().dataAccess(), new ArrayList<>())
                .analyzeProject(projectRoot);
    }

    /**
     * Redacted secret locations; empty when the scan fails (as in 1.2.0).
     *
     * @param projectRoot project directory
     * @return the locations
     */
    private static List<SecretLocation> scanSecrets(final Path projectRoot) {
        try {
            return new SecretLocationScanner().scan(projectRoot);
        } catch (RuntimeException ex) {
            return new ArrayList<>();
        }
    }

    /**
     * Creates the analyzer for the language choice; AUTO detects it from
     * marker files.
     *
     * @param projectRoot project directory
     * @param language    analyzer choice
     * @param detection   detection parameters
     * @param warnings    receives detection warnings
     * @return the analyzer
     */
    LanguageAnalyzer createAnalyzer(final Path projectRoot,
            final AnalysisLanguage language, final DetectionConfig detection,
            final List<String> warnings) {
        return createAnalyzer(projectRoot, language, detection,
                InferenceConfig.defaults().dataAccess(), warnings);
    }

    /**
     * Creates the analyzer for the language choice with data access parameters.
     *
     * @param projectRoot project directory
     * @param language    analyzer choice
     * @param detection   detection parameters
     * @param dataAccess  data access parameters (020)
     * @param warnings    receives detection warnings
     * @return the analyzer
     */
    LanguageAnalyzer createAnalyzer(final Path projectRoot,
            final AnalysisLanguage language, final DetectionConfig detection,
            final DataAccessConfig dataAccess, final List<String> warnings) {
        return createAnalyzer(projectRoot, language, detection, dataAccess,
                InferenceConfig.defaults().debt(), warnings);
    }

    /**
     * Creates the analyzer with the data access and debt sections (021).
     *
     * @param projectRoot project directory
     * @param language    analyzer choice
     * @param detection   detection parameters
     * @param dataAccess  data access parameters
     * @param debt        legacy debt rule parameters
     * @param warnings    receives detection warnings
     * @return the analyzer
     */
    LanguageAnalyzer createAnalyzer(final Path projectRoot,
            final AnalysisLanguage language, final DetectionConfig detection,
            final DataAccessConfig dataAccess, final DebtConfig debt,
            final List<String> warnings) {
        if (language == AnalysisLanguage.JAVA) {
            return new JavaSpoonAnalyzer();
        }
        if (language == AnalysisLanguage.DOTNET) {
            return createDotNetAnalyzer(dataAccess, debt);
        }
        Detection detected = new ProjectTypeDetector().detect(projectRoot,
                detection.maxDepth());
        if (detected.warning() != null) {
            warnings.add(detected.warning());
        }
        return switch (detected.type()) {
            case JAVA -> new JavaSpoonAnalyzer();
            case DOTNET -> createDotNetAnalyzer(dataAccess, debt);
            case AMBIGUOUS -> throw new IllegalArgumentException(
                    detected.ambiguityMessage(projectRoot));
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
    private LanguageAnalyzer createDotNetAnalyzer(final DataAccessConfig dataAccess) {
        return createDotNetAnalyzer(dataAccess, InferenceConfig.defaults().debt());
    }

    private LanguageAnalyzer createDotNetAnalyzer(final DataAccessConfig dataAccess,
            final DebtConfig debt) {
        return createDotNetAnalyzer(dataAccess, debt,
                InferenceConfig.defaults().integrations(),
                InferenceConfig.defaults().dependencies());
    }

    private LanguageAnalyzer createDotNetAnalyzer(final DataAccessConfig dataAccess,
            final DebtConfig debt, final IntegrationsConfig integrations,
            final DependenciesConfig dependencies) {
        return new DotNetBridgeAnalyzer(
                new DotNetToolLocator(getJarDirectory()),
                DotNetBridgeAnalyzer.DEFAULT_TIMEOUT, dataAccess, debt, integrations,
                dependencies);
    }

    /**
     * Extraction with every analyzer section of the configuration (022).
     *
     * @param projectRoot project directory (already validated)
     * @param options     analysis options (language)
     * @param config      inference configuration (detection and analyzer sections)
     * @param listener    receives DETECTION and EXTRACTION
     * @return the extraction result
     * @throws Exception when the analysis fails
     */
    public ExtractionResult extract(final Path projectRoot,
            final AnalysisOptions options, final InferenceConfig config,
            final AnalysisProgressListener listener) throws Exception {
        listener.onPhase(AnalysisPhase.DETECTION);
        List<String> warnings = new ArrayList<>();
        LanguageAnalyzer analyzer;
        if (options.language() == AnalysisLanguage.JAVA) {
            analyzer = new JavaSpoonAnalyzer();
        } else if (options.language() == AnalysisLanguage.DOTNET) {
            analyzer = createDotNetAnalyzer(config.dataAccess(), config.debt(),
                    config.integrations(), config.dependencies());
        } else {
            Detection detected = new ProjectTypeDetector().detect(projectRoot,
                    config.detection().maxDepth());
            if (detected.warning() != null) {
                warnings.add(detected.warning());
            }
            analyzer = switch (detected.type()) {
                case JAVA -> new JavaSpoonAnalyzer();
                case DOTNET -> createDotNetAnalyzer(config.dataAccess(), config.debt(),
                        config.integrations(), config.dependencies());
                case AMBIGUOUS -> throw new IllegalArgumentException(
                        detected.ambiguityMessage(projectRoot));
                case UNKNOWN -> {
                    LOGGER.info("No project type markers found in '{}', "
                            + "defaulting to Java analyzer", projectRoot);
                    yield new JavaSpoonAnalyzer();
                }
            };
        }
        return finish(projectRoot, analyzer, warnings, listener);
    }

    private ExtractionResult finish(final Path projectRoot, final LanguageAnalyzer analyzer,
            final List<String> warnings, final AnalysisProgressListener listener) throws Exception {
        listener.onPhase(AnalysisPhase.EXTRACTION);
        DependencyGraph graph = analyzer.analyzeProject(projectRoot);
        warnings.addAll(analyzer.getWarnings());
        if (graph.getComponents().isEmpty()) {
            Path name = projectRoot.toAbsolutePath().normalize().getFileName();
            warnings.add("No analyzable source files found in '"
                    + (name == null ? "." : name) + "'");
        }
        Map<String, String> dependencies =
                analyzer.getDependencyResolver().getAllDependencies();
        return new ExtractionResult(graph, dependencies,
                scanSecrets(projectRoot), warnings);
    }

    /**
     * Directory of the engine archive (or classes directory).
     *
     * @return the directory, or the current directory when unknown
     */
    private Path getJarDirectory() {
        java.security.CodeSource source = ExtractionService.class
                .getProtectionDomain().getCodeSource();
        if (source == null || source.getLocation() == null) {
            return Path.of(".");
        }
        try {
            Path parent = Paths.get(source.getLocation().toURI()).getParent();
            return parent == null ? Path.of(".") : parent;
        } catch (URISyntaxException | IllegalArgumentException e) {
            LOGGER.debug("Could not resolve JAR directory, using current "
                    + "directory: {}", e.getMessage());
            return Path.of(".");
        }
    }
}
