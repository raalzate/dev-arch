using DotNetAnalyzer.Model;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.VisualBasic;
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

    /// <summary>Annotation of the desktop presentation layer (021, FR-014).</summary>
    public const string PresentationAnnotation = "Layer:Presentación";
    public const string ReportsAnnotation = "Layer:Reportes";
    public const string BatchAnnotation = "Layer:Batch";
    public const string EntryPointAnnotation = "EntryPoint:Main";

    private static readonly string[] PresentationBases = { "Form", "UserControl", "XtraForm", "XtraUserControl", "WaitForm" };

    /// <summary>Overrides the layer of the VB components of <paramref name="index"/> according to FR-040 (009).</summary>
    public static void Classify(VbTypeIndex index, List<Component> components) => Classify(index, components, null);

    /// <summary>
    /// 009 rules plus the desktop fine layers of 021 (FR-010..FR-016): the fine layer is emitted as an annotation
    /// and projected onto the closed layer catalogue (Presentación/Reportes → Web, Batch/Validator → Negocio).
    /// </summary>
    public static void Classify(VbTypeIndex index, List<Component> components, VbProjectFile? project)
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
                var entries = group.ToList();
                component.Layer = Classify(entries, component, contracts, bySimpleName) ?? component.Layer;
                ApplyFineLayer(entries, component, bySimpleName, project);
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

    /// <summary>021: fine desktop layer by inheritance, associated files, Sub Main and validator naming.</summary>
    private static void ApplyFineLayer(
        List<VbTypeEntry> entries, Component component, ILookup<string, VbTypeEntry> bySimpleName, VbProjectFile? project)
    {
        if (component.IsInterface)
            return;
        var name = entries[0].Block.BlockStatement.Identifier.ValueText;
        var bases = BaseNames(entries, bySimpleName);
        var files = entries.Select(e => e.Block.SyntaxTree.FilePath).Where(p => !string.IsNullOrEmpty(p)).ToList();

        string? fine = null;
        if (bases.Any(b => PresentationBases.Any(s => b.EndsWith(s, StringComparison.Ordinal)))
            || files.Any(f => File.Exists(Path.Combine(Path.GetDirectoryName(f)!, name + ".Designer.vb"))))
        {
            fine = PresentationAnnotation;
        }
        else if (bases.Any(b => b.Contains("Report", StringComparison.Ordinal))
                 || (project?.ReportDefinitions.Contains(name) ?? false)
                 || entries.Any(e => e.Block.DescendantNodes().OfType<IdentifierNameSyntax>().Any(i => i.Identifier.ValueText == "LocalReport")))
        {
            fine = ReportsAnnotation;
        }
        else if (entries.Any(e => e.Block is ModuleBlockSyntax && HasSubMain(e.Block))
                 || (project?.StartupObject != null && string.Equals(project.StartupObject, component.Id, StringComparison.OrdinalIgnoreCase)
                     && entries.Any(e => e.Block is ModuleBlockSyntax)))
        {
            fine = BatchAnnotation;
        }

        if (fine != null && !component.Annotations.Contains(fine, StringComparer.Ordinal))
            component.Annotations.Add(fine);

        switch (fine)
        {
            case PresentationAnnotation or ReportsAnnotation:
                if (component.Layer != "Controlador")
                    component.Layer = "Web";
                break;
            case BatchAnnotation:
                if (!component.Annotations.Contains(EntryPointAnnotation, StringComparer.Ordinal))
                    component.Annotations.Add(EntryPointAnnotation);
                component.Layer = "Negocio";
                break;
        }

        if (fine == null && (name.EndsWith("Validator", StringComparison.Ordinal)
                             || (project != null && Path.GetFileNameWithoutExtension(project.FileName).EndsWith(".Validators", StringComparison.Ordinal))))
        {
            component.Layer = "Negocio";
        }
    }

    private static bool HasSubMain(TypeBlockSyntax block) =>
        block.Members.OfType<MethodBlockSyntax>().Any(m =>
            m.SubOrFunctionStatement.Identifier.ValueText.Equals("Main", StringComparison.OrdinalIgnoreCase)
            && m.SubOrFunctionStatement.DeclarationKeyword.IsKind(SyntaxKind.SubKeyword));

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
