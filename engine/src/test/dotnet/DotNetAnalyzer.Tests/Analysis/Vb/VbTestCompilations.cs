using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.VisualBasic;

namespace DotNetAnalyzer.Tests.Analysis.Vb;

/// <summary>Builds in-memory VB compilations for unit tests of the 009 VB analyzers.</summary>
internal static class VbTestCompilations
{
    public static Compilation Create(params (string Path, string Source)[] files)
    {
        var trees = files.Select(f => VisualBasicSyntaxTree.ParseText(f.Source, path: f.Path)).ToArray();
        var references = AppDomain.CurrentDomain.GetAssemblies()
            .Select(a => a.Location)
            .Where(l => !string.IsNullOrEmpty(l) && File.Exists(l))
            .Select(l => (MetadataReference)MetadataReference.CreateFromFile(l))
            .ToArray();
        return VisualBasicCompilation.Create("VbTests", trees, references);
    }
}
