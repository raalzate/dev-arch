using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace DotNetAnalyzer.Analysis;

/// <summary>
/// BUG-009 (014-standalone-repo): semantic resolution depends on the installed .NET targeting packs and on the
/// package restore of the analyzed project. A C# project whose declarations reference types that do not resolve
/// (base types, interfaces, member types) is analyzed with reduced resolution: base types and coupling of the
/// affected components may be incomplete. This is written to the analysis log instead of happening silently (not a
/// user warning: those are reserved to the reduced-fidelity VB load, 009 FR-063).
/// </summary>
public static class ResolutionWarnings
{
    /// <summary>Type-or-namespace-not-found diagnostics (CS0246, CS0234).</summary>
    private static readonly HashSet<string> Unresolved = new(StringComparer.Ordinal) { "CS0246", "CS0234" };

    public static List<string> For(IEnumerable<Compilation> compilations)
    {
        var warnings = new List<string>();
        foreach (var compilation in compilations.Where(c => c.Language == LanguageNames.CSharp)
                     .OrderBy(c => c.AssemblyName, StringComparer.Ordinal))
        {
            var count = compilation.GetDeclarationDiagnostics()
                .Where(d => Unresolved.Contains(d.Id))
                .Count(d => !IsInUsingDirective(d));
            if (count > 0)
            {
                warnings.Add($"C# project '{compilation.AssemblyName}' analyzed with {count} unresolved type references "
                    + "(missing .NET targeting pack or package restore): base types and coupling of the affected "
                    + "components may be incomplete. Install the .NET SDK of the project (see global.json) and restore it.");
            }
        }
        return warnings;
    }

    private static bool IsInUsingDirective(Diagnostic diagnostic)
    {
        var tree = diagnostic.Location.SourceTree;
        if (tree is null) return false;
        var node = tree.GetRoot().FindNode(diagnostic.Location.SourceSpan, getInnermostNodeForTie: true);
        return node.AncestorsAndSelf().Any(n => n is UsingDirectiveSyntax);
    }
}
