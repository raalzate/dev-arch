using System.Text;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.VisualBasic;
using Microsoft.CodeAnalysis.VisualBasic.Syntax;

namespace DotNetAnalyzer.Analysis.Vb;

/// <summary>
/// Folds VB string concatenations (<c>&amp;</c> / <c>+</c>, parentheses, line continuations) of literals into one
/// text; every non-literal part becomes <see cref="Hole"/> so it can never produce a table name
/// (009-vb-legacy-completion, data-model §SQL, research D4).
/// </summary>
public static class VbStringFolder
{
    /// <summary>Marker of a non-literal part of a folded concatenation.</summary>
    public const char Hole = '\u0001';

    /// <summary>
    /// The outermost concatenation (or parenthesized expression) that contains <paramref name="literal"/>,
    /// or the literal itself when it is not part of a concatenation.
    /// </summary>
    public static ExpressionSyntax Top(ExpressionSyntax literal)
    {
        var current = literal;
        while (current.Parent is ExpressionSyntax parent && IsFoldable(parent))
        {
            current = parent;
        }

        return current;
    }

    /// <summary>True for string literals and interpolated strings (the leaves that start a fold).</summary>
    public static bool IsStringLeaf(SyntaxNode node) =>
        node.IsKind(SyntaxKind.StringLiteralExpression) || node is InterpolatedStringExpressionSyntax;

    /// <summary>Folded text of <paramref name="expression"/>.</summary>
    public static string Fold(ExpressionSyntax expression)
    {
        var builder = new StringBuilder();
        Append(expression, builder);
        return builder.ToString();
    }

    private static bool IsFoldable(ExpressionSyntax node) =>
        node is ParenthesizedExpressionSyntax
        || node.IsKind(SyntaxKind.ConcatenateExpression)
        || node.IsKind(SyntaxKind.AddExpression);

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
            case BinaryExpressionSyntax binary when IsFoldable(binary):
                Append(binary.Left, builder);
                Append(binary.Right, builder);
                break;
            default:
                builder.Append(Hole);
                break;
        }
    }
}
