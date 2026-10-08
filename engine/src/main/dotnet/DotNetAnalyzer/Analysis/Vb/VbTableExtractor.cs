using DotNetAnalyzer.Model;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.VisualBasic.Syntax;

namespace DotNetAnalyzer.Analysis.Vb;

/// <summary>
/// Pass 5b (VB only): tables used through literal SQL (folded concatenations) and typed DataSets
/// (009-vb-legacy-completion, FR-001..FR-004). Tables are added in order of appearance, deduplicated ignoring
/// case (first spelling kept); <see cref="ProjectAnalyzer"/> applies the final ordinal order.
/// </summary>
public static class VbTableExtractor
{
    /// <summary>Adds the tables of each VB component of <paramref name="index"/> to <paramref name="components"/>.</summary>
    public static void Extract(VbTypeIndex index, List<Component> components, string? projectDirectory)
    {
        var typedClasses = LoadTypedClasses(projectDirectory);
        var byId = components.GroupBy(c => c.Id, StringComparer.Ordinal).ToDictionary(g => g.Key, g => g.First(), StringComparer.Ordinal);

        foreach (var entry in index.Types)
        {
            if (!byId.TryGetValue(entry.Id, out var component))
                continue;
            try
            {
                foreach (var table in TablesOf(index, entry, typedClasses))
                {
                    if (!component.TablesUsed.Contains(table, StringComparer.OrdinalIgnoreCase))
                        component.TablesUsed.Add(table);
                }
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[WARN] VbTableExtractor: error analyzing type '{entry.Id}': {ex.Message}");
            }
        }
    }

    private static IEnumerable<string> TablesOf(VbTypeIndex index, VbTypeEntry entry, IReadOnlyDictionary<string, string> typedClasses)
    {
        var folded = new HashSet<SyntaxNode>();
        foreach (var node in index.OwnNodes(entry))
        {
            if (node is ExpressionSyntax expression && VbStringFolder.IsStringLeaf(expression))
            {
                var top = VbStringFolder.Top(expression);
                if (!folded.Add(top))
                    continue;
                foreach (var table in SqlTableParser.Parse(VbStringFolder.Fold(top)))
                    yield return table;
            }
            else if (node is IdentifierNameSyntax identifier
                     && typedClasses.TryGetValue(identifier.Identifier.ValueText, out var typedTable))
            {
                yield return typedTable;
            }
        }
    }

    private static IReadOnlyDictionary<string, string> LoadTypedClasses(string? projectDirectory)
    {
        var classes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (projectDirectory == null)
            return classes;
        foreach (var file in VbProjectContext.TypedDataSetFiles(projectDirectory))
        {
            var dataSet = TypedDataSetParser.Parse(file);
            if (dataSet == null)
                continue;
            foreach (var typed in dataSet.Adapters.Concat(dataSet.DataTables))
                classes.TryAdd(typed.ClassName, typed.Table);
        }

        return classes;
    }
}
