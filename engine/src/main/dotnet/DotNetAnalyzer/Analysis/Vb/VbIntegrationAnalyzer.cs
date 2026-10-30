using DotNetAnalyzer.Model;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.VisualBasic;
using Microsoft.CodeAnalysis.VisualBasic.Syntax;

namespace DotNetAnalyzer.Analysis.Vb;

/// <summary>
/// Pass 12b (VB, 022-external-integrations): outbound integrations of each component — Service/Web References
/// used by namespace, <c>ClientBase(Of T)</c> / <c>SoapHttpClientProtocol</c> clients, REST clients with a literal
/// URL, a configuration key or a dynamic value, and the client endpoints of the configuration — emitted as
/// <c>Integration:&lt;wcf|soap|rest&gt;:&lt;target&gt;</c> annotations and <c>service:</c>/<c>http:</c> external
/// dependencies. Returns the user warnings of the pass.
/// </summary>
public static class VbIntegrationAnalyzer
{
    private static readonly string[] RestClientTypes = { "RestClient", "HttpClient" };

    public static bool Enabled(IntegrationsOptions options, string language) => options.Outbound switch
    {
        PassMode.On => true,
        PassMode.Off => false,
        _ => language == LanguageNames.VisualBasic,
    };

    public static string StateDiagnostic(IntegrationsOptions options, string language) =>
        $"Outbound integrations: {(Enabled(options, language) ? "on" : "off")} for "
        + $"{(language == LanguageNames.VisualBasic ? "Visual Basic" : "C#")} ({(options.Outbound == PassMode.Auto ? "auto" : "config")})";

    public static IReadOnlyList<string> Analyze(
        VbTypeIndex index, List<Component> components, VbProjectFile? project, IReadOnlyList<AppConfigParser.ClientEndpoint> endpoints,
        IReadOnlyDictionary<string, string>? globalReferences = null)
    {
        var byId = components.GroupBy(c => c.Id, StringComparer.Ordinal).ToDictionary(g => g.Key, g => g.First(), StringComparer.Ordinal);
        // The project's own references first, then those of every analyzed project (a client generated in one
        // project is consumed from another through a project reference).
        var references = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var (name, kind) in project?.ServiceReferences ?? new Dictionary<string, string>())
            references[name] = kind;
        foreach (var (name, kind) in globalReferences ?? new Dictionary<string, string>())
            references.TryAdd(name, kind);
        var warnings = new SortedSet<string>(StringComparer.Ordinal);

        foreach (var group in index.Types.GroupBy(t => t.Id, StringComparer.Ordinal))
        {
            if (!byId.TryGetValue(group.Key, out var component))
                continue;
            try
            {
                AnalyzeType(index, group.ToList(), component, references, endpoints, warnings);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[WARN] VbIntegrationAnalyzer: error analyzing type '{group.Key}': {ex.Message}");
            }
        }

