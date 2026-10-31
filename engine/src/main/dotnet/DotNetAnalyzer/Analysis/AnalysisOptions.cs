using System.Text.Json;
using System.Text.Json.Nodes;

namespace DotNetAnalyzer.Analysis;

/// <summary>Stored procedure detection mode (020-stored-procedures, contracts/dotnet-analyzer-config.md).</summary>
public enum ProceduresMode
{
    /// <summary>Active for Visual Basic compilations only (default).</summary>
    Auto,
    /// <summary>Active for every compilation.</summary>
    On,
    /// <summary>Never active.</summary>
    Off,
}

/// <summary>How a procedure catalog combines with the <c>sp:</c> entries.</summary>
public enum CatalogMode
{
    /// <summary>Real tables plus <c>sp:&lt;name&gt;</c> (default).</summary>
    Complement,
    /// <summary>Real tables only; <c>sp:</c> kept for unresolved procedures.</summary>
    Replace,
}

/// <summary>The <c>dataAccess</c> section read by the analyzer (inference-only keys are ignored).</summary>
public sealed record DataAccessOptions(ProceduresMode Procedures, string? CatalogPath, CatalogMode CatalogMode)
{
    public static readonly DataAccessOptions Default = new(ProceduresMode.Auto, null, CatalogMode.Complement);
}

/// <summary>
/// Options of an analysis (<c>dotnet-analyzer &lt;path&gt; [--config=&lt;file&gt;]</c>). Unknown sections and keys are
/// ignored so later features can add theirs; invalid values are reported with their cause.
/// </summary>
public sealed record AnalysisOptions(DataAccessOptions DataAccess)
{
    public static readonly AnalysisOptions Default = new(DataAccessOptions.Default);

    /// <summary>Parses the JSON text of a configuration file.</summary>
    /// <exception cref="ArgumentException">when a known value is invalid.</exception>
    public static AnalysisOptions Parse(string json)
    {
        JsonNode? root;
        try
        {
            root = JsonNode.Parse(json);
        }
        catch (JsonException ex)
        {
            throw new ArgumentException($"not valid JSON ({ex.Message})");
        }

        if (root is not JsonObject obj)
            throw new ArgumentException("the configuration must be a JSON object");

        var dataAccess = DataAccessOptions.Default;
        if (obj["dataAccess"] is JsonNode section)
        {
            if (section is not JsonObject da)
                throw new ArgumentException("dataAccess must be an object");
            var procedures = Enum("dataAccess.procedures", da["procedures"], dataAccess.Procedures,
                ("auto", ProceduresMode.Auto), ("on", ProceduresMode.On), ("off", ProceduresMode.Off));
            var mode = Enum("dataAccess.catalogMode", da["catalogMode"], dataAccess.CatalogMode,
                ("complement", CatalogMode.Complement), ("replace", CatalogMode.Replace));
            string? catalog = null;
            if (da["procedureCatalog"] is JsonNode catalogNode)
            {
                if (catalogNode is not JsonValue v || v.TryGetValue<string>(out var text) == false)
                    throw new ArgumentException("dataAccess.procedureCatalog must be a string or null");
                catalog = string.IsNullOrWhiteSpace(text) ? null : text;
            }

            dataAccess = new DataAccessOptions(procedures, catalog, mode);
        }

        return new AnalysisOptions(dataAccess);
    }

    /// <summary>Reads and parses a configuration file.</summary>
    public static AnalysisOptions Load(string path)
    {
        if (!File.Exists(path))
            throw new ArgumentException($"file not found: {Path.GetFileName(path)}");
        return Parse(File.ReadAllText(path));
    }

    private static T Enum<T>(string key, JsonNode? node, T fallback, params (string Text, T Value)[] values) where T : struct
    {
        if (node == null)
            return fallback;
        var text = (node as JsonValue)?.TryGetValue<string>(out var s) == true ? s : null;
        foreach (var (candidate, value) in values)
        {
            if (string.Equals(candidate, text, StringComparison.OrdinalIgnoreCase))
                return value;
        }

        throw new ArgumentException($"{key} must be one of {string.Join(", ", values.Select(v => v.Text))}");
    }
}
