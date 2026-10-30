using DotNetAnalyzer.Model;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.VisualBasic;
using Microsoft.CodeAnalysis.VisualBasic.Syntax;

namespace DotNetAnalyzer.Analysis.Vb;

/// <summary>
/// 024 (FR-040): maintainability index of a type with the Microsoft formula
/// <c>max(0, (171 − 5.2·ln(HV) − 0.23·CC − 16.2·ln(LOC)) × 100 / 171)</c> where HV is the Halstead volume of the
/// type's tokens (operators = keywords and punctuation, operands = identifiers and literals), CC the sum of the
/// cyclomatic complexities of its methods and LOC the component's lines. Emitted as the annotation
/// <c>Maintainability:&lt;0-100&gt;</c> for components with at least one method.
/// </summary>
public static class VbMaintainabilityCalculator
{
    public const string AnnotationPrefix = "Maintainability:";

    public static void Calculate(VbTypeIndex index, List<Component> components)
    {
        var byId = components.ToDictionary(c => c.Id, c => c, StringComparer.Ordinal);
        foreach (var group in index.Types.GroupBy(t => t.Id, StringComparer.Ordinal))
        {
            if (!byId.TryGetValue(group.Key, out var component))
                continue;
            if (component.Annotations.Any(a => a.StartsWith(AnnotationPrefix, StringComparison.Ordinal)))
                continue;
            var operators = new Dictionary<string, int>(StringComparer.Ordinal);
            var operands = new Dictionary<string, int>(StringComparer.Ordinal);
            var complexity = 0;
            var methods = 0;
            foreach (var entry in group)
            {
                foreach (var method in entry.Block.Members.OfType<MethodBlockSyntax>())
                {
                    methods++;
                    complexity += VbMetricsCalculator.CyclomaticComplexity(method);
                }
                foreach (var node in index.OwnNodes(entry))
                {
                    foreach (var token in node.ChildTokens())
                        Count(token, operators, operands);
                }
            }
            if (methods == 0)
                continue;
            var n1 = operators.Count;
            var n2 = operands.Count;
            var bigN = operators.Values.Sum() + operands.Values.Sum();
            var vocabulary = n1 + n2;
            var volume = vocabulary > 0 && bigN > 0 ? bigN * Math.Log2(vocabulary) : 1.0;
            var loc = Math.Max(1, component.Loc);
            var mi = (171 - 5.2 * Math.Log(Math.Max(1.0, volume)) - 0.23 * complexity - 16.2 * Math.Log(loc)) * 100 / 171;
            var rounded = (int)Math.Round(Math.Max(0, Math.Min(100, mi)), MidpointRounding.AwayFromZero);
            component.Annotations.Add(AnnotationPrefix + rounded);
        }
    }

    private static void Count(SyntaxToken token, Dictionary<string, int> operators, Dictionary<string, int> operands)
    {
        if (token.IsKind(SyntaxKind.StatementTerminatorToken) || token.IsKind(SyntaxKind.EndOfFileToken) || token.IsKind(SyntaxKind.None))
            return;
        if (token.IsKind(SyntaxKind.IdentifierToken) || SyntaxFacts.IsLiteralExpression(token.Kind())
            || token.IsKind(SyntaxKind.IntegerLiteralToken) || token.IsKind(SyntaxKind.StringLiteralToken)
            || token.IsKind(SyntaxKind.FloatingLiteralToken) || token.IsKind(SyntaxKind.DecimalLiteralToken)
            || token.IsKind(SyntaxKind.CharacterLiteralToken) || token.IsKind(SyntaxKind.DateLiteralToken))
            operands[token.ValueText] = operands.GetValueOrDefault(token.ValueText) + 1;
        else
            operators[token.Kind().ToString()] = operators.GetValueOrDefault(token.Kind().ToString()) + 1;
    }
}
