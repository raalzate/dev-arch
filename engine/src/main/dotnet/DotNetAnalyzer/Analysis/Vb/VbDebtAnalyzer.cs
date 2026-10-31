using DotNetAnalyzer.Model;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.VisualBasic;
using Microsoft.CodeAnalysis.VisualBasic.Syntax;

namespace DotNetAnalyzer.Analysis.Vb;

/// <summary>
/// Pass 11c (VB, 021-desktop-identity-layers, data-model §Reglas de deuda): six deterministic, syntactic legacy
/// debt rules — PROJECT_OPTION_STRICT_OFF, UI_CALL_IN_BUSINESS_LAYER, SQL_CONCAT_INJECTION, STATIC_FACADE,
/// MIXED_TRANSACTION_MODELS and GOD_CLASS — gated by <c>debt.enabled</c>. Runs after 7b (metrics) and 8b (fine layers).
/// </summary>
public static class VbDebtAnalyzer
{
    private static readonly string[] UiCalls = { "MsgBox", "InputBox" };

    private static readonly string[] SqlKeywords = { "SELECT", "INSERT", "UPDATE", "DELETE", "MERGE", "EXEC", "WHERE" };

    /// <summary>Whether the pass runs for a compilation of <paramref name="language"/>.</summary>
    public static bool Enabled(DebtOptions options, string language) => options.Enabled switch
    {
        DebtMode.On => true,
        DebtMode.Off => false,
        _ => language == LanguageNames.VisualBasic,
    };

    /// <summary>Diagnostic line stating the effective state (not a user warning).</summary>
    public static string StateDiagnostic(DebtOptions options, string language) =>
        $"Legacy debt rules: {(Enabled(options, language) ? "on" : "off")} for "
        + $"{(language == LanguageNames.VisualBasic ? "Visual Basic" : "C#")} ({(options.Enabled == DebtMode.Auto ? "auto" : "config")})";

    /// <summary>Adds the debt issues of every component of <paramref name="index"/> and re-orders all issues.</summary>
    public static void Analyze(VbTypeIndex index, List<Component> components, VbProjectFile? project, DebtOptions options)
    {
        var byId = components.GroupBy(c => c.Id, StringComparer.Ordinal).ToDictionary(g => g.Key, g => g.First(), StringComparer.Ordinal);
        foreach (var group in index.Types.GroupBy(t => t.Id, StringComparer.Ordinal))
        {
            if (!byId.TryGetValue(group.Key, out var component))
                continue;
            try
            {
                AnalyzeType(index, group.ToList(), component, project, options);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[WARN] VbDebtAnalyzer: error analyzing type '{group.Key}': {ex.Message}");
            }
        }

        foreach (var component in components)
        {
            component.CodeIssues = component.CodeIssues
                .OrderBy(i => i.Location ?? string.Empty, StringComparer.Ordinal)
                .ThenBy(i => i.Rule, StringComparer.Ordinal)
                .ToList();
        }
    }

    private static void AnalyzeType(VbTypeIndex index, List<VbTypeEntry> entries, Component component, VbProjectFile? project, DebtOptions options)
    {
        var file = FileName(entries[0].Block.SyntaxTree);
        var isPresentation = component.Annotations.Contains(VbLayerClassifier.PresentationAnnotation, StringComparer.Ordinal);

        if (project is { OptionStrictOff: true })
        {
            component.CodeIssues.Add(new CodeIssue
            {
                Rule = "PROJECT_OPTION_STRICT_OFF",
                Type = "CODE_STYLE",
                Severity = "WARNING",
                Message = $"The project '{project.FileName}' compiles with Option Strict Off. Enable Option Strict On in the project.",
                Line = 0,
                Location = project.FileName,
            });
        }

        var transactionScope = 0;
        var legacyTransaction = false;
        foreach (var entry in entries)
        {
            foreach (var node in index.OwnNodes(entry))
            {
                switch (node)
                {
                    case InvocationExpressionSyntax invocation when !isPresentation && IsUiCall(invocation):
                        Add(component, file, Line(invocation), "UI_CALL_IN_BUSINESS_LAYER", "BUG_PATTERN", "WARNING",
                            "User-interface call (MsgBox/MessageBox/InputBox) outside the presentation layer. Move the interaction to a form or raise an event.");
                        break;
                    case AssignmentStatementSyntax { Left: MemberAccessExpressionSyntax { Name.Identifier.ValueText: "CommandText" } } assignment
                        when assignment.IsKind(SyntaxKind.SimpleAssignmentStatement) && IsConcatenatedSql(assignment.Right):
                        AddSqlConcat(component, file, Line(assignment));
                        break;
                    case InvocationExpressionSyntax { Expression: MemberAccessExpressionSyntax { Name.Identifier.ValueText: "GetSqlStringCommand" } } sqlString
                        when FirstArgument(sqlString) is { } sqlArgument && IsConcatenatedSql(sqlArgument):
                        AddSqlConcat(component, file, Line(sqlString));
                        break;
                    case ObjectCreationExpressionSyntax creation
                        when creation.Type.ToString().EndsWith("Command", StringComparison.Ordinal)
                             && creation.ArgumentList?.Arguments.FirstOrDefault() is SimpleArgumentSyntax { IsNamed: false } first
                             && IsConcatenatedSql(first.Expression):
                        AddSqlConcat(component, file, Line(creation));
                        break;
                    case IdentifierNameSyntax identifier:
                        var name = identifier.Identifier.ValueText;
                        if (name == "TransactionScope" && transactionScope == 0)
                            transactionScope = Line(identifier);
                        else if (name == "BeginTransaction" || (name.EndsWith("Transaction", StringComparison.Ordinal) && name != "TransactionScope"))
                            legacyTransaction = true;
                        break;
                }
            }
        }

        if (transactionScope > 0 && legacyTransaction)
        {
            Add(component, file, transactionScope, "MIXED_TRANSACTION_MODELS", "BUG_PATTERN", "WARNING",
                "The component mixes ADO.NET transactions (BeginTransaction/DbTransaction) with TransactionScope. Use one transaction model.");
        }

        var classBlock = entries.Select(e => e.Block).OfType<ClassBlockSyntax>().FirstOrDefault();
        if (classBlock != null && IsStaticFacade(entries))
        {
            Add(component, file, Line(classBlock), "STATIC_FACADE", "CODE_STYLE", "INFO",
                "Static facade: every member is Shared and the class holds mutable Shared state. Consider an instance with injected dependencies.");
        }

        if (classBlock != null && component.Loc > options.GodClassMinLoc && (component.ComplexityMax ?? 0) > options.GodClassMinComplexity)
        {
            Add(component, file, Line(classBlock), "GOD_CLASS", "CODE_STYLE", "WARNING",
                $"Type '{classBlock.BlockStatement.Identifier.ValueText}' has {component.Loc} lines of code and a maximum method complexity of "
                + $"{component.ComplexityMax} (thresholds {options.GodClassMinLoc} and {options.GodClassMinComplexity}). Split it by responsibility.");
        }
    }

