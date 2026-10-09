using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.VisualBasic.Syntax;

namespace DotNetAnalyzer.Analysis.Vb;

/// <summary>A VB type block (class, module, structure or interface) and the component id it maps to.</summary>
public sealed record VbTypeEntry(string Id, TypeBlockSyntax Block, INamedTypeSymbol? Symbol, SemanticModel Model);

/// <summary>
/// Maps VB type blocks to component ids with the same fully qualified name rule as <see cref="TypeAnalyzer"/>
/// (namespaces + simple name). Nodes are attributed to their innermost type block (research D2).
/// </summary>
public sealed class VbTypeIndex
{
    private readonly Dictionary<TypeBlockSyntax, VbTypeEntry> _byBlock = new();

    private VbTypeIndex()
    {
    }

    /// <summary>Entries in syntax-tree order (trees as ordered by the compilation, blocks in source order).</summary>
    public IReadOnlyList<VbTypeEntry> Types { get; private set; } = Array.Empty<VbTypeEntry>();

    /// <summary>Builds the index of every type block of the VB syntax trees of <paramref name="compilation"/>.</summary>
    public static VbTypeIndex Build(Compilation compilation)
    {
        var index = new VbTypeIndex();
        var entries = new List<VbTypeEntry>();
        foreach (var tree in compilation.SyntaxTrees)
        {
            SemanticModel model;
            try
            {
                model = compilation.GetSemanticModel(tree);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[WARN] VbTypeIndex: no semantic model for '{tree.FilePath}': {ex.Message}");
                continue;
            }

            foreach (var block in tree.GetRoot().DescendantNodes().OfType<TypeBlockSyntax>())
            {
                var symbol = model.GetDeclaredSymbol(block) as INamedTypeSymbol;
                var id = symbol != null ? FullyQualifiedName(symbol) : FallbackName(block);
                var entry = new VbTypeEntry(id, block, symbol, model);
                index._byBlock[block] = entry;
                entries.Add(entry);
            }
        }

        index.Types = entries;
        return index;
    }

    /// <summary>The innermost type block that contains <paramref name="node"/>, or null.</summary>
    public VbTypeEntry? Owner(SyntaxNode node)
    {
        var block = node.AncestorsAndSelf().OfType<TypeBlockSyntax>().FirstOrDefault();
        return block != null && _byBlock.TryGetValue(block, out var entry) ? entry : null;
    }

    /// <summary>Nodes of <paramref name="entry"/> that belong to it and not to a nested type block.</summary>
    public IEnumerable<SyntaxNode> OwnNodes(VbTypeEntry entry) =>
        entry.Block.DescendantNodes().Where(n => ReferenceEquals(Owner(n), entry));

    /// <summary>Namespaces + simple name, as <c>TypeAnalyzer.GetFullyQualifiedName</c>.</summary>
    public static string FullyQualifiedName(INamedTypeSymbol symbol)
    {
        var parts = new List<string>();
        var current = symbol.ContainingNamespace;
        while (current != null && !current.IsGlobalNamespace)
        {
            parts.Insert(0, current.Name);
            current = current.ContainingNamespace;
        }

        parts.Add(symbol.Name);
        return string.Join(".", parts);
    }

    private static string FallbackName(TypeBlockSyntax block)
    {
        var parts = new List<string>();
        foreach (var ns in block.Ancestors().OfType<NamespaceBlockSyntax>())
        {
            parts.Insert(0, ns.NamespaceStatement.Name.ToString());
        }

        parts.Add(block.BlockStatement.Identifier.ValueText);
        return string.Join(".", parts);
    }
}