        return warnings.ToList();
    }

    private static void AnalyzeType(
        VbTypeIndex index, List<VbTypeEntry> entries, Component component, IReadOnlyDictionary<string, string> references,
        IReadOnlyList<AppConfigParser.ClientEndpoint> endpoints, SortedSet<string> warnings)
    {
        var file = Path.GetFileName(entries[0].Block.SyntaxTree.FilePath ?? "") is { Length: > 0 } f ? f : "unknown";
        var usedReferences = new SortedSet<string>(StringComparer.Ordinal);

        foreach (var entry in entries)
        {
            // A file-level Imports of the reference namespace (Imports Ofac / Imports Root.Ofac) is evidence for
            // the types of that file: the generated client is then used unqualified.
            if (entry.Block.SyntaxTree.GetRoot() is CompilationUnitSyntax unit)
            {
                foreach (var import in unit.Imports.SelectMany(i => i.ImportsClauses).OfType<SimpleImportsClauseSyntax>())
                {
                    var last = import.Name.ToString().Split('.').Last().Trim();
                    if (references.ContainsKey(last))
                        usedReferences.Add(last);
                }
            }

            // Service / Web References used through their namespace: Ofac.OfacClient, Holiday.HolidayService.
            foreach (var qualified in entry.Block.DescendantNodes().OfType<QualifiedNameSyntax>())
            {
                var first = FirstIdentifier(qualified);
                if (first != null && references.ContainsKey(first))
                    usedReferences.Add(first);
            }

            foreach (var access in entry.Block.DescendantNodes().OfType<MemberAccessExpressionSyntax>())
            {
                if (access.Expression is IdentifierNameSyntax identifier && references.ContainsKey(identifier.Identifier.ValueText))
                    usedReferences.Add(identifier.Identifier.ValueText);
            }

            // Hand-written clients.
            foreach (var inherits in entry.Block.Inherits.SelectMany(i => i.Types))
            {
                var name = inherits is QualifiedNameSyntax q ? q.Right : inherits as SimpleNameSyntax;
                switch (name)
                {
                    case GenericNameSyntax { Identifier.ValueText: "ClientBase" } generic:
                        var contract = generic.TypeArgumentList.Arguments.FirstOrDefault()?.ToString() ?? "unknown";
                        contract = contract.Split('.').Last();
                        Add(component, "wcf", contract, "service:" + contract);
                        break;
                    case SimpleNameSyntax { Identifier.ValueText: "SoapHttpClientProtocol" }:
                        var className = entry.Block.BlockStatement.Identifier.ValueText;
                        Add(component, "soap", className, "service:" + className);
                        break;
                }
            }

            // REST clients.
            foreach (var node in index.OwnNodes(entry))
            {
                switch (node)
                {
                    case ObjectCreationExpressionSyntax creation
                        when RestClientTypes.Any(t => creation.Type.ToString().EndsWith(t, StringComparison.Ordinal))
                             && creation.ArgumentList?.Arguments.FirstOrDefault() is SimpleArgumentSyntax { IsNamed: false } first:
                        Rest(component, first.Expression, file, Line(creation), warnings);
                        break;
                    case InvocationExpressionSyntax { Expression: MemberAccessExpressionSyntax { Name.Identifier.ValueText: "Create" } access } invocation
                        when access.Expression.ToString().EndsWith("WebRequest", StringComparison.Ordinal)
                             && invocation.ArgumentList?.Arguments.FirstOrDefault() is SimpleArgumentSyntax { IsNamed: false } arg:
                        Rest(component, arg.Expression, file, Line(invocation), warnings);
                        break;
                    case AssignmentStatementSyntax { Left: MemberAccessExpressionSyntax { Name.Identifier.ValueText: "BaseAddress" } } assignment
                        when assignment.IsKind(SyntaxKind.SimpleAssignmentStatement):
                        var value = assignment.Right is ObjectCreationExpressionSyntax uri
                                    && uri.ArgumentList?.Arguments.FirstOrDefault() is SimpleArgumentSyntax { IsNamed: false } uriArg
                            ? uriArg.Expression : assignment.Right;
                        Rest(component, value, file, Line(assignment), warnings);
                        break;
                }
            }
        }

        foreach (var reference in usedReferences)
        {
            var kind = references[reference];
            Add(component, kind, reference, "service:" + reference);
            if (kind == "wcf")
            {
                foreach (var endpoint in endpoints.Where(e => e.Contract.StartsWith(reference + ".", StringComparison.Ordinal) && e.Host != null))
                    Add(component, "wcf", $"{endpoint.Contract}@{endpoint.Host}", null);
            }
        }
    }

    private static void Rest(Component component, ExpressionSyntax value, string file, int line, SortedSet<string> warnings)
    {
        // An identifier naming a field or property of the enclosing type resolves to its initializer / return value.
        if (value is IdentifierNameSyntax identifier && Resolve(identifier) is { } resolved)
            value = resolved;
        var folded = VbStringFolder.Fold(value);
        if (!folded.Contains(VbStringFolder.Hole))
        {
            var host = Hosts.Of(folded);
            if (host != null)
            {
                Add(component, "rest", host, "http:" + host);
                return;
            }
        }

        var key = ConfigurationKey(value);
        if (key != null)
        {
            Add(component, "rest", key, "http:" + key);
            return;
        }

        Add(component, "rest", "dynamic", null);
        warnings.Add($"Outbound URL is not a literal or a configuration key in {component.Id} ({file}:{line})");
    }

    /// <summary>Initializer of a field, or returned expression of a property, named like <paramref name="identifier"/> in its type.</summary>
    private static ExpressionSyntax? Resolve(IdentifierNameSyntax identifier)
    {
        var type = identifier.Ancestors().OfType<TypeBlockSyntax>().FirstOrDefault();
        if (type == null)
            return null;
        var name = identifier.Identifier.ValueText;
        foreach (var declarator in type.DescendantNodes().OfType<VariableDeclaratorSyntax>())
        {
            if (declarator.Names.Any(n => n.Identifier.ValueText.Equals(name, StringComparison.OrdinalIgnoreCase)))
            {
                if (declarator.Initializer?.Value is { } initializer)
                    return initializer;
                if (declarator.AsClause is AsNewClauseSyntax { NewExpression: ObjectCreationExpressionSyntax creation }
                    && creation.ArgumentList?.Arguments.FirstOrDefault() is SimpleArgumentSyntax { IsNamed: false } arg)
                    return arg.Expression;
            }
        }

        foreach (var property in type.Members.OfType<PropertyBlockSyntax>())
        {
            if (property.PropertyStatement.Identifier.ValueText.Equals(name, StringComparison.OrdinalIgnoreCase))
                return property.DescendantNodes().OfType<ReturnStatementSyntax>().FirstOrDefault()?.Expression;
        }

        foreach (var property in type.Members.OfType<PropertyStatementSyntax>())
        {
            if (property.Identifier.ValueText.Equals(name, StringComparison.OrdinalIgnoreCase) && property.Initializer?.Value is { } initializer)
                return initializer;
        }

        return null;
    }

    /// <summary>ConfigurationManager.AppSettings("K"), My.Settings.K, Settings.Default.K → K.</summary>
    private static string? ConfigurationKey(ExpressionSyntax value)
    {
        switch (value)
        {
            case InvocationExpressionSyntax { Expression: MemberAccessExpressionSyntax { Name.Identifier.ValueText: "AppSettings" } } invocation
                when invocation.ArgumentList?.Arguments.FirstOrDefault() is SimpleArgumentSyntax { IsNamed: false } arg:
                var folded = VbStringFolder.Fold(arg.Expression);
                return folded.Contains(VbStringFolder.Hole) || folded.Length == 0 ? null : folded;
            case MemberAccessExpressionSyntax { Expression: MemberAccessExpressionSyntax inner } access
                when inner.Name.Identifier.ValueText is "Settings" or "Default":
                return access.Name.Identifier.ValueText;
            case ParenthesizedExpressionSyntax parenthesized:
                return ConfigurationKey(parenthesized.Expression);
            default:
                return null;
        }
    }

    private static string? FirstIdentifier(QualifiedNameSyntax qualified)
    {
        NameSyntax current = qualified;
        while (current is QualifiedNameSyntax q)
            current = q.Left;
        return (current as IdentifierNameSyntax)?.Identifier.ValueText;
    }

    private static void Add(Component component, string kind, string target, string? dependency)
    {
        var annotation = $"Integration:{kind}:{target}";
        if (!component.Annotations.Contains(annotation, StringComparer.Ordinal))
            component.Annotations.Add(annotation);
        if (dependency != null && !component.ExternalDependencies.Contains(dependency, StringComparer.Ordinal))
            component.ExternalDependencies.Add(dependency);
    }

    private static int Line(SyntaxNode node) => node.GetLocation().GetLineSpan().StartLinePosition.Line + 1;
}
