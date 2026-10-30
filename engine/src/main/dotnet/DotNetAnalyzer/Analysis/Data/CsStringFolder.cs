using System.Text;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace DotNetAnalyzer.Analysis.Data;

/// <summary>
/// C# counterpart of <see cref="Vb.VbStringFolder"/> (020, research D2): folds <c>+</c> concatenations and
/// <c>string.Concat</c> of literals (regular, verbatim, raw) into one text; every non-literal part becomes
/// <see cref="Hole"/>.
/// </summary>
public static class CsStringFolder
{
    /// <summary>Marker of a non-literal part.</summary>
    public const char Hole = Vb.VbStringFolder.Hole;

    /// <summary>True for string literals and interpolated strings.</summary>
    public static bool IsStringLeaf(SyntaxNode node) =>
        node.IsKind(SyntaxKind.StringLiteralExpression) || node is InterpolatedStringExpressionSyntax;

    /// <summary>The outermost concatenation (or parentheses) containing <paramref name="literal"/>.</summary>
    public static ExpressionSyntax Top(ExpressionSyntax literal)
    {
        var current = literal;
        while (current.Parent is ExpressionSyntax parent && IsFoldable(parent))
            current = parent;
        return current;
    }

    /// <summary>Folded text of <paramref name="expression"/>.</summary>
    public static string Fold(ExpressionSyntax expression)
    {
        var builder = new StringBuilder();
        Append(expression, builder);
        return builder.ToString();
    }

    /// <summary>Folded text when the expression contains no hole, otherwise null.</summary>
    public static string? FoldLiteral(ExpressionSyntax expression)
    {
        var text = Fold(expression);
        return text.Contains(Hole) ? null : text;
    }

    private static bool IsFoldable(ExpressionSyntax node) =>
        node is ParenthesizedExpressionSyntax || node.IsKind(SyntaxKind.AddExpression);

    private static void Append(ExpressionSyntax expression, StringBuilder builder)
    {
        switch (expression)
        {
            case LiteralExpressionSyntax literal when literal.IsKind(SyntaxKind.StringLiteralExpression):
                builder.Append(literal.Token.ValueText);
                break;
            case InterpolatedStringExpressionSyntax interpolated:
                foreach (var content in interpolated.Contents)
                {
                    if (content is InterpolatedStringTextSyntax text)
                        builder.Append(text.TextToken.ValueText);
                    else
                        builder.Append(Hole);
                }

                break;
            case ParenthesizedExpressionSyntax parenthesized:
                Append(parenthesized.Expression, builder);
                break;
            case BinaryExpressionSyntax binary when binary.IsKind(SyntaxKind.AddExpression):
                Append(binary.Left, builder);
                Append(binary.Right, builder);
                break;
            case InvocationExpressionSyntax { Expression: MemberAccessExpressionSyntax { Name.Identifier.ValueText: "Concat" } } concat:
                foreach (var argument in concat.ArgumentList.Arguments)
                    Append(argument.Expression, builder);
                break;
            default:
                builder.Append(Hole);
                break;
        }
    }
}
