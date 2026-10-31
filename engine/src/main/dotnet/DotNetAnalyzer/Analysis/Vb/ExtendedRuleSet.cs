using System.Text.Json;
using System.Text.Json.Serialization;

namespace DotNetAnalyzer.Analysis.Vb;

/// <summary>One rule of the versioned list <c>schema/extended-rules.json</c> (024, FR-011).</summary>
public sealed record ExtendedRule(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("category")] string Category,
    [property: JsonPropertyName("severity")] string Severity,
    [property: JsonPropertyName("cwe")] string? Cwe);

/// <summary>
/// The rules of the official analyzers evaluated by the extended pass: the versioned list embedded in the
/// analyzer, optionally restricted to the ids of <c>analysis.rules</c>. Deterministic (ordinal order).
/// </summary>
public sealed class ExtendedRuleSet
{
    public const string ResourceName = "DotNetAnalyzer.extended-rules.json";

    private readonly SortedDictionary<string, ExtendedRule> _rules = new(StringComparer.Ordinal);

    public IReadOnlyCollection<ExtendedRule> Rules => _rules.Values;

    public bool Contains(string id) => _rules.ContainsKey(id);

    public ExtendedRule? Get(string id) => _rules.TryGetValue(id, out var rule) ? rule : null;

    /// <summary>Loads the embedded list; <paramref name="requested"/> non-empty keeps only those ids (unknown ids are reported).</summary>
    public static ExtendedRuleSet Load(IReadOnlyList<string> requested, List<string> userWarnings)
    {
        var set = new ExtendedRuleSet();
        using var stream = typeof(ExtendedRuleSet).Assembly.GetManifestResourceStream(ResourceName)
            ?? throw new InvalidOperationException("missing embedded resource " + ResourceName);
        using var document = JsonDocument.Parse(stream);
        foreach (var element in document.RootElement.GetProperty("rules").EnumerateArray())
        {
            var rule = element.Deserialize<ExtendedRule>()!;
            set._rules[rule.Id] = rule;
        }

        if (requested.Count > 0)
        {
            var wanted = new HashSet<string>(requested, StringComparer.OrdinalIgnoreCase);
            var unknown = requested.Where(r => !set._rules.ContainsKey(r.ToUpperInvariant())).OrderBy(r => r, StringComparer.Ordinal).ToList();
            if (unknown.Count > 0)
                userWarnings.Add("Unknown extended rules ignored: " + string.Join(", ", unknown));
            foreach (var id in set._rules.Keys.Where(id => !wanted.Contains(id)).ToList())
                set._rules.Remove(id);
        }

        return set;
    }

    /// <summary>Issue type of the closed contract enum for a category of the versioned list.</summary>
    public static string TypeOf(string category) => category.ToLowerInvariant() switch
    {
        "security" => "SECURITY",
        "performance" => "PERFORMANCE",
        "naming" or "style" => "CODE_STYLE",
        _ => "BUG_PATTERN",
    };
}
