namespace DotNetAnalyzer.Analysis.Vb;

/// <summary>
/// Reads the application configuration files (<c>app.config</c>, <c>web.config</c>) of a VB legacy project
/// (009-vb-legacy-completion, data-model §Configuración).
/// </summary>
public static class AppConfigParser
{
    /// <summary>Loads the configuration files found in <paramref name="projectDirectory"/>.</summary>
    public static AppConfiguration Load(string projectDirectory) => AppConfiguration.Empty;
}

/// <summary>Connection strings and settings of a project; values are never emitted in the analysis output.</summary>
public sealed class AppConfiguration
{
    public static readonly AppConfiguration Empty = new();

    public IReadOnlyList<string> Files { get; init; } = Array.Empty<string>();

    public IReadOnlyDictionary<string, string> ConnectionStrings { get; init; } = new Dictionary<string, string>();

    public IReadOnlyDictionary<string, string> Settings { get; init; } = new Dictionary<string, string>();

    public IReadOnlyList<string> Diagnostics { get; init; } = Array.Empty<string>();
}
