using DotNetAnalyzer.Analysis.Vb;
using FluentAssertions;
using Microsoft.CodeAnalysis.VisualBasic;
using Microsoft.CodeAnalysis.VisualBasic.Syntax;
using Xunit;

namespace DotNetAnalyzer.Tests.Analysis.Vb;

[Trait("Category", "VbLegacy")]
public class VbStringFolderTests
{
    private static string FoldFirstLiteral(string expression)
    {
        var tree = VisualBasicSyntaxTree.ParseText($"Module M\n Sub S(id As Integer)\n Dim x = {expression}\n End Sub\nEnd Module\n");
        var literal = tree.GetRoot().DescendantNodes().OfType<ExpressionSyntax>().First(VbStringFolder.IsStringLeaf);
        return VbStringFolder.Fold(VbStringFolder.Top(literal));
    }

    [Fact]
    public void Concatenations_with_line_continuations_are_folded()
    {
        FoldFirstLiteral("\"SELECT a \" & _\n \"FROM T \" + _\n \"WHERE 1 = 1\"")
            .Should().Be("SELECT a FROM T WHERE 1 = 1");
    }

    [Fact]
    public void Non_literal_parts_become_holes()
    {
        FoldFirstLiteral("\"WHERE Id = \" & id.ToString() & \";\"")
            .Should().Be("WHERE Id = " + VbStringFolder.Hole + ";");
    }

    [Fact]
    public void Parentheses_and_interpolations_are_folded()
    {
        FoldFirstLiteral("(\"A\" & \"B\") & $\"C{id}D\"")
            .Should().Be("ABC" + VbStringFolder.Hole + "D");
    }

    [Fact]
    public void A_lone_literal_is_its_own_top()
    {
        FoldFirstLiteral("\"plain\"").Should().Be("plain");
    }
}
