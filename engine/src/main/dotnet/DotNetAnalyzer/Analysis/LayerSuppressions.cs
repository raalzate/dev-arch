using DotNetAnalyzer.Model;

namespace DotNetAnalyzer.Analysis;

/// <summary>
/// 024 (FR-060): removes, after every pass, the issues whose rule is suppressed for the fine layer of the component
/// (<c>Layer:&lt;Capa&gt;</c> annotation of 021, else the contract layer). Entries have the form <c>Layer:RULE</c>.
/// </summary>
public static class LayerSuppressions
{
    public static void Apply(List<Component> components, IReadOnlyList<string> suppressions)
    {
        if (suppressions.Count == 0)
            return;
        var byLayer = new Dictionary<string, HashSet<string>>(StringComparer.Ordinal);
        foreach (var entry in suppressions)
        {
            var colon = entry.IndexOf(':');
            if (colon <= 0 || colon == entry.Length - 1)
                continue;
            var layer = entry.Substring(0, colon).Trim();
            var rule = entry.Substring(colon + 1).Trim();
            byLayer.TryAdd(layer, new HashSet<string>(StringComparer.Ordinal));
            byLayer[layer].Add(rule);
        }
        foreach (var component in components)
        {
            var layers = component.Annotations
                .Where(a => a.StartsWith("Layer:", StringComparison.Ordinal))
                .Select(a => a.Substring("Layer:".Length))
                .ToList();
            if (component.Layer != null)
                layers.Add(component.Layer);
            var suppressed = new HashSet<string>(StringComparer.Ordinal);
            foreach (var layer in layers)
            {
                if (byLayer.TryGetValue(layer, out var rules))
                    suppressed.UnionWith(rules);
            }
            if (suppressed.Count > 0)
                component.CodeIssues.RemoveAll(i => suppressed.Contains(i.Rule));
        }
    }
}
