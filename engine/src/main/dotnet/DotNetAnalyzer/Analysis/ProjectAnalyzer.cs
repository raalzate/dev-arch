using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.MSBuild;
using DotNetAnalyzer.Analysis.Common;
using DotNetAnalyzer.Analysis.Data;
using DotNetAnalyzer.Analysis.Vb;
using DotNetAnalyzer.Model;

namespace DotNetAnalyzer.Analysis;

public class ProjectAnalyzer
{
    private static bool _msBuildRegistered;
    private static readonly object _registrationLock = new();

    private readonly TypeAnalyzer _typeAnalyzer = new();
    private readonly InvocationAnalyzer _invocationAnalyzer = new();
    private readonly DependencyInjectionAnalyzer _diAnalyzer = new();
    private readonly EndpointExtractor _endpointExtractor = new();
    private readonly TableExtractor _tableExtractor = new();
    private readonly MetricsCalculator _metricsCalculator = new();
    private readonly LayerClassifier _layerClassifier = new();
    private readonly MessagingDetector _messagingDetector = new();
    private readonly SecretsDetector _secretsDetector = new();
    private readonly RoslynCodeAnalyzer _codeAnalyzer = new();

    private readonly List<string> _userWarnings = new();
    private AnalysisOptions _options = AnalysisOptions.Default;
    private ProcedureCatalog? _procedureCatalog;
    private bool _procedureCatalogLoaded;

    // Subjects ("VB project 'X.vbproj'", "VB sources in 'dir'") of the VB code loaded through the Adhoc
    // fallback during the current analysis (009, FR-060/FR-065).
    private readonly SortedSet<string> _reducedFidelityVb = new(StringComparer.Ordinal);

    private const string ReducedFidelitySuffix =
        " analyzed with reduced fidelity (Adhoc fallback: MSBuild with Visual Studio Build Tools and the VB workload "
        + "is unavailable). .NET Framework types are unresolved; coupling to framework types and detections that "
        + "need them may be incomplete. See docs/VB-LEGACY.md.";

    /// <summary>
    /// User-facing warnings of the last analysis (009, contracts/dotnet-warnings-channel.md): ordinal order,
    /// no duplicates, no absolute paths. Printed by Program.cs as <c>[warning] &lt;text&gt;</c> lines on stderr.
    /// </summary>
    public IReadOnlyList<string> UserWarnings => _userWarnings;

    public Task<DependencyGraph> AnalyzeProjectAsync(string projectPath) =>
        AnalyzeProjectAsync(projectPath, AnalysisOptions.Default);

