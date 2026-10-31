using System.Security.Cryptography;
using System.Text;
using DotNetAnalyzer.Model;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.VisualBasic;
using Microsoft.CodeAnalysis.VisualBasic.Syntax;

namespace DotNetAnalyzer.Analysis.Vb;

/// <summary>
/// 024 (FR-030): <c>DUPLICATED_CODE</c> for methods whose normalized token sequence (identifiers → ID, literals →
/// LIT, trivia dropped) has at least <c>analysis.duplicateMinTokens</c> tokens and the same SHA-256 hash in two or
/// more components. Deterministic by construction; the message lists the other components in ordinal order.
/// </summary>
public static class VbDuplicationAnalyzer
{
    public const string Rule = "DUPLICATED_CODE";

    private sealed record Occurrence(Component Component, string File, int Line, string Method);

    public static void Analyze(VbTypeIndex index, List<Component> components, int minTokens)
    {
        var byId = components.ToDictionary(c => c.Id, c => c, StringComparer.Ordinal);
        var groups = new Dictionary<string, List<Occurrence>>(StringComparer.Ordinal);
        foreach (var entry in index.Types)
        {
            if (!byId.TryGetValue(entry.Id, out var component))
                continue;
            var file = string.IsNullOrEmpty(entry.Block.SyntaxTree.FilePath) ? "unknown" : Path.GetFileName(entry.Block.SyntaxTree.FilePath);
            foreach (var method in entry.Block.Members.OfType<MethodBlockSyntax>())
            {
                var tokens = Normalize(method);
                if (tokens.Count < minTokens)
                    continue;
                var hash = Hash(tokens);
                var line = method.GetLocation().GetLineSpan().StartLinePosition.Line + 1;
                groups.TryAdd(hash, new List<Occurrence>());
                groups[hash].Add(new Occurrence(component, file, line, method.SubOrFunctionStatement.Identifier.ValueText));
            }
        }

        foreach (var group in groups.Values)
        {
            var componentIds = group.Select(o => o.Component.Id).Distinct(StringComparer.Ordinal).OrderBy(id => id, StringComparer.Ordinal).ToList();
            if (componentIds.Count < 2)
                continue;
            foreach (var occurrence in group)
            {
                var others = componentIds.Where(id => id != occurrence.Component.Id).ToList();
                occurrence.Component.CodeIssues.Add(new CodeIssue
                {
                    Rule = Rule,
                    Type = "CODE_STYLE",
                    Severity = "WARNING",
                    Message = $"Method '{occurrence.Method}' duplicates code found in: {string.Join(", ", others)}. Extract a shared implementation.",
                    Line = occurrence.Line,
                    Location = $"{occurrence.File}:{occurrence.Line}",
                });
            }
        }
    }

    /// <summary>Normalized tokens of a method body: keywords and punctuation as written, identifiers as ID, literals as LIT.</summary>
    public static List<string> Normalize(MethodBlockSyntax method)
    {
        var tokens = new List<string>();
        foreach (var statement in method.Statements)
        {
            foreach (var token in statement.DescendantTokens())
            {
                if (token.IsKind(SyntaxKind.IdentifierToken))
                    tokens.Add("ID");
                else if (SyntaxFacts.IsPredefinedType(token.Kind()))
                    tokens.Add(token.ValueText.ToUpperInvariant());
                else if (token.IsKind(SyntaxKind.IntegerLiteralToken) || token.IsKind(SyntaxKind.StringLiteralToken)
                         || token.IsKind(SyntaxKind.FloatingLiteralToken) || token.IsKind(SyntaxKind.DecimalLiteralToken)
                         || token.IsKind(SyntaxKind.CharacterLiteralToken) || token.IsKind(SyntaxKind.DateLiteralToken))
                    tokens.Add("LIT");
                else if (token.IsKind(SyntaxKind.StatementTerminatorToken) || token.IsKind(SyntaxKind.EndOfFileToken))
                    continue;
                else
                    tokens.Add(token.ValueText.ToUpperInvariant());
            }
        }
        return tokens;
    }

    private static string Hash(List<string> tokens)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(string.Join(" ", tokens)));
        return Convert.ToHexString(bytes);
    }
}
