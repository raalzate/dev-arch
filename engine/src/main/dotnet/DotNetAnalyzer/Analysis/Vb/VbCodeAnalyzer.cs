using DotNetAnalyzer.Model;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.Operations;
using Microsoft.CodeAnalysis.VisualBasic;
using Microsoft.CodeAnalysis.VisualBasic.Syntax;

namespace DotNetAnalyzer.Analysis.Vb;

/// <summary>
/// Pass 11b (VB only): code issues of VB legacy code (<c>On Error Resume Next</c>, <c>Option Strict Off</c>,
/// <c>GoTo</c>, late binding) and the general patterns of the C# analyzer ported to VB syntax
/// (009-vb-legacy-completion, data-model §Code issues VB, research D6). Issues are finally ordered by
/// (location, rule), as <see cref="RoslynCodeAnalyzer"/> does.
/// </summary>
public static class VbCodeAnalyzer
{
    private static readonly string[] SecretKeywords =
    {
        "password", "passwd", "secret", "apikey", "api_key", "token", "accesstoken", "access_token", "connectionstring",
    };

    private static readonly string[] LateBindingFactories = { "CreateObject", "GetObject" };

    /// <summary>Adds the VB code issues of every component of <paramref name="index"/> and orders all issues.</summary>
    public static void Analyze(VbTypeIndex index, List<Component> components)
    {
        var byId = components.GroupBy(c => c.Id, StringComparer.Ordinal).ToDictionary(g => g.Key, g => g.First(), StringComparer.Ordinal);
        foreach (var entry in index.Types)
        {
            if (!byId.TryGetValue(entry.Id, out var component))
                continue;
            try
            {
                Analyze(index, entry, component);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[WARN] VbCodeAnalyzer: error analyzing type '{entry.Id}': {ex.Message}");
            }
        }

        foreach (var group in index.Types.GroupBy(t => t.Block.SyntaxTree))
        {
            AddOptionStrictOff(group.Key, group.Select(e => e.Id).Distinct(StringComparer.Ordinal), byId);
        }

        foreach (var component in components)
        {
            component.CodeIssues = component.CodeIssues
                .OrderBy(i => i.Location ?? string.Empty, StringComparer.Ordinal)
                .ThenBy(i => i.Rule, StringComparer.Ordinal)
                .ToList();
        }
    }

    private static void Analyze(VbTypeIndex index, VbTypeEntry entry, Component component)
    {
        var file = FileName(entry.Block.SyntaxTree);
        var lateBoundLines = new SortedSet<int>();
        foreach (var node in index.OwnNodes(entry))
        {
            switch (node)
            {
                case OnErrorResumeNextStatementSyntax:
                    Add(component, file, node, "ON_ERROR_RESUME_NEXT", "BUG_PATTERN", "WARNING",
                        "'On Error Resume Next' silently ignores run-time errors. Use structured exception handling (Try/Catch) instead.");
                    break;
                case GoToStatementSyntax:
                    Add(component, file, node, "GOTO_STATEMENT", "CODE_STYLE", "INFO",
                        "'GoTo' statement makes the control flow hard to follow. Use structured control flow instead.");
                    break;
                case CatchBlockSyntax catchBlock:
                    AnalyzeCatch(component, file, catchBlock);
                    break;
                case SelectBlockSyntax select when !select.CaseBlocks.Any(c => c.IsKind(SyntaxKind.CaseElseBlock)):
                    Add(component, file, select, "MISSING_SWITCH_DEFAULT", "BUG_PATTERN", "INFO",
                        "Select Case statement is missing a 'Case Else' clause.");
                    break;
                case VariableDeclaratorSyntax declarator:
                    AnalyzeDeclarator(component, file, declarator);
                    break;
                case InvocationExpressionSyntax or MemberAccessExpressionSyntax or ObjectCreationExpressionSyntax:
                    if (IsLateBound((ExpressionSyntax)node, entry.Model))
                        lateBoundLines.Add(Line(node));
                    break;
            }
        }

        foreach (var line in lateBoundLines)
        {
            AddAt(component, file, line, "LATE_BINDING", "BUG_PATTERN", "WARNING",
                "Late-bound member access is resolved at run time. Declare a specific type and use Option Strict On.");
        }
    }

