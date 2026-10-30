using System.Reflection;
using System.Text.Json;

namespace DotNetAnalyzer.Analysis.Vb;

/// <summary>An end-of-life rule: name prefix, optional maximum major version, reason.</summary>
public sealed record EolRule(string Prefix, string? MaxVersion, string Reason);

/// <summary>
/// The versioned end-of-life list (<c>schema/eol-dependencies.json</c>, embedded) plus the prefixes of
/// <c>dependencies.eol</c> (022, research D3). Matching is by prefix, case-insensitive; a rule with
/// <c>maxVersion</c> matches versions whose major part is at most that number (or unknown versions).
/// </summary>
public sealed class EolCatalog
{
    private readonly List<EolRule> _rules;

    private EolCatalog(IEnumerable<EolRule> rules)
    {
        _rules = rules.OrderBy(r => r.Prefix, StringComparer.Ordinal).ToList();
    }

    /// <summary>Rules of the catalog, ordinal by prefix.</summary>
    public IReadOnlyList<EolRule> Rules => _rules;

    /// <summary>Embedded list plus the configured prefixes.</summary>
    public static EolCatalog Load(IEnumerable<string> configuredPrefixes)
    {
        var rules = new List<EolRule>(Embedded());
        foreach (var prefix in configuredPrefixes.Where(p => !string.IsNullOrWhiteSpace(p)).Distinct(StringComparer.OrdinalIgnoreCase))
            rules.Add(new EolRule(prefix.Trim(), null, "listed in dependencies.eol"));
        return new EolCatalog(rules);
    }

    /// <summary>First rule matching <paramref name="name"/> (and <paramref name="version"/>), or null.</summary>
    public EolRule? Match(string name, string? version)
    {
        foreach (var rule in _rules)
        {
            if (!name.StartsWith(rule.Prefix, StringComparison.OrdinalIgnoreCase))
                continue;
            if (rule.MaxVersion == null)
                return rule;
            var major = Major(version);
            if (major == null || major <= int.Parse(rule.MaxVersion))
                return rule;
        }

        return null;
    }

    private static int? Major(string? version)
    {
        if (string.IsNullOrWhiteSpace(version))
            return null;
        var first = version.Split('.')[0];
        return int.TryParse(first, out var major) ? major : null;
    }

    private static IEnumerable<EolRule> Embedded()
    {
        using var stream = typeof(EolCatalog).Assembly.GetManifestResourceStream("DotNetAnalyzer.eol-dependencies.json");
        if (stream == null)
            return Array.Empty<EolRule>();
        using var document = JsonDocument.Parse(stream);
        var rules = new List<EolRule>();
        foreach (var element in document.RootElement.EnumerateArray())
        {
            var prefix = element.GetProperty("prefix").GetString();
            if (string.IsNullOrWhiteSpace(prefix))
                continue;
            var max = element.TryGetProperty("maxVersion", out var m) ? m.GetString() : null;
            var reason = element.TryGetProperty("reason", out var r) ? r.GetString() ?? "end of life" : "end of life";
            rules.Add(new EolRule(prefix, max, reason));
        }

        return rules;
    }
}
