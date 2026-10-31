using DotNetAnalyzer.Analysis.Data;
using FluentAssertions;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Xunit;

namespace DotNetAnalyzer.Tests.Analysis.Data;

public class CsStringFolderTests
{
    private static ExpressionSyntax Expr(string code) =>
        SyntaxFactory.ParseExpression(code);

    [Theory]
    [InlineData("\"usp_\" + \"Policy\" + \"_Read\"", "usp_Policy_Read")]
    [InlineData("(\"usp_\" + \"Policy\")", "usp_Policy")]
    [InlineData("string.Concat(\"usp_\", \"Policy\")", "usp_Policy")]
    [InlineData("@\"dbo.usp_X\"", "dbo.usp_X")]
    [InlineData("$\"usp_{name}\"", "usp_\u0001")]
    [InlineData("\"usp_\" + name", "usp_\u0001")]
    public void Folds_literals_and_marks_holes(string code, string expected) =>
        CsStringFolder.Fold(Expr(code)).Should().Be(expected);

    [Fact]
    public void FoldLiteral_is_null_when_a_hole_remains()
    {
        CsStringFolder.FoldLiteral(Expr("\"usp_\" + name")).Should().BeNull();
        CsStringFolder.FoldLiteral(Expr("\"usp_\" + \"X\"")).Should().Be("usp_X");
    }

    [Fact]
    public void Top_climbs_to_the_outermost_concatenation()
    {
        var expr = Expr("(\"a\" + \"b\") + \"c\"");
        var leaf = expr.DescendantNodes().OfType<LiteralExpressionSyntax>().First();
        CsStringFolder.Top(leaf).Should().BeSameAs(expr);
    }
}