    private static bool IsUiCall(InvocationExpressionSyntax invocation) => invocation.Expression switch
    {
        IdentifierNameSyntax identifier => UiCalls.Contains(identifier.Identifier.ValueText, StringComparer.Ordinal),
        MemberAccessExpressionSyntax { Name.Identifier.ValueText: "Show", Expression: IdentifierNameSyntax { Identifier.ValueText: "MessageBox" } } => true,
        MemberAccessExpressionSyntax { Name.Identifier.ValueText: "Show", Expression: MemberAccessExpressionSyntax { Name.Identifier.ValueText: "MessageBox" } } => true,
        MemberAccessExpressionSyntax access when UiCalls.Contains(access.Name.Identifier.ValueText, StringComparer.Ordinal)
            && access.Expression.ToString().EndsWith("Interaction", StringComparison.Ordinal) => true,
        _ => false,
    };

    private static ExpressionSyntax? FirstArgument(InvocationExpressionSyntax invocation) =>
        invocation.ArgumentList?.Arguments.FirstOrDefault() is SimpleArgumentSyntax { IsNamed: false } argument ? argument.Expression : null;

    /// <summary>A folded text with at least one hole (non-literal part) and a SQL keyword in its literal parts.</summary>
    private static bool IsConcatenatedSql(ExpressionSyntax expression)
    {
        var folded = VbStringFolder.Fold(expression);
        if (!folded.Contains(VbStringFolder.Hole))
            return false;
        var literalText = folded.Replace(VbStringFolder.Hole, ' ');
        return SqlKeywords.Any(k => literalText.Contains(k, StringComparison.OrdinalIgnoreCase));
    }

    private static void AddSqlConcat(Component component, string file, int line) =>
        Add(component, file, line, "SQL_CONCAT_INJECTION", "SECURITY", "CRITICAL",
            "SQL text built by concatenating non-literal values. Use parameters (@p) instead of string concatenation.");

    /// <summary>Class whose methods and properties are all Shared, with at least one mutable Shared field and no instance members.</summary>
    private static bool IsStaticFacade(List<VbTypeEntry> entries)
    {
        var members = entries.Select(e => e.Block).OfType<ClassBlockSyntax>().SelectMany(c => c.Members).ToList();
        if (members.Count == 0)
            return false;
        var mutableSharedField = false;
        foreach (var member in members)
        {
            switch (member)
            {
                case FieldDeclarationSyntax field:
                    var shared = Has(field.Modifiers, SyntaxKind.SharedKeyword);
                    var constant = Has(field.Modifiers, SyntaxKind.ConstKeyword) || Has(field.Modifiers, SyntaxKind.ReadOnlyKeyword);
                    if (!shared && !Has(field.Modifiers, SyntaxKind.ConstKeyword))
                        return false;
                    if (shared && !constant)
                        mutableSharedField = true;
                    break;
                case MethodBlockSyntax method:
                    if (!Has(method.SubOrFunctionStatement.Modifiers, SyntaxKind.SharedKeyword))
                        return false;
                    break;
                case MethodStatementSyntax statement:
                    if (!Has(statement.Modifiers, SyntaxKind.SharedKeyword))
                        return false;
                    break;
                case PropertyBlockSyntax property:
                    if (!Has(property.PropertyStatement.Modifiers, SyntaxKind.SharedKeyword))
                        return false;
                    break;
                case PropertyStatementSyntax propertyStatement:
                    if (!Has(propertyStatement.Modifiers, SyntaxKind.SharedKeyword))
                        return false;
                    break;
                case ConstructorBlockSyntax:
                    break;
                case EventStatementSyntax @event:
                    if (!Has(@event.Modifiers, SyntaxKind.SharedKeyword))
                        return false;
                    break;
            }
        }

        return mutableSharedField;
    }

    private static bool Has(SyntaxTokenList modifiers, SyntaxKind kind) => modifiers.Any(m => m.IsKind(kind));

    private static string FileName(SyntaxTree tree) =>
        string.IsNullOrEmpty(tree.FilePath) ? "unknown" : Path.GetFileName(tree.FilePath);

    private static int Line(SyntaxNode node) => node.GetLocation().GetLineSpan().StartLinePosition.Line + 1;

    private static void Add(Component component, string file, int line, string rule, string type, string severity, string message)
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
