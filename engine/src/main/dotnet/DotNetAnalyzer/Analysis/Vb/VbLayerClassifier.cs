using DotNetAnalyzer.Model;
using Microsoft.CodeAnalysis.VisualBasic.Syntax;

namespace DotNetAnalyzer.Analysis.Vb;

/// <summary>
/// Pass 8b (VB only, after the general <see cref="LayerClassifier"/>): layers of legacy desktop components
/// (009-vb-legacy-completion, FR-040, data-model §Capas VB). Interfaces keep the general classification (FR-041).
/// </summary>
public static class VbLayerClassifier
{
    private static readonly string[] FormBases = { "Form", "UserControl" };

    private static readonly string[] ReportBases = { "ReportClass", "ReportDocument", "XtraReport", "LocalReport", "SectionReport" };

    private static readonly string[] ReportSuffixes = { "Report", "Reporte" };

    private static readonly string[] DataSuffixes =
    {
        "Repository", "Data", "Dao", "Adapter", "DataAccess", "DataLayer", "TableAdapter",
    };

    private static readonly string[] OrdinalDataSuffixes = { "DAL", "Dal" };

    private static readonly string[] DataBases = { "DataSet", "DataTable" };

    /// <summary>Overrides the layer of the VB components of <paramref name="index"/> according to FR-040.</summary>
    public static void Classify(VbTypeIndex index, List<Component> components)
    {
        var byId = components.GroupBy(c => c.Id, StringComparer.Ordinal).ToDictionary(g => g.Key, g => g.First(), StringComparer.Ordinal);
        var contracts = index.Types
            .Where(t => t.Block is InterfaceBlockSyntax && VbServiceSyntax.IsServiceContract(t.Block))
            .ToList();

        var bySimpleName = index.Types.Where(t => t.Block is ClassBlockSyntax)
            .ToLookup(t => t.Block.BlockStatement.Identifier.ValueText, StringComparer.OrdinalIgnoreCase);

        foreach (var group in index.Types.GroupBy(t => t.Id, StringComparer.Ordinal))
        {
            if (!byId.TryGetValue(group.Key, out var component) || component.IsInterface)
                continue;
            try
            {
                component.Layer = Classify(group.ToList(), component, contracts, bySimpleName) ?? component.Layer;
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[WARN] VbLayerClassifier: error classifying type '{group.Key}': {ex.Message}");
            }
        }
    }

    private static string? Classify(
        List<VbTypeEntry> entries, Component component, List<VbTypeEntry> contracts, ILookup<string, VbTypeEntry> bySimpleName)
    {
        var name = entries[0].Block.BlockStatement.Identifier.ValueText;
        var bases = BaseNames(entries, bySimpleName);

        if (component.Layer == "Controlador"
            || entries.Any(e => VbServiceSyntax.IsAsmxService(e.Block) || VbServiceSyntax.IsServiceContract(e.Block))
            || entries.Any(e => ImplementsContract(e, contracts)))
            return "Controlador";

        if (bases.Overlaps(FormBases) || name.EndsWith("Form", StringComparison.Ordinal) || HasPrefix(name, "frm"))
            return "Web";

        if (bases.Overlaps(ReportBases)
            || ReportSuffixes.Any(s => name.EndsWith(s, StringComparison.OrdinalIgnoreCase))
            || HasPrefix(name, "rpt"))
            return "Web";

        if (name.EndsWith("Controller", StringComparison.Ordinal))
            return "Negocio";

        if (component.TablesUsed.Count > 0
            || DataSuffixes.Any(s => name.EndsWith(s, StringComparison.OrdinalIgnoreCase))
            || OrdinalDataSuffixes.Any(s => name.EndsWith(s, StringComparison.Ordinal))
            || bases.Overlaps(DataBases))
            return "Datos";

        if (entries.Any(e => e.Block is ModuleBlockSyntax))
            return "Compartida";

        return null;
    }

    /// <summary>
    /// Simple names of the base types of the component: the symbol chain and, for unresolved bases, the
    /// <c>Inherits</c> chain through the project's own classes (syntax).
    /// </summary>
    private static HashSet<string> BaseNames(List<VbTypeEntry> entries, ILookup<string, VbTypeEntry> bySimpleName)
    {
        var names = new HashSet<string>(StringComparer.Ordinal);
        var visited = new HashSet<VbTypeEntry>();
        var pending = new Queue<VbTypeEntry>(entries);
        while (pending.Count > 0)
        {
            var entry = pending.Dequeue();
            if (!visited.Add(entry))
                continue;
            for (var type = entry.Symbol?.BaseType; type != null; type = type.BaseType)
                names.Add(type.Name);
            foreach (var inherited in VbServiceSyntax.InheritedNames(entry.Block))
            {
                names.Add(inherited);
                foreach (var baseEntry in bySimpleName[inherited])
                    pending.Enqueue(baseEntry);
            }
        }

        return names;
    }

    private static bool ImplementsContract(VbTypeEntry entry, List<VbTypeEntry> contracts)
    {
        if (contracts.Count == 0)
            return false;
        var implemented = VbServiceSyntax.ImplementedNames(entry.Block).ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (entry.Symbol != null)
            implemented.UnionWith(entry.Symbol.AllInterfaces.Select(i => i.Name));
        return contracts.Any(c => implemented.Contains(c.Block.BlockStatement.Identifier.ValueText));
    }

    private static bool HasPrefix(string name, string prefix) =>
        name.Length > prefix.Length
        && name.StartsWith(prefix, StringComparison.Ordinal)
        && (char.IsUpper(name[prefix.Length]) || name[prefix.Length] == '_');
}