    /// <summary>Analysis with options (020: <c>--config</c>); the default options give the historical behaviour.</summary>
    public async Task<DependencyGraph> AnalyzeProjectAsync(string projectPath, AnalysisOptions options)
    {
        _options = options;
        var compilations = new List<Compilation>();
        bool usedFallback = false;
        _userWarnings.Clear();
        _reducedFidelityVb.Clear();

        try
        {
            compilations = await LoadCompilationsViaMSBuild(projectPath);
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[WARN] MSBuildWorkspace failed: {ex.Message}. Falling back to AdhocWorkspace.");
        }

        if (compilations.Count == 0)
        {
            try
            {
                var fallback = LoadCompilationsViaAdhoc(projectPath, _reducedFidelityVb);
                if (fallback.Count > 0)
                {
                    compilations.AddRange(fallback);
                    usedFallback = true;
                    Console.Error.WriteLine("[WARN] Using AdhocWorkspace fallback — semantic analysis may have reduced accuracy.");
                }
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[WARN] AdhocWorkspace fallback also failed: {ex.Message}");
            }
        }

        // 009 (FR-060, FR-061): VB code loaded through Adhoc is a reduced-fidelity analysis.
        if (_reducedFidelityVb.Count > 0)
        {
            usedFallback = true;
            _userWarnings.AddRange(_reducedFidelityVb.Select(subject => subject + ReducedFidelitySuffix));
        }

        _procedureCatalog = null;
        _procedureCatalogLoaded = false;

        // BUG-009 (014): C# projects loaded by MSBuild whose types do not resolve (missing targeting pack or restore)
        // are a reduced-resolution analysis; say so in the analysis log instead of degrading silently. Not a user
        // warning: those are reserved to the reduced-fidelity VB load (009 FR-063, TS-071).
        if (!usedFallback)
        {
            foreach (var warning in ResolutionWarnings.For(compilations))
            {
                Console.Error.WriteLine($"[WARN] {warning}");
            }
        }

        if (compilations.Count == 0)
        {
            Console.Error.WriteLine("[WARN] No compilations could be loaded. Returning empty dependency graph.");
            return BuildEmptyGraph();
        }

        // Aggregate results across all compilations
        var allComponents = new List<Component>();
        var allEdges = new List<Edge>();
        var allEndpoints = new List<ApiEndpoint>();

        foreach (var compilation in compilations)
        {
            try
            {
                // Pass 1: Type analysis
                var components = _typeAnalyzer.AnalyzeTypes(compilation);

                // 009: VB passes run only for Visual Basic compilations (research D1); C# is untouched.
                var vbIndex = compilation.Language == LanguageNames.VisualBasic ? VbTypeIndex.Build(compilation) : null;
                var vbDirectory = vbIndex != null ? VbProjectContext.ResolveProjectDirectory(compilation) : null;
                // 021: the project file of the compilation (Option Strict, startup object, report definitions).
                var vbProject = vbIndex != null && VbProjectContext.FindProjectFile(vbDirectory) is { } projectFile
                    ? VbProjectFile.Load(projectFile)
                    : null;

                // Pass 2: Invocation analysis
                var edges = _invocationAnalyzer.AnalyzeInvocations(compilation, components);

                // Pass 3: Dependency injection analysis
                var diEdges = _diAnalyzer.Analyze(compilation, components);
                edges.AddRange(diEdges);

                // Pass 4: Endpoint extraction
                var endpoints = _endpointExtractor.ExtractEndpoints(compilation, components);

                // Pass 4b: ASMX / WCF endpoints (VB)
                if (vbIndex != null)
                    RunVbPass("VbEndpointExtractor", () => endpoints.AddRange(VbEndpointExtractor.Extract(vbIndex, components)));

                // Pass 5: Table extraction (mutates components in-place)
                _tableExtractor.ExtractTables(compilation, components);

                // Pass 5b: literal SQL and typed DataSets (VB)
                if (vbIndex != null)
                    RunVbPass("VbTableExtractor", () => VbTableExtractor.Extract(vbIndex, components, vbDirectory));

                // Pass 5c (020): stored procedures invoked by name; auto = Visual Basic only (FR-030).
                Console.Error.WriteLine($"[info] {ProcedureCallExtractor.StateDiagnostic(_options.DataAccess, compilation.Language)}");
                if (ProcedureCallExtractor.Enabled(_options.DataAccess, compilation.Language))
                {
                    RunVbPass("ProcedureCallExtractor", () =>
                    {
                        var types = vbIndex != null
                            ? VisualBasicProcedureCallSyntax.ForIndex(vbIndex)
                            : CSharpProcedureCallSyntax.ForCompilation(compilation);
                        _userWarnings.AddRange(ProcedureCallExtractor.Extract(
                            types, components, _options.DataAccess.CatalogMode, ProcedureCatalogFor(_options.DataAccess)));
                    });
                }

                // Pass 6: Build calls_in / calls_out from edges
                BuildCallLists(components, edges);

                // Pass 7: Quality metrics (CBO, LCOM, LOC)
                _metricsCalculator.Calculate(compilation, components);

                // Pass 7b: CBO, LCOM, complexity (VB)
                if (vbIndex != null)
                    RunVbPass("VbMetricsCalculator", () => VbMetricsCalculator.Calculate(vbIndex, components));

                // Pass 8: Layer classification
                _layerClassifier.Classify(components);

                // Pass 8b: desktop layers (VB), fine layers and entry points (021)
                if (vbIndex != null)
                    RunVbPass("VbLayerClassifier", () => VbLayerClassifier.Classify(vbIndex, components, vbProject));

                // Pass 9: Messaging detection (MassTransit, Azure Service Bus)
                _messagingDetector.Detect(compilation, components);

                // Pass 10: Secrets/configuration detection (IConfiguration, appsettings)
                _secretsDetector.Detect(compilation, components);

                // Pass 10b: app.config / web.config references and plaintext credentials (VB)
                if (vbIndex != null)
                {
                    RunVbPass("VbSecretsDetector", () => VbSecretsDetector.Detect(
                        vbIndex, components, vbDirectory != null ? AppConfigParser.Load(vbDirectory) : AppConfiguration.Empty));
                }

                // Pass 11: Code issue detection (bug patterns, style, security)
                _codeAnalyzer.Analyze(compilation, components);

                // Pass 11b: VB code issues (ordered as C#)
                if (vbIndex != null)
                    RunVbPass("VbCodeAnalyzer", () => VbCodeAnalyzer.Analyze(vbIndex, components));

                // Pass 11c (021): legacy debt rules; auto = Visual Basic only (FR-030).
                Console.Error.WriteLine($"[info] {VbDebtAnalyzer.StateDiagnostic(_options.Debt, compilation.Language)}");
                if (vbIndex != null && VbDebtAnalyzer.Enabled(_options.Debt, compilation.Language))
                    RunVbPass("VbDebtAnalyzer", () => VbDebtAnalyzer.Analyze(vbIndex, components, vbProject, _options.Debt));

                allComponents.AddRange(components);
                allEdges.AddRange(edges);
                allEndpoints.AddRange(endpoints);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[WARN] Error analyzing compilation: {ex.Message}");
            }
        }

        // Determinism (Constitución IV, SC-008): final ordering pass over every
        // list serialized into the JSON output. Done once, here, after all passes.
        var orderedComponents = allComponents
            .OrderBy(c => c.Id, StringComparer.Ordinal)
            .ToList();

        foreach (var c in orderedComponents)
        {
            c.Files = c.Files.OrderBy(f => f, StringComparer.Ordinal).ToList();
            c.TablesUsed = c.TablesUsed.Distinct(StringComparer.Ordinal).OrderBy(t => t, StringComparer.Ordinal).ToList();
            c.SecretsReferences = c.SecretsReferences.Distinct(StringComparer.Ordinal).OrderBy(s => s, StringComparer.Ordinal).ToList();
            c.ExternalDependencies = c.ExternalDependencies.Distinct(StringComparer.Ordinal).OrderBy(d => d, StringComparer.Ordinal).ToList();
            c.Annotations = c.Annotations.Distinct(StringComparer.Ordinal).OrderBy(a => a, StringComparer.Ordinal).ToList();
            c.Implements = c.Implements.Distinct(StringComparer.Ordinal).OrderBy(i => i, StringComparer.Ordinal).ToList();
            c.CallsIn = c.CallsIn.Distinct(StringComparer.Ordinal).OrderBy(x => x, StringComparer.Ordinal).ToList();
            c.CallsOut = c.CallsOut.Distinct(StringComparer.Ordinal).OrderBy(x => x, StringComparer.Ordinal).ToList();
        }

        var orderedEdges = allEdges
            .OrderBy(e => e.From, StringComparer.Ordinal)
            .ThenBy(e => e.To, StringComparer.Ordinal)
            .ThenBy(e => e.Type, StringComparer.Ordinal)
            .ToList();

        var orderedEndpoints = allEndpoints
            .OrderBy(e => e.Method, StringComparer.Ordinal)
            .ThenBy(e => e.Path, StringComparer.Ordinal)
            .ToList();

        // 020: user warnings of every pass, ordinal and without duplicates (contracts/dotnet-warnings-channel.md).
        var orderedWarnings = _userWarnings.Distinct(StringComparer.Ordinal).OrderBy(w => w, StringComparer.Ordinal).ToList();
        _userWarnings.Clear();
        _userWarnings.AddRange(orderedWarnings);

        // Assemble the dependency graph
        var graph = new DependencyGraph
        {
            Components = orderedComponents,
            Edges = orderedEdges,
            ApiContracts = new ApiContracts
            {
                Endpoints = orderedEndpoints,
            },
            Meta = new Meta
            {
                Source = usedFallback ? "roslyn-fallback" : "roslyn",
                CollectedAt = Meta.CurrentCollectedAt(),
            },
        };

        return graph;
    }

