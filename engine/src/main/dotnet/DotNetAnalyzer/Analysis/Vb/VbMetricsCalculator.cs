using DotNetAnalyzer.Model;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.VisualBasic;
using Microsoft.CodeAnalysis.VisualBasic.Syntax;

namespace DotNetAnalyzer.Analysis.Vb;

/// <summary>
/// Pass 7b (VB only): CBO, LCOM (Henderson-Sellers, as C#) and cyclomatic complexity of VB components, plus the
/// <c>HIGH_CYCLOMATIC_COMPLEXITY</c> issues with the C# thresholds (009-vb-legacy-completion, data-model §Métricas).
/// Partial types aggregate every block of the component. Lines of code are not touched (FR-023).
/// </summary>
public static class VbMetricsCalculator
{
    /// <summary>Computes the metrics of every VB component of <paramref name="index"/>.</summary>
    public static void Calculate(VbTypeIndex index, List<Component> components)
    {
        var byId = components.GroupBy(c => c.Id, StringComparer.Ordinal).ToDictionary(g => g.Key, g => g.First(), StringComparer.Ordinal);
        foreach (var group in index.Types.GroupBy(t => t.Id, StringComparer.Ordinal))
        {
            if (!byId.TryGetValue(group.Key, out var component))
                continue;
            try
            {
                Calculate(index, group.ToList(), component);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[WARN] VbMetricsCalculator: error analyzing type '{group.Key}': {ex.Message}");
            }
        }
    }

    private static void Calculate(VbTypeIndex index, List<VbTypeEntry> entries, Component component)
    {
        var referenced = new HashSet<string>(StringComparer.Ordinal);
        var fields = new List<string>();
        var instanceMethods = new List<MethodBlockSyntax>();
        var complexity = new List<int>();

        foreach (var entry in entries)
        {
            var own = index.OwnNodes(entry).ToList();
            foreach (var node in own)
            {
                foreach (var type in ReferencedTypes(node, entry.Model))
                {
                    if (type.TypeKind == TypeKind.Error)
                        continue;
                    var name = VbTypeIndex.FullyQualifiedName(type);
                    if (name != entry.Id && !name.StartsWith("System.", StringComparison.Ordinal)
                                         && !name.StartsWith("Microsoft.", StringComparison.Ordinal))
                        referenced.Add(name);
                }
            }

            fields.AddRange(entry.Block.Members.OfType<FieldDeclarationSyntax>()
                .SelectMany(f => f.Declarators).SelectMany(d => d.Names).Select(n => n.Identifier.ValueText));

            var isModule = entry.Block is ModuleBlockSyntax;
            foreach (var method in entry.Block.Members.OfType<MethodBlockSyntax>()
                         .Where(m => m.IsKind(SyntaxKind.SubBlock) || m.IsKind(SyntaxKind.FunctionBlock)))
            {
                if (!isModule && !method.SubOrFunctionStatement.Modifiers.Any(SyntaxKind.SharedKeyword))
                    instanceMethods.Add(method);

                var cc = CyclomaticComplexity(method);
                complexity.Add(cc);
                AddComplexityIssue(component, method, cc);
            }
        }

        component.Cbo = referenced.Count;
        component.Lcom = Lcom(fields.Distinct(StringComparer.OrdinalIgnoreCase).ToList(), instanceMethods);
        if (complexity.Count > 0)
        {
            component.ComplexityMax = complexity.Max();
            component.ComplexityAvg = complexity.Average();
        }
    }

    private static IEnumerable<INamedTypeSymbol> ReferencedTypes(SyntaxNode node, SemanticModel model)
    {
        switch (node)
        {
            case ObjectCreationExpressionSyntax creation:
                if (model.GetTypeInfo(creation).Type is INamedTypeSymbol created)
                    yield return created;
                break;
            case SimpleAsClauseSyntax asClause:
                if (model.GetTypeInfo(asClause.Type).Type is INamedTypeSymbol declared)
                    yield return declared;
                break;
            case InvocationExpressionSyntax invocation:
                if (model.GetSymbolInfo(invocation).Symbol is IMethodSymbol { ContainingType: { } containing })
                    yield return containing;
                break;
            case InheritsStatementSyntax inherits:
                foreach (var type in inherits.Types)
                {
                    if (model.GetTypeInfo(type).Type is INamedTypeSymbol baseType)
                        yield return baseType;
                }

                break;
            case ImplementsStatementSyntax implements:
                foreach (var type in implements.Types)
                {
                    if (model.GetTypeInfo(type).Type is INamedTypeSymbol contract)
                        yield return contract;
                }

                break;
        }
    }

    private static double Lcom(List<string> fields, List<MethodBlockSyntax> methods)
    {
        int m = methods.Count;
        int f = fields.Count;
        if (f == 0 || m <= 1)
            return 0.0;

        var accessed = methods
            .Select(method => method.DescendantNodes().OfType<IdentifierNameSyntax>()
                .Select(i => i.Identifier.ValueText)
                .Where(name => fields.Contains(name, StringComparer.OrdinalIgnoreCase))
                .ToHashSet(StringComparer.OrdinalIgnoreCase))
            .ToList();

        double sumMf = fields.Sum(field => accessed.Count(set => set.Contains(field)));
        double lcom = (m - sumMf / f) / (m - 1);
        return Math.Max(0.0, Math.Min(1.0, lcom));
    }

    /// <summary>1 + decision points of a <c>Sub</c>/<c>Function</c> block (data-model §Métricas).</summary>
    public static int CyclomaticComplexity(MethodBlockSyntax method)
    {
        var cc = 1;
        foreach (var node in method.DescendantNodes())
        {
            switch (node)
            {
                case MultiLineIfBlockSyntax:
                case ElseIfBlockSyntax:
                case SingleLineIfStatementSyntax:
                case WhileBlockSyntax:
                case DoLoopBlockSyntax:
                case ForBlockSyntax:
                case ForEachBlockSyntax:
                case CatchBlockSyntax:
                case TernaryConditionalExpressionSyntax:
                    cc++;
                    break;
                case CaseClauseSyntax clause when clause is not ElseCaseClauseSyntax:
                    cc++;
                    break;
                case BinaryExpressionSyntax binary
                    when binary.IsKind(SyntaxKind.AndAlsoExpression) || binary.IsKind(SyntaxKind.OrElseExpression):
                    cc++;
                    break;
            }
        }

        return cc;
    }

    private static void AddComplexityIssue(Component component, MethodBlockSyntax method, int cc)
    {
        var threshold = cc > 15 ? 15 : cc > 10 ? 10 : 0;
        if (threshold == 0)
            return;
        var name = method.SubOrFunctionStatement.Identifier.ValueText;
        component.CodeIssues.Add(new CodeIssue
        {
            Rule = "HIGH_CYCLOMATIC_COMPLEXITY",
            Type = "CODE_STYLE",
            Severity = threshold == 15 ? "ERROR" : "WARNING",
            Message = $"Method '{name}' cyclomatic complexity {cc} exceeds {threshold}",
            Line = method.GetLocation().GetLineSpan().StartLinePosition.Line + 1,
        });
    }
}
