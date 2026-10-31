using System.Text.Json;
using System.Text.Json.Nodes;
using DotNetAnalyzer.Analysis;
using FluentAssertions;
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

    /// <summary>Diagnostics the analyzer wrote to stderr during the last analysis (<c>[WARN]</c> lines).</summary>
    public string Log { get; private set; } = string.Empty;

    // The analyzer passes write their diagnostics to Console.Error; analyses are serialized while it is captured.
    private static readonly SemaphoreSlim ConsoleGate = new(1, 1);

    public static string EngineRoot => ContractSchemas.Shared.EngineRoot;

    public static string FixturesDir =>
        Path.Combine(EngineRoot, "src", "test", "dotnet", "DotNetAnalyzer.Tests", "Fixtures");

    public async Task AnalyzeAsync()
    {
        (Graph, Json, UserWarnings, Log) = await RunAsync();
    }

    public async Task AnalyzeTwiceAsync()
    {
        await AnalyzeAsync();
        (_, SecondJson, SecondUserWarnings, _) = await RunAsync();
    }

    public Component Component(string id)
    {
        var graph = Graph ?? throw new InvalidOperationException("The project was not analyzed");
        return graph.Components.SingleOrDefault(c => c.Id == id)
               ?? throw new Xunit.Sdk.XunitException(
                   $"Component '{id}' not found; components: {string.Join(", ", graph.Components.Select(c => c.Id))}");
    }

    /// <summary>Exit code of the last run of the analyzer process (020 steps), null when run in process.</summary>
    public int? ProcessExitCode { get; private set; }

    /// <summary>
    /// 020: analyzes through the real <c>dotnet-analyzer</c> process (the public command line) with an optional
    /// <c>--config</c> file, so the configuration contract is exercised end to end.
    /// </summary>
    public async Task AnalyzeWithProcessAsync(string? configJson)
    {
        var (graph, json, warnings, log, exit) = await RunProcessAsync(configJson);
        ProcessExitCode = exit;
        Log = log;
        if (exit != 0)
            return;
        Graph = graph;
        Json = json;
        UserWarnings = warnings;
    }

    public async Task AnalyzeTwiceWithProcessAsync(string? configJson)
    {
        await AnalyzeWithProcessAsync(configJson);
        var (_, json, warnings, _, _) = await RunProcessAsync(configJson);
        SecondJson = json;
        SecondUserWarnings = warnings;
    }

    /// <summary>Writes <paramref name="configJson"/> next to the scratch project, with catalog paths made absolute.</summary>
    public string WriteConfig(string configJson)
    {
        var root = ScratchDir ?? FixtureRoot ?? Path.GetDirectoryName(Target!)!;
        var node = JsonNode.Parse(configJson)!;
        var catalog = node["dataAccess"]?["procedureCatalog"]?.GetValue<string>();
        if (catalog != null && !Path.IsPathRooted(catalog))
            node["dataAccess"]!["procedureCatalog"] = Path.Combine(root, catalog);
        var dir = Path.Combine(Path.GetTempPath(), "sp020-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(dir);
        ConfigDirs.Add(dir);
        var file = Path.Combine(dir, "config.json");
        File.WriteAllText(file, node.ToJsonString());
        return file;
    }

    /// <summary>Temporary configuration directories to delete after the scenario.</summary>
    public List<string> ConfigDirs { get; } = new();

    private async Task<(DependencyGraph?, string, IReadOnlyList<string>, string, int)> RunProcessAsync(string? configJson)
    {
        var target = Target ?? throw new InvalidOperationException("No project given");
        var dll = Path.Combine(AppContext.BaseDirectory, "dotnet-analyzer.dll");
        File.Exists(dll).Should().BeTrue($"the analyzer must be built next to the tests ({dll})");
        var psi = new System.Diagnostics.ProcessStartInfo("dotnet")
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
        };
        psi.ArgumentList.Add(dll);
        psi.ArgumentList.Add(target);
        if (configJson != null)
            psi.ArgumentList.Add("--config=" + WriteConfig(configJson));
        using var process = System.Diagnostics.Process.Start(psi)!;
        var stdout = process.StandardOutput.ReadToEndAsync();
        var stderr = process.StandardError.ReadToEndAsync();
        await process.WaitForExitAsync();
        var json = await stdout;
        var log = await stderr;
        var warnings = log.Split('\n')
            .Where(l => l.StartsWith("[warning] ", StringComparison.Ordinal))
            .Select(l => l["[warning] ".Length..].TrimEnd('\r'))
            .ToList();
        DependencyGraph? graph = null;
        if (process.ExitCode == 0)
            graph = JsonSerializer.Deserialize<DependencyGraph>(json, GraphJson.ProgramOptions);
        return (graph, json, warnings, log, process.ExitCode);
    }

    private async Task<(DependencyGraph, string, IReadOnlyList<string>, string)> RunAsync()
    {
        var target = Target ?? throw new InvalidOperationException("No project given");
        var analyzer = new ProjectAnalyzer();
        var original = Console.Error;
        var captured = new StringWriter();
        await ConsoleGate.WaitAsync();
        DependencyGraph graph;
        try
        {
            Console.SetError(captured);
            graph = await analyzer.AnalyzeProjectAsync(target);
        }
        finally
        {
            Console.SetError(original);
            ConsoleGate.Release();
        }

        original.Write(captured.ToString());
        return (graph, GraphJson.Serialize(graph), analyzer.UserWarnings.ToList(), captured.ToString());
    }
}
