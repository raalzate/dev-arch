using DotNetAnalyzer.Model;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.VisualBasic;
using Microsoft.CodeAnalysis.VisualBasic.Syntax;

namespace DotNetAnalyzer.Analysis.Vb;

/// <summary>
/// Pass 4b (VB only): ASMX web methods and WCF operations as API endpoints (009-vb-legacy-completion,
/// FR-050..FR-053, data-model §Endpoints VB). Syntactic, so it works without resolving
/// <c>System.Web.Services</c> / <c>System.ServiceModel</c>; symbols link contracts to implementations when available.
/// </summary>
public static class VbEndpointExtractor
{
    private static readonly SyntaxKind[] HiddenModifiers =
    {
        SyntaxKind.PrivateKeyword, SyntaxKind.ProtectedKeyword, SyntaxKind.FriendKeyword,
    };

    /// <summary>Endpoints of the VB components of <paramref name="index"/>.</summary>
    public static List<ApiEndpoint> Extract(VbTypeIndex index, List<Component> components)
    {
        var ids = components.Select(c => c.Id).ToHashSet(StringComparer.Ordinal);
        var endpoints = new List<ApiEndpoint>();
        foreach (var entry in index.Types.Where(t => ids.Contains(t.Id)))
        {
            try
            {
                if (VbServiceSyntax.IsAsmxService(entry.Block))
                    endpoints.AddRange(Asmx(entry));
                if (VbServiceSyntax.IsServiceContract(entry.Block))
                    endpoints.AddRange(Wcf(entry, index, ids));
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[WARN] VbEndpointExtractor: error analyzing type '{entry.Id}': {ex.Message}");
            }
        }

        return endpoints
            .GroupBy(e => (e.Id, e.ComponentId))
            .Select(g => g.First())
            .ToList();
    }

    private static IEnumerable<ApiEndpoint> Asmx(VbTypeEntry entry)
    {
        var className = entry.Block.BlockStatement.Identifier.ValueText;
        foreach (var method in entry.Block.Members.OfType<MethodBlockSyntax>())
        {
            var statement = method.SubOrFunctionStatement;
            if (!VbServiceSyntax.HasAttribute(statement.AttributeLists, "WebMethod")
                || statement.Modifiers.Any(m => HiddenModifiers.Any(k => m.IsKind(k))))
                continue;
            yield return Endpoint("POST", $"/{className}.asmx/{statement.Identifier.ValueText}", statement, null, entry.Id);
        }
    }

    private static IEnumerable<ApiEndpoint> Wcf(VbTypeEntry contract, VbTypeIndex index, HashSet<string> ids)
    {
        IEnumerable<MethodStatementSyntax> operations = contract.Block is InterfaceBlockSyntax
            ? contract.Block.Members.OfType<MethodStatementSyntax>()
            : contract.Block.Members.OfType<MethodBlockSyntax>().Select(m => m.SubOrFunctionStatement);
        operations = operations.Where(o => VbServiceSyntax.HasAttribute(o.AttributeLists, "OperationContract")).ToList();

        var owners = new List<VbTypeEntry>();
        if (contract.Block is InterfaceBlockSyntax)
        {
            var contractName = contract.Block.BlockStatement.Identifier.ValueText;
            owners.AddRange(index.Types.Where(t => t.Block is ClassBlockSyntax && ids.Contains(t.Id) && Implements(t, contract, contractName)));
        }

        if (owners.Count == 0)
            owners.Add(contract);

        foreach (var owner in owners.GroupBy(o => o.Id, StringComparer.Ordinal).Select(g => g.First()))
        {
            var ownerName = owner.Block.BlockStatement.Identifier.ValueText;
            foreach (var operation in operations)
            {
                var (method, template) = WebBinding(operation);
                var path = template == null
                    ? $"/{ownerName}.svc/{operation.Identifier.ValueText}"
                    : $"/{ownerName}.svc/{StripQuery(template).TrimStart('/')}";
                yield return Endpoint(method, path, operation, template, owner.Id);
            }
        }
    }

    private static bool Implements(VbTypeEntry candidate, VbTypeEntry contract, string contractName)
    {
        if (candidate.Symbol != null && contract.Symbol != null
            && candidate.Symbol.AllInterfaces.Any(i => SymbolEqualityComparer.Default.Equals(i, contract.Symbol)))
            return true;
        return VbServiceSyntax.ImplementedNames(candidate.Block).Any(n => n.Equals(contractName, StringComparison.OrdinalIgnoreCase));
    }

    private static (string Method, string? Template) WebBinding(MethodStatementSyntax operation)
    {
        var webGet = VbServiceSyntax.FindAttribute(operation.AttributeLists, "WebGet");
        if (webGet != null)
            return ("GET", NamedString(webGet, "UriTemplate"));
        var webInvoke = VbServiceSyntax.FindAttribute(operation.AttributeLists, "WebInvoke");
        if (webInvoke != null)
            return ((NamedString(webInvoke, "Method") ?? "POST").ToUpperInvariant(), NamedString(webInvoke, "UriTemplate"));
        return ("POST", null);
    }

    private static string? NamedString(AttributeSyntax attribute, string name) =>
        attribute.ArgumentList?.Arguments.OfType<SimpleArgumentSyntax>()
            .Where(a => a.NameColonEquals?.Name.Identifier.ValueText.Equals(name, StringComparison.OrdinalIgnoreCase) == true)
            .Select(a => (a.Expression as LiteralExpressionSyntax)?.Token.Value as string)
            .FirstOrDefault(v => v != null);

    private static string StripQuery(string template)
    {
        var question = template.IndexOf('?');
        return question >= 0 ? template[..question] : template;
    }

    private static ApiEndpoint Endpoint(string method, string path, MethodStatementSyntax statement, string? template, string componentId)
    {
        var endpoint = new ApiEndpoint
        {
            Id = $"{method} {path}",
            Method = method,
            Path = path,
            ComponentId = componentId,
            ResponseSchema = statement.IsKind(SyntaxKind.FunctionStatement) ? statement.AsClause?.Type.ToString() ?? "Object" : null,
        };
        foreach (var parameter in statement.ParameterList?.Parameters ?? default)
        {
            var name = parameter.Identifier.Identifier.ValueText;
            endpoint.Parameters.Add(new Parameter
            {
                Name = name,
                In = Location(name, method, template),
                Type = parameter.AsClause?.Type.ToString() ?? "Object",
                Required = !parameter.Modifiers.Any(SyntaxKind.OptionalKeyword),
            });
        }

        return endpoint;
    }

    private static string Location(string name, string method, string? template)
    {
        var placeholder = "{" + name + "}";
        if (template != null)
        {
            var at = template.IndexOf(placeholder, StringComparison.OrdinalIgnoreCase);
            var question = template.IndexOf('?');
            if (at >= 0)
                return question >= 0 && at > question ? "query" : "path";
        }

        return method == "GET" ? "query" : "body";
    }
}
