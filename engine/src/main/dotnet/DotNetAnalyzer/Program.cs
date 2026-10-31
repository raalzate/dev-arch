using DotNetAnalyzer.Analysis;
using System.Text.Json;
using System.Text.Json.Serialization;

try
{
    var positional = args.Where(a => !a.StartsWith("--", StringComparison.Ordinal)).ToArray();
    var configArg = args.FirstOrDefault(a => a.StartsWith("--config=", StringComparison.Ordinal));
    var unknown = args.FirstOrDefault(a => a.StartsWith("--", StringComparison.Ordinal) && !a.StartsWith("--config=", StringComparison.Ordinal));
    if (positional.Length != 1 || unknown != null)
    {
        Console.Error.WriteLine("Usage: dotnet-analyzer <path> [--config=<file>]");
        Console.Error.WriteLine("  <path>  Path to a .sln, .csproj, .vbproj file, or project directory");
        Console.Error.WriteLine("  --config=<file>  JSON configuration (020: section \"dataAccess\"; see docs/VB-LEGACY.md)");
        Console.Error.WriteLine();
        Console.Error.WriteLine("Notes for VB.NET legacy projects:");
        Console.Error.WriteLine("  - Full fidelity requires Windows + Visual Studio Build Tools 2019/2022 with VB workload.");
        Console.Error.WriteLine("  - On other OS, an Adhoc Roslyn fallback is used (reduced semantic resolution).");
        return 1;
    }

    var path = positional[0];
    var analysisOptions = AnalysisOptions.Default;
    if (configArg != null)
    {
        try
        {
            analysisOptions = AnalysisOptions.Load(configArg["--config=".Length..]);
        }
        catch (ArgumentException ex)
        {
            Console.Error.WriteLine($"Error: invalid --config: {ex.Message}");
            return 1;
        }
    }

    if (!File.Exists(path) && !Directory.Exists(path))
    {
        Console.Error.WriteLine($"Error: Path not found: {path}");
        return 1;
    }

    var analyzer = new ProjectAnalyzer();
    var graph = await analyzer.AnalyzeProjectAsync(path, analysisOptions);

    var options = new JsonSerializerOptions
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        WriteIndented = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    var json = JsonSerializer.Serialize(graph, options);
    Console.Write(json);
    Console.Out.Flush();

    // 009 (contracts/dotnet-warnings-channel.md): user warnings after the JSON, one [warning] line each.
    foreach (var warning in analyzer.UserWarnings)
    {
        Console.Error.WriteLine($"[warning] {warning}");
    }

    return 0;
}
catch (Exception ex)
{
    Console.Error.WriteLine($"Error: {ex.Message}");
    return 1;
}
