using DotNetAnalyzer.Model;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.VisualBasic;
using Microsoft.CodeAnalysis.VisualBasic.Syntax;

namespace DotNetAnalyzer.Analysis.Vb;

/// <summary>
/// 024 (FR-020): <c>UNUSED_PUBLIC_MEMBER</c> for public/friend methods, properties and types whose name is never
/// referenced outside their own declaration in the compilation. Name-based and conservative: a name shared with a
/// referenced member counts as used. Excludes entry points, forms and controls (presentation), web methods and
/// operation contracts, implementations, overrides, handlers, events and constructors.
/// </summary>
public static class VbDeadCodeAnalyzer
{
    public const string Rule = "UNUSED_PUBLIC_MEMBER";

    private static readonly string[] ExcludedTypeAttributes = { "WebService", "ServiceContract", "ServiceBehavior" };
    private static readonly string[] ExcludedMemberAttributes = { "WebMethod", "OperationContract", "TestMethod", "Fact" };

    public static void Analyze(VbTypeIndex index, List<Component> components)
    {
        var occurrences = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        foreach (var tree in index.Types.Select(t => t.Block.SyntaxTree).Distinct())
        {
            foreach (var token in tree.GetRoot().DescendantTokens())
            {
                if (token.IsKind(SyntaxKind.IdentifierToken))
                    occurrences[token.ValueText] = occurrences.GetValueOrDefault(token.ValueText) + 1;
            }
        }

        var byId = components.ToDictionary(c => c.Id, c => c, StringComparer.Ordinal);
        foreach (var entry in index.Types)
        {
            if (!byId.TryGetValue(entry.Id, out var component))
                continue;
            if (IsExcludedType(entry, component))
                continue;
            var file = string.IsNullOrEmpty(entry.Block.SyntaxTree.FilePath) ? "unknown" : Path.GetFileName(entry.Block.SyntaxTree.FilePath);
            var typeName = entry.Block.BlockStatement.Identifier.ValueText;
            if (IsPublic(entry.Block.BlockStatement.Modifiers) && occurrences.GetValueOrDefault(typeName) <= 1 && !HasMain(entry.Block))
                Add(component, file, entry.Block.BlockStatement, typeName, "type");

            foreach (var member in entry.Block.Members)
            {
                switch (member)
                {
                    case MethodBlockSyntax method when IsCandidate(method.SubOrFunctionStatement.Modifiers, method.SubOrFunctionStatement.AttributeLists)
                                                        && method.SubOrFunctionStatement.HandlesClause == null
                                                        && method.SubOrFunctionStatement.ImplementsClause == null
                                                        && !string.Equals(method.SubOrFunctionStatement.Identifier.ValueText, "Main", StringComparison.OrdinalIgnoreCase):
                        Report(component, file, method.SubOrFunctionStatement, method.SubOrFunctionStatement.Identifier.ValueText, "method", occurrences);
                        break;
                    case MethodStatementSyntax statement when IsCandidate(statement.Modifiers, statement.AttributeLists)
                                                              && statement.HandlesClause == null && statement.ImplementsClause == null
                                                              && !string.Equals(statement.Identifier.ValueText, "Main", StringComparison.OrdinalIgnoreCase):
                        Report(component, file, statement, statement.Identifier.ValueText, "method", occurrences);
                        break;
                    case PropertyBlockSyntax property when IsCandidate(property.PropertyStatement.Modifiers, property.PropertyStatement.AttributeLists)
                                                           && property.PropertyStatement.ImplementsClause == null:
                        Report(component, file, property.PropertyStatement, property.PropertyStatement.Identifier.ValueText, "property", occurrences);
                        break;
                    case PropertyStatementSyntax autoProperty when IsCandidate(autoProperty.Modifiers, autoProperty.AttributeLists)
                                                                   && autoProperty.ImplementsClause == null:
                        Report(component, file, autoProperty, autoProperty.Identifier.ValueText, "property", occurrences);
                        break;
                }
            }
        }
    }

    private static void Report(Component component, string file, SyntaxNode node, string name, string kind, Dictionary<string, int> occurrences)
    {
        if (occurrences.GetValueOrDefault(name) <= 1)
            Add(component, file, node, name, kind);
    }

    private static void Add(Component component, string file, SyntaxNode node, string name, string kind)
    {
        var line = node.GetLocation().GetLineSpan().StartLinePosition.Line + 1;
        component.CodeIssues.Add(new CodeIssue
        {
            Rule = Rule,
            Type = "CODE_STYLE",
            Severity = "INFO",
            Message = $"Public {kind} '{name}' is never referenced in the analyzed sources. Remove it or make it private.",
            Line = line,
            Location = $"{file}:{line}",
        });
    }

    private static bool IsCandidate(SyntaxTokenList modifiers, SyntaxList<AttributeListSyntax> attributes)
    {
        if (!IsPublic(modifiers))
            return false;
        if (modifiers.Any(SyntaxKind.OverridesKeyword) || modifiers.Any(SyntaxKind.OverloadsKeyword) || modifiers.Any(SyntaxKind.ShadowsKeyword))
            return false;
        return !HasAttribute(attributes, ExcludedMemberAttributes);
    }

    private static bool IsPublic(SyntaxTokenList modifiers) =>
        modifiers.Any(SyntaxKind.PublicKeyword) || modifiers.Any(SyntaxKind.FriendKeyword);

    private static bool IsExcludedType(VbTypeEntry entry, Component component)
    {
        if (component.Annotations.Contains(VbLayerClassifier.PresentationAnnotation, StringComparer.Ordinal)
            || component.Annotations.Contains(VbLayerClassifier.ReportsAnnotation, StringComparer.Ordinal))
            return true;
        if (entry.Block is InterfaceBlockSyntax)
            return true;
        if (HasAttribute(entry.Block.BlockStatement.AttributeLists, ExcludedTypeAttributes))
            return true;
        return entry.Block.Inherits.SelectMany(i => i.Types).Select(t => t.ToString())
            .Any(b => b.EndsWith("Form", StringComparison.Ordinal) || b.EndsWith("UserControl", StringComparison.Ordinal)
                      || b.EndsWith("WebService", StringComparison.Ordinal) || b.EndsWith("Page", StringComparison.Ordinal));
    }

    private static bool HasMain(TypeBlockSyntax block) => block.Members.OfType<MethodBlockSyntax>()
        .Any(m => string.Equals(m.SubOrFunctionStatement.Identifier.ValueText, "Main", StringComparison.OrdinalIgnoreCase));

    private static bool HasAttribute(SyntaxList<AttributeListSyntax> lists, string[] names) =>
        lists.SelectMany(l => l.Attributes).Select(a => a.Name.ToString())
            .Any(n => names.Any(x => n.EndsWith(x, StringComparison.Ordinal) || n.EndsWith(x + "Attribute", StringComparison.Ordinal)));
}
