using DotNetAnalyzer.Analysis;
using DotNetAnalyzer.Model;
using DotNetAnalyzer.Tests.SchemaContract;

namespace DotNetAnalyzer.Tests.Bdd;

/// <summary>
/// Per-scenario state of the 009-vb-legacy-completion scenarios (Reqnroll context injection).
/// </summary>
public sealed class VbAnalysisContext
{
    /// <summary>Analyzer target: a .vbproj/.csproj file or a project directory.</summary>
    public string? Target { get; set; }

    /// <summary>Directory replaced by &lt;ROOT&gt; when comparing with golden files.</summary>
    public string? FixtureRoot { get; set; }

    /// <summary>Scratch project directory created by the scenario (deleted by hooks).</summary>
    public string? ScratchDir { get; set; }

    public DependencyGraph? Graph { get; private set; }

    public string? Json { get; private set; }

    public IReadOnlyList<string> UserWarnings { get; private set; } = Array.Empty<string>();

    public string? SecondJson { get; private set; }

    public IReadOnlyList<string> SecondUserWarnings { get; private set; } = Array.Empty<string>();

    public static string EngineRoot => ContractSchemas.Shared.EngineRoot;

    public static string FixturesDir =>
        Path.Combine(EngineRoot, "src", "test", "dotnet", "DotNetAnalyzer.Tests", "Fixtures");

    public async Task AnalyzeAsync()
    {
        (Graph, Json, UserWarnings) = await RunAsync();
    }

    public async Task AnalyzeTwiceAsync()
    {
        await AnalyzeAsync();
        (_, SecondJson, SecondUserWarnings) = await RunAsync();
    }

    public Component Component(string id)
    {
        var graph = Graph ?? throw new InvalidOperationException("The project was not analyzed");
        return graph.Components.SingleOrDefault(c => c.Id == id)
               ?? throw new Xunit.Sdk.XunitException(
                   $"Component '{id}' not found; components: {string.Join(", ", graph.Components.Select(c => c.Id))}");
    }

    private async Task<(DependencyGraph, string, IReadOnlyList<string>)> RunAsync()
    {
        var target = Target ?? throw new InvalidOperationException("No project given");
        var analyzer = new ProjectAnalyzer();
        var graph = await analyzer.AnalyzeProjectAsync(target);
        return (graph, GraphJson.Serialize(graph), analyzer.UserWarnings.ToList());
    }
}