    private async Task<List<Compilation>> LoadCompilationsViaMSBuild(string projectPath)
    {
        EnsureMSBuildRegistered();

        var compilations = new List<Compilation>();
        var workspace = MSBuildWorkspace.Create();

        workspace.WorkspaceFailed += (sender, args) =>
        {
            if (args.Diagnostic.Kind == WorkspaceDiagnosticKind.Failure)
            {
                Console.Error.WriteLine($"[WARN] Workspace diagnostic: {args.Diagnostic.Message}");
            }
        };

        // Resolve directory → find .sln, .csproj or .vbproj automatically.
        // .sln has highest precedence; otherwise we collect all .csproj AND .vbproj
        // present in the directory (so a mixed directory is processed end to end).
        var resolvedPaths = new List<string>();
        if (Directory.Exists(projectPath))
        {
            var slnFiles = Directory.GetFiles(projectPath, "*.sln");
            // Stable order for determinism (Constitución IV).
            Array.Sort(slnFiles, StringComparer.Ordinal);

            if (slnFiles.Length > 0)
            {
                resolvedPaths.Add(slnFiles[0]);
            }
            else
            {
                var csprojFiles = Directory.GetFiles(projectPath, "*.csproj");
                var vbprojFiles = Directory.GetFiles(projectPath, "*.vbproj");
                Array.Sort(csprojFiles, StringComparer.Ordinal);
                Array.Sort(vbprojFiles, StringComparer.Ordinal);

                resolvedPaths.AddRange(csprojFiles);
                resolvedPaths.AddRange(vbprojFiles);

                if (resolvedPaths.Count == 0)
                    throw new ArgumentException(
                        $"No .sln, .csproj or .vbproj found in directory: {projectPath}");
            }
        }
        else
        {
            resolvedPaths.Add(projectPath);
        }

        if (resolvedPaths.Count == 1
            && resolvedPaths[0].EndsWith(".vbproj", StringComparison.OrdinalIgnoreCase))
        {
            VbProjectLoader.WarnIfNonWindows();
        }

        foreach (var resolvedPath in resolvedPaths)
        {
            if (resolvedPath.EndsWith(".sln", StringComparison.OrdinalIgnoreCase))
            {
                var solution = await workspace.OpenSolutionAsync(resolvedPath);
                var orderedProjects = solution.Projects
                    .OrderBy(p => p.FilePath ?? p.Name, StringComparer.Ordinal)
                    .ToList();

                foreach (var project in orderedProjects)
                {
                    try
                    {
                        var compilation = await project.GetCompilationAsync();
                        var adhoc = compilation != null
                                    && compilation.Language == LanguageNames.VisualBasic
                                    && project.FilePath != null
                                    && !ResolvesCoreLibrary(compilation)
                            ? VbProjectLoader.LoadAdhoc(project.FilePath)
                            : null;
                        if (adhoc != null)
                        {
                            Console.Error.WriteLine(
                                $"[WARN] Falling back to Adhoc VB compilation for '{project.FilePath}' (core library unresolved).");
                            _reducedFidelityVb.Add(VbProjectSubject(project.FilePath!));
                            compilations.Add(adhoc);
                        }
                        else if (compilation != null)
                        {
                            compilations.Add(VbProjectLoader.StripAutogenerated(compilation));
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.Error.WriteLine($"[WARN] Could not compile project '{project.Name}': {ex.Message}");
                    }
                }
            }
            else if (resolvedPath.EndsWith(".csproj", StringComparison.OrdinalIgnoreCase))
            {
                var project = await workspace.OpenProjectAsync(resolvedPath);
                var compilation = await project.GetCompilationAsync();
                if (compilation != null)
                {
                    compilations.Add(VbProjectLoader.StripAutogenerated(compilation));
                }
            }
            else if (resolvedPath.EndsWith(".vbproj", StringComparison.OrdinalIgnoreCase))
            {
                Compilation? compilation = null;
                try
                {
                    var project = await workspace.OpenProjectAsync(resolvedPath);
                    compilation = await project.GetCompilationAsync();
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine($"[WARN] MSBuildWorkspace failed for '{resolvedPath}': {ex.Message}");
                }

                // Legacy .vbproj on systems without VS Build Tools resolves but yields
                // an empty compilation. Detect that and fall back to Adhoc per-project
                // so we still emit a usable graph for this project.
                // 009 (FR-065, research D13): a legacy .vbproj that imports Microsoft.VisualBasic.targets opens
                // without the .NET Framework reference assemblies: System.Object is an error type. The Adhoc
                // compilation (runtime BCL references) is strictly better in that case.
                if (compilation == null || !compilation.SyntaxTrees.Any() || !ResolvesCoreLibrary(compilation))
                {
                    var adhoc = VbProjectLoader.LoadAdhoc(resolvedPath);
                    if (adhoc != null)
                    {
                        Console.Error.WriteLine(
                            $"[WARN] Falling back to Adhoc VB compilation for '{resolvedPath}' (MSBuild returned no syntax trees or no core library).");
                        _reducedFidelityVb.Add(VbProjectSubject(resolvedPath));
                        compilations.Add(adhoc);
                    }
                    else if (compilation != null && compilation.SyntaxTrees.Any())
                    {
                        compilations.Add(VbProjectLoader.StripAutogenerated(compilation));
                    }
                }
                else
                {
                    compilations.Add(VbProjectLoader.StripAutogenerated(compilation));
                }
            }
            else
            {
                throw new ArgumentException(
                    $"Unsupported project file type: {resolvedPath}. Expected .sln, .csproj or .vbproj");
            }
        }

        return compilations;
    }

    /// <summary>Loads the procedure catalog once per analysis (null without a configured catalog).</summary>
    private ProcedureCatalog? ProcedureCatalogFor(DataAccessOptions options)
    {
        if (!_procedureCatalogLoaded)
        {
            _procedureCatalogLoaded = true;
            _procedureCatalog = options.CatalogPath == null ? null : ProcedureCatalog.Load(options.CatalogPath);
        }

        return _procedureCatalog;
    }

    private static void RunVbPass(string name, Action pass)
    {
        try
        {
            pass();
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[WARN] {name}: {ex.Message}");
        }
    }

    private static bool ResolvesCoreLibrary(Compilation compilation) =>
        compilation.GetSpecialType(SpecialType.System_Object).TypeKind != TypeKind.Error;

    private static string VbProjectSubject(string vbprojPath) =>
        $"VB project '{Path.GetFileName(vbprojPath)}'";

    private static List<Compilation> LoadCompilationsViaAdhoc(string projectPath, ISet<string> reducedFidelityVb)
    {
        var compilations = new List<Compilation>();

        // Decide language by extension (file) or by detecting .vb / .cs in the dir.
        bool isVbProj = File.Exists(projectPath)
                        && projectPath.EndsWith(".vbproj", StringComparison.OrdinalIgnoreCase);
        bool isCsProj = File.Exists(projectPath)
                        && projectPath.EndsWith(".csproj", StringComparison.OrdinalIgnoreCase);

        var directory = File.Exists(projectPath)
            ? Path.GetDirectoryName(projectPath) ?? "."
            : projectPath;

        if (isVbProj)
        {
            var vbCompilation = VbProjectLoader.LoadAdhoc(projectPath);
            if (vbCompilation != null)
            {
                compilations.Add(vbCompilation);
                reducedFidelityVb.Add(VbProjectSubject(projectPath));
            }

            return compilations;
        }

        if (!isCsProj)
        {
            // Directory or .sln-flavored fallback: glob both languages. 021 (research D2b): a directory of nested
            // .vbproj files is compiled one project at a time (root namespaces, project references).
            var nested = VbProjectContext.NestedProjectFiles(directory);
            var vbCompilations = nested.Count > 0
                ? VbProjectLoader.LoadAdhocProjects(nested, directory)
                : VbProjectLoader.LoadAdhoc(directory) is { } single ? new List<Compilation> { single } : new List<Compilation>();
            if (vbCompilations.Count > 0)
            {
                compilations.AddRange(vbCompilations);
                var name = Path.GetFileName(Path.GetFullPath(directory).TrimEnd(Path.DirectorySeparatorChar));
                reducedFidelityVb.Add($"VB sources in '{name}'");
            }
        }

        var csCompilation = LoadCSharpAdhoc(directory);
        if (csCompilation != null)
            compilations.Add(csCompilation);

        return compilations;
    }

    private static Compilation? LoadCSharpAdhoc(string directory)
    {
        var csFiles = Directory.GetFiles(directory, "*.cs", SearchOption.AllDirectories);
        // Stable order for determinism (Constitución IV; BUG-008): the file system order is unspecified.
        Array.Sort(csFiles, StringComparer.Ordinal);

        if (csFiles.Length == 0)
        {
            Console.Error.WriteLine("[WARN] No .cs files found in directory.");
            return null;
        }

        Array.Sort(csFiles, StringComparer.Ordinal);

        var syntaxTrees = new List<SyntaxTree>();
        foreach (var file in csFiles)
        {
            try
            {
                var sourceText = File.ReadAllText(file);
                var tree = CSharpSyntaxTree.ParseText(sourceText, path: file);
                syntaxTrees.Add(tree);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[WARN] Could not parse file '{file}': {ex.Message}");
            }
        }

        if (syntaxTrees.Count == 0)
        {
            return null;
        }

        // In single-file apps Assembly.Location can be empty; collect from loaded assemblies instead
        var references = AppDomain.CurrentDomain.GetAssemblies()
            .Select(a => a.Location)
            .Where(loc => !string.IsNullOrEmpty(loc) && File.Exists(loc))
            .Select(loc => (MetadataReference)MetadataReference.CreateFromFile(loc))
            .ToArray();

        var compilation = CSharpCompilation.Create(
            "FallbackCompilation",
            syntaxTrees,
            references);

        return compilation;
    }

    private static void BuildCallLists(List<Component> components, List<Edge> edges)
    {
        var componentMap = components.ToDictionary(c => c.Id, c => c);

        foreach (var edge in edges)
        {
            if (componentMap.TryGetValue(edge.From, out var fromComponent))
            {
                if (!fromComponent.CallsOut.Contains(edge.To))
                {
                    fromComponent.CallsOut.Add(edge.To);
                }
            }

            if (componentMap.TryGetValue(edge.To, out var toComponent))
            {
                if (!toComponent.CallsIn.Contains(edge.From))
                {
                    toComponent.CallsIn.Add(edge.From);
                }
            }
        }
    }

    private static void EnsureMSBuildRegistered()
    {
        if (_msBuildRegistered) return;

        lock (_registrationLock)
        {
            if (_msBuildRegistered) return;

            try
            {
                var instances = Microsoft.Build.Locator.MSBuildLocator.QueryVisualStudioInstances().ToList();
                if (instances.Count > 0)
                {
                    Microsoft.Build.Locator.MSBuildLocator.RegisterInstance(instances.OrderByDescending(i => i.Version).First());
                }
                else
                {
                    Microsoft.Build.Locator.MSBuildLocator.RegisterDefaults();
                }
            }
            catch (InvalidOperationException)
            {
                // Already registered — safe to ignore
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[WARN] MSBuildLocator registration failed: {ex.Message}");
            }

            _msBuildRegistered = true;
        }
    }

    private static DependencyGraph BuildEmptyGraph()
    {
        return new DependencyGraph
        {
            Meta = new Meta
            {
                Source = "roslyn",
                CollectedAt = Meta.CurrentCollectedAt(),
            },
        };
    }
}
