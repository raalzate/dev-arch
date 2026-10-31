using DotNetAnalyzer.Model;
using Microsoft.CodeAnalysis;

namespace DotNetAnalyzer.Analysis.Data;

/// <summary>
/// Pass 5c (020-stored-procedures): stored procedures invoked by each component, emitted in
/// <c>tables_used</c> as <c>sp:&lt;name&gt;</c>, optionally translated to tables through a
/// <see cref="ProcedureCatalog"/>. Returns the user warnings of the pass (canal 009), ordered.
/// </summary>
public static class ProcedureCallExtractor
{
    /// <summary>Whether the pass runs for a compilation of <paramref name="language"/>.</summary>
    public static bool Enabled(DataAccessOptions options, string language) => options.Procedures switch
    {
        ProceduresMode.On => true,
        ProceduresMode.Off => false,
        _ => language == LanguageNames.VisualBasic,
    };

    /// <summary>Diagnostic line (not a user warning) stating the effective detection state (FR-032).</summary>
    public static string StateDiagnostic(DataAccessOptions options, string language) =>
        $"Stored procedure detection: {(Enabled(options, language) ? "on" : "off")} for {Label(language)} "
        + $"({(options.Procedures == ProceduresMode.Auto ? "auto" : "config")})";

    public static string Label(string language) => language == LanguageNames.VisualBasic ? "Visual Basic" : "C#";

    /// <summary>Runs the rules over <paramref name="types"/> and adds the results to the components.</summary>
    public static IReadOnlyList<string> Extract(
        IEnumerable<IProcedureCallSyntax> types, List<Component> components, CatalogMode mode, ProcedureCatalog? catalog)
    {
        var byId = components.GroupBy(c => c.Id, StringComparer.Ordinal).ToDictionary(g => g.Key, g => g.First(), StringComparer.Ordinal);
        var warnings = new SortedSet<string>(StringComparer.Ordinal);

        foreach (var type in types)
        {
            if (!byId.TryGetValue(type.ComponentId, out var component))
                continue;
            ProcedureMatch match;
            try
            {
                match = ProcedureCallMatcher.Match(type);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[WARN] ProcedureCallExtractor: error analyzing type '{type.ComponentId}': {ex.Message}");
                continue;
            }

            foreach (var line in match.NonLiteralLines)
                warnings.Add($"Procedure name is not a literal in {type.ComponentId} ({type.FileName}:{line})");

            foreach (var call in match.Calls)
            {
                var tables = catalog?.Resolve(call.Name);
                if (tables == null)
                {
                    AddEntry(component, call.Name.Entry);
                    continue;
                }

                foreach (var table in tables)
                    AddEntry(component, table);
                if (mode == CatalogMode.Complement)
                    AddEntry(component, call.Name.Entry);
            }
        }

        if (catalog != null)
        {
            foreach (var warning in catalog.Warnings())
                warnings.Add(warning);
        }

        return warnings.ToList();
    }

    private static void AddEntry(Component component, string entry)
    {
        // Procedures are compared through their key; tables keep the first spelling like VbTableExtractor.
        if (!component.TablesUsed.Contains(entry, StringComparer.OrdinalIgnoreCase))
            component.TablesUsed.Add(entry);
    }
}
