using System.Text.Json;
using DotNetAnalyzer.Model;

namespace DotNetAnalyzer.Analysis.Sarif;

/// <summary>
/// 024 (FR-050): imports SARIF 2.1.0 reports into <c>code_issues</c>. Each result is attached to the component whose
/// file ends with the result's artifact path; <c>pattern</c> is the rule id, the message starts with
/// <c>[source:&lt;tool&gt;]</c> (and the CWE tag of the rule when present), the severity follows <c>level</c>, results
/// are deduplicated by (file, line, rule) and sorted. Problems become user warnings, never failures.
/// </summary>
public static class SarifImporter
{
    public static void Import(IReadOnlyList<string> paths, string analyzedRoot, List<Component> components, List<string> userWarnings)
    {
        foreach (var requested in paths.OrderBy(p => p, StringComparer.Ordinal))
        {
            var path = Path.IsPathRooted(requested) ? requested : Path.Combine(analyzedRoot, requested);
            if (!File.Exists(path))
            {
                userWarnings.Add($"SARIF {requested}: file not found; report ignored.");
                continue;
            }
            try
            {
                using var document = JsonDocument.Parse(File.ReadAllText(path));
                var unmatched = ImportDocument(document, requested, components);
                if (unmatched > 0)
                    userWarnings.Add($"SARIF {requested}: {unmatched} result(s) without a matching component were ignored.");
            }
            catch (Exception ex) when (ex is JsonException or InvalidOperationException or KeyNotFoundException)
            {
                userWarnings.Add($"SARIF {requested}: not a readable SARIF 2.1.0 document ({ex.Message}); report ignored.");
            }
        }
    }

    private static int ImportDocument(JsonDocument document, string requested, List<Component> components)
    {
        var unmatched = 0;
        var seen = new HashSet<string>(StringComparer.Ordinal);
        var filesByComponent = components
            .Select(c => (Component: c, Files: c.Files.Select(f => f.Replace('\\', '/')).ToList()))
            .ToList();
        if (!document.RootElement.TryGetProperty("runs", out var runs))
            throw new InvalidOperationException("missing 'runs'");
        foreach (var run in runs.EnumerateArray())
        {
            var driver = run.GetProperty("tool").GetProperty("driver");
            var tool = driver.TryGetProperty("name", out var nameElement) ? nameElement.GetString() ?? "unknown" : "unknown";
            var ruleTags = new Dictionary<string, List<string>>(StringComparer.Ordinal);
            if (driver.TryGetProperty("rules", out var rules))
            {
                foreach (var rule in rules.EnumerateArray())
                {
                    var tags = new List<string>();
                    if (rule.TryGetProperty("properties", out var props) && props.TryGetProperty("tags", out var tagArray))
                        tags.AddRange(tagArray.EnumerateArray().Select(t => t.GetString() ?? string.Empty));
                    ruleTags[rule.GetProperty("id").GetString() ?? string.Empty] = tags;
                }
            }
            if (!run.TryGetProperty("results", out var results))
                continue;
            foreach (var result in results.EnumerateArray())
            {
                var ruleId = result.TryGetProperty("ruleId", out var r) ? r.GetString() ?? "SARIF" : "SARIF";
                var level = result.TryGetProperty("level", out var l) ? l.GetString() ?? "warning" : "warning";
                var text = result.TryGetProperty("message", out var m) && m.TryGetProperty("text", out var t) ? t.GetString() ?? string.Empty : string.Empty;
                var (uri, line) = Location(result);
                var component = uri == null ? null : Match(filesByComponent, uri);
                if (component == null)
                {
                    unmatched++;
                    continue;
                }
                var file = Path.GetFileName(uri!);
                if (!seen.Add($"{uri}|{line}|{ruleId}"))
                    continue;
                var tags = ruleTags.GetValueOrDefault(ruleId) ?? new List<string>();
                var cwe = tags.FirstOrDefault(tag => tag.StartsWith("CWE-", StringComparison.OrdinalIgnoreCase));
                var security = cwe != null || tags.Any(tag => tag.Equals("security", StringComparison.OrdinalIgnoreCase));
                component.CodeIssues.Add(new CodeIssue
                {
                    Rule = ruleId,
                    Type = security ? "SECURITY" : "BUG_PATTERN",
                    Severity = level.ToLowerInvariant() switch { "error" => "ERROR", "note" or "none" => "INFO", _ => "WARNING" },
                    Message = $"[source:{tool}]" + (cwe == null ? "" : "[" + cwe.ToUpperInvariant() + "]") + " " + (text.Length == 0 ? ruleId : text),
                    Line = line,
                    Location = $"{file}:{line}",
                });
            }
        }
        return unmatched;
    }

    private static (string? Uri, int Line) Location(JsonElement result)
    {
        if (!result.TryGetProperty("locations", out var locations) || locations.GetArrayLength() == 0)
            return (null, 0);
        var physical = locations[0].TryGetProperty("physicalLocation", out var p) ? p : default;
        if (physical.ValueKind != JsonValueKind.Object)
            return (null, 0);
        string? uri = physical.TryGetProperty("artifactLocation", out var artifact) && artifact.TryGetProperty("uri", out var u) ? u.GetString() : null;
        var line = physical.TryGetProperty("region", out var region) && region.TryGetProperty("startLine", out var s) ? s.GetInt32() : 0;
        if (uri != null)
        {
            if (uri.StartsWith("file://", StringComparison.OrdinalIgnoreCase))
                uri = uri.Substring("file://".Length).TrimStart('/');
            uri = uri.Replace('\\', '/').TrimStart('.', '/');
        }
        return (uri, line);
    }

    private static Component? Match(List<(Component Component, List<string> Files)> components, string uri)
    {
        // Longest common trailing path (in segments, at least the file name) wins; ties by component id (ordinal).
        var uriSegments = uri.Split('/', StringSplitOptions.RemoveEmptyEntries);
        Component? best = null;
        var bestDepth = 0;
        foreach (var (component, files) in components)
        {
            foreach (var file in files)
            {
                var fileSegments = file.Split('/', StringSplitOptions.RemoveEmptyEntries);
                var depth = 0;
                while (depth < uriSegments.Length && depth < fileSegments.Length
                       && string.Equals(uriSegments[^(depth + 1)], fileSegments[^(depth + 1)], StringComparison.OrdinalIgnoreCase))
                    depth++;
                if (depth == 0)
                    continue;
                if (depth > bestDepth || (depth == bestDepth && string.CompareOrdinal(component.Id, best!.Id) < 0))
                {
                    best = component;
                    bestDepth = depth;
                }
            }
        }
        return best;
    }

}
