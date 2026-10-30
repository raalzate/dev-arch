using DotNetAnalyzer.Analysis.Vb;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.VisualBasic;
using Microsoft.CodeAnalysis.VisualBasic.Syntax;

namespace DotNetAnalyzer.Analysis.Data;

/// <summary>Visual Basic adapter of <see cref="IProcedureCallSyntax"/> over a <see cref="VbTypeIndex"/> entry.</summary>
public sealed class VisualBasicProcedureCallSyntax : IProcedureCallSyntax
{
    private readonly VbTypeIndex _index;
    private readonly VbTypeEntry _entry;

    private VisualBasicProcedureCallSyntax(VbTypeIndex index, VbTypeEntry entry)
    {
        _index = index;
        _entry = entry;
    }

    public static IEnumerable<IProcedureCallSyntax> ForIndex(VbTypeIndex index) =>
        index.Types.Select(entry => (IProcedureCallSyntax)new VisualBasicProcedureCallSyntax(index, entry));

    public string ComponentId => _entry.Id;

    public string FileName => Path.GetFileName(_entry.Block.SyntaxTree.FilePath ?? "") is { Length: > 0 } f ? f : "unknown";

    public IEnumerable<CallCandidate> Invocations()
    {
        foreach (var invocation in _index.OwnNodes(_entry).OfType<InvocationExpressionSyntax>())
        {
            var name = invocation.Expression switch
            {
                MemberAccessExpressionSyntax access => access.Name.Identifier.ValueText,
                IdentifierNameSyntax identifier => identifier.Identifier.ValueText,
                GenericNameSyntax generic => generic.Identifier.ValueText,
                _ => null,
            };
            if (name == null)
                continue;
            if (invocation.Expression is MemberAccessExpressionSyntax { Name: GenericNameSyntax g })
                name = g.Identifier.ValueText;

            var positional = new List<string?>();
            var named = new Dictionary<string, string>(StringComparer.Ordinal);
            foreach (var argument in invocation.ArgumentList?.Arguments ?? default)
            {
                if (argument is SimpleArgumentSyntax simple)
                {
                    if (simple.IsNamed)
                        named[simple.NameColonEquals!.Name.Identifier.ValueText] = MemberText(simple.Expression);
                    else
                        positional.Add(Literal(simple.Expression));
                }
                else
                {
                    positional.Add(null);
                }
            }

            yield return new CallCandidate(name, positional, named, Line(invocation));
        }
    }

    public bool UsesStoredProcedureCommandType() =>
        _index.OwnNodes(_entry).OfType<MemberAccessExpressionSyntax>()
            .Any(m => m.Name.Identifier.ValueText == "StoredProcedure");

    public IEnumerable<TextCandidate> CommandTexts()
    {
        foreach (var node in _index.OwnNodes(_entry))
        {
            switch (node)
            {
                case AssignmentStatementSyntax { Left: MemberAccessExpressionSyntax { Name.Identifier.ValueText: "CommandText" } } assignment
                    when assignment.IsKind(SyntaxKind.SimpleAssignmentStatement):
                    yield return new TextCandidate(Literal(assignment.Right), Line(assignment));
                    break;
                case NamedFieldInitializerSyntax { Name.Identifier.ValueText: "CommandText" } initializer:
                    yield return new TextCandidate(Literal(initializer.Expression), Line(initializer));
                    break;
                case ObjectCreationExpressionSyntax creation
                    when creation.Type.ToString().EndsWith("Command", StringComparison.Ordinal)
                         && creation.ArgumentList?.Arguments.FirstOrDefault() is SimpleArgumentSyntax { IsNamed: false } first:
                    yield return new TextCandidate(Literal(first.Expression), Line(creation));
                    break;
            }
        }
    }

    private static string? Literal(ExpressionSyntax expression)
    {
        var text = VbStringFolder.Fold(expression);
        return text.Contains(VbStringFolder.Hole) ? null : text;
    }

    private static string MemberText(ExpressionSyntax expression) => expression switch
    {
        MemberAccessExpressionSyntax access => access.Name.Identifier.ValueText,
        _ => expression.ToString(),
    };

    private static int Line(SyntaxNode node) => node.GetLocation().GetLineSpan().StartLinePosition.Line + 1;
}
