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

/// <summary>Legacy debt rules mode (021-desktop-identity-layers).</summary>
public enum DebtMode
{
    /// <summary>Active for Visual Basic compilations only (default).</summary>
    Auto,
    On,
    Off,
}

/// <summary>The <c>debt</c> section read by the analyzer (021).</summary>
public sealed record DebtOptions(DebtMode Enabled, int GodClassMinLoc, int GodClassMinComplexity)
{
    public static readonly DebtOptions Default = new(DebtMode.Auto, 1000, 15);
}

/// <summary>Three-state activation shared by the 022 sections.</summary>
public enum PassMode
{
    Auto,
    On,
    Off,
}

/// <summary>The <c>integrations</c> section (022).</summary>
public sealed record IntegrationsOptions(PassMode Outbound)
{
    public static readonly IntegrationsOptions Default = new(PassMode.Auto);
}

/// <summary>The <c>dependencies</c> section (022).</summary>
public sealed record DependenciesOptions(PassMode Enabled, IReadOnlyList<string> Eol)
{
    public static readonly DependenciesOptions Default = new(PassMode.Auto, Array.Empty<string>());

    public bool Equals(DependenciesOptions? other) =>
        other != null && Enabled == other.Enabled && Eol.SequenceEqual(other.Eol, StringComparer.Ordinal);

    public override int GetHashCode() => HashCode.Combine(Enabled, Eol.Count);
}

/// <summary>
/// Options of an analysis (<c>dotnet-analyzer &lt;path&gt; [--config=&lt;file&gt;]</c>). Unknown sections and keys are
/// ignored so later features can add theirs; invalid values are reported with their cause.
/// </summary>
public sealed record AnalysisOptions(DataAccessOptions DataAccess, DebtOptions Debt, IntegrationsOptions Integrations, DependenciesOptions Dependencies)
{
    public static readonly AnalysisOptions Default = new(DataAccessOptions.Default, DebtOptions.Default, IntegrationsOptions.Default, DependenciesOptions.Default);

    /// <summary>020 constructor kept for callers that only set the data access section.</summary>
    public AnalysisOptions(DataAccessOptions dataAccess) : this(dataAccess, DebtOptions.Default, IntegrationsOptions.Default, DependenciesOptions.Default)
    {
    }

    /// <summary>021 constructor.</summary>
    public AnalysisOptions(DataAccessOptions dataAccess, DebtOptions debt) : this(dataAccess, debt, IntegrationsOptions.Default, DependenciesOptions.Default)
    {
    }

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

        var debt = DebtOptions.Default;
        if (obj["debt"] is JsonNode debtSection)
        {
            if (debtSection is not JsonObject d)
                throw new ArgumentException("debt must be an object");
            var enabled = Enum("debt.enabled", d["enabled"], debt.Enabled,
                ("auto", DebtMode.Auto), ("on", DebtMode.On), ("off", DebtMode.Off));
            var minLoc = debt.GodClassMinLoc;
            var minComplexity = debt.GodClassMinComplexity;
            if (d["godClass"] is JsonNode godClass)
            {
                if (godClass is not JsonObject g)
                    throw new ArgumentException("debt.godClass must be an object");
                minLoc = PositiveInt("debt.godClass.minLoc", g["minLoc"], minLoc);
                minComplexity = PositiveInt("debt.godClass.minComplexity", g["minComplexity"], minComplexity);
            }

            debt = new DebtOptions(enabled, minLoc, minComplexity);
        }

        var integrations = IntegrationsOptions.Default;
        if (obj["integrations"] is JsonNode integrationsSection)
        {
            if (integrationsSection is not JsonObject io)
                throw new ArgumentException("integrations must be an object");
            integrations = new IntegrationsOptions(Enum("integrations.outbound", io["outbound"], integrations.Outbound,
                ("auto", PassMode.Auto), ("on", PassMode.On), ("off", PassMode.Off)));
        }

        var dependencies = DependenciesOptions.Default;
        if (obj["dependencies"] is JsonNode dependenciesSection)
        {
            if (dependenciesSection is not JsonObject dp)
                throw new ArgumentException("dependencies must be an object");
            var enabled = Enum("dependencies.enabled", dp["enabled"], dependencies.Enabled,
                ("auto", PassMode.Auto), ("on", PassMode.On), ("off", PassMode.Off));
            var eol = new List<string>();
            if (dp["eol"] is JsonNode eolNode)
            {
                if (eolNode is not JsonArray array)
                    throw new ArgumentException("dependencies.eol must be an array of strings");
                foreach (var item in array)
                {
                    var text = (item as JsonValue)?.TryGetValue<string>(out var t) == true ? t : null;
                    if (string.IsNullOrWhiteSpace(text))
                        throw new ArgumentException("dependencies.eol must be an array of non-blank strings");
                    eol.Add(text.Trim());
                }
            }

            dependencies = new DependenciesOptions(enabled, eol.Distinct(StringComparer.OrdinalIgnoreCase).OrderBy(e => e, StringComparer.Ordinal).ToList());
        }

        return new AnalysisOptions(dataAccess, debt, integrations, dependencies);
    }

    private static int PositiveInt(string key, JsonNode? node, int fallback)
    {
        if (node == null)
            return fallback;
        if (node is JsonValue v && v.TryGetValue<int>(out var value) && value >= 1)
            return value;
        throw new ArgumentException($"{key} must be an integer >= 1");
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