    private static void AnalyzeCatch(Component component, string file, CatchBlockSyntax catchBlock)
    {
        if (catchBlock.Statements.Count == 0)
        {
            Add(component, file, catchBlock, "EMPTY_CATCH_BLOCK", "BUG_PATTERN", "WARNING",
                "Empty catch block detected. Exceptions should not be swallowed.");
        }

        var typeName = catchBlock.CatchStatement.AsClause?.Type.ToString();
        var simpleName = typeName?.Split('.').Last().Trim();
        if (simpleName is "Exception" or "SystemException")
        {
            Add(component, file, catchBlock, "CATCH_GENERIC_EXCEPTION", "BUG_PATTERN", "INFO",
                $"Catching generic {simpleName} is generally discouraged. Use a more specific exception type.");
        }
    }

    private static void AnalyzeDeclarator(Component component, string file, VariableDeclaratorSyntax declarator)
    {
        if (declarator.Initializer?.Value is not LiteralExpressionSyntax literal
            || !literal.IsKind(SyntaxKind.StringLiteralExpression)
            || string.IsNullOrWhiteSpace(literal.Token.ValueText))
            return;

        foreach (var name in declarator.Names.Select(n => n.Identifier.ValueText))
        {
            if (!SecretKeywords.Any(k => name.Contains(k, StringComparison.OrdinalIgnoreCase)))
                continue;
            Add(component, file, declarator, "HARDCODED_SECRET_IN_CODE", "BUG_PATTERN", "CRITICAL",
                $"Hardcoded secret detected in variable '{name}'. Use configuration or secret management instead.");
            component.SensitiveData = true;
        }
    }

    private static bool IsLateBound(ExpressionSyntax node, SemanticModel model)
    {
        if (node is InvocationExpressionSyntax invocation
            && SimpleName(invocation.Expression) is { } name
            && LateBindingFactories.Any(f => f.Equals(name, StringComparison.OrdinalIgnoreCase)))
            return true;

        return model.GetOperation(node) is IDynamicMemberReferenceOperation or IDynamicInvocationOperation
            or IDynamicIndexerAccessOperation or IDynamicObjectCreationOperation;
    }

    private static string? SimpleName(ExpressionSyntax expression) => expression switch
    {
        IdentifierNameSyntax identifier => identifier.Identifier.ValueText,
        MemberAccessExpressionSyntax access => access.Name.Identifier.ValueText,
        _ => null,
    };

    private static void AddOptionStrictOff(SyntaxTree tree, IEnumerable<string> ids, IReadOnlyDictionary<string, Component> byId)
    {
        if (tree.GetRoot() is not CompilationUnitSyntax unit)
            return;
        var option = unit.Options.FirstOrDefault(o =>
            o.NameKeyword.IsKind(SyntaxKind.StrictKeyword) && o.ValueKeyword.IsKind(SyntaxKind.OffKeyword));
        if (option == null)
            return;
        foreach (var id in ids)
        {
            if (byId.TryGetValue(id, out var component))
            {
                Add(component, FileName(tree), option, "OPTION_STRICT_OFF", "CODE_STYLE", "WARNING",
                    "'Option Strict Off' allows implicit narrowing conversions and late binding. Use Option Strict On.");
            }
        }
    }

    private static string FileName(SyntaxTree tree) =>
        string.IsNullOrEmpty(tree.FilePath) ? "unknown" : Path.GetFileName(tree.FilePath);

    private static int Line(SyntaxNode node) => node.GetLocation().GetLineSpan().StartLinePosition.Line + 1;

    private static void Add(Component component, string file, SyntaxNode node, string rule, string type, string severity, string message) =>
        AddAt(component, file, Line(node), rule, type, severity, message);

    private static void AddAt(Component component, string file, int line, string rule, string type, string severity, string message)
    {
        component.CodeIssues.Add(new CodeIssue
        {
            Rule = rule,
            Type = type,
            Severity = severity,
            Message = message,
            Line = line,
            Location = $"{file}:{line}",
        });
    }
}
