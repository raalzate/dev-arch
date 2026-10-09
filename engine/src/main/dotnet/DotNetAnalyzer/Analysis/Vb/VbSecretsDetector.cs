using DotNetAnalyzer.Model;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.VisualBasic.Syntax;

namespace DotNetAnalyzer.Analysis.Vb;

/// <summary>
/// Pass 10b (VB only): configuration references of VB components (<c>ConfigurationManager</c>,
/// <c>ConfigurationSettings</c>, <c>My.Settings</c>) and plaintext credentials of <c>app.config</c>/<c>web.config</c>
/// (009-vb-legacy-completion, FR-030..FR-035). Messages name the reference and the file, never the value.
/// </summary>
public static class VbSecretsDetector
{
    private static readonly string[] ConfigurationTypes = { "ConfigurationManager", "ConfigurationSettings" };

    /// <summary>Adds secrets references, sensitivity and <c>PLAINTEXT_SECRET_IN_CONFIG</c> issues.</summary>
    public static void Detect(VbTypeIndex index, List<Component> components, AppConfiguration configuration)
    {
        var byId = components.GroupBy(c => c.Id, StringComparer.Ordinal).ToDictionary(g => g.Key, g => g.First(), StringComparer.Ordinal);
        foreach (var entry in index.Types)
        {
            if (!byId.TryGetValue(entry.Id, out var component))
                continue;
            try
            {
                Detect(index, entry, component, configuration);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[WARN] VbSecretsDetector: error analyzing type '{entry.Id}': {ex.Message}");
            }
        }
    }

    private static void Detect(VbTypeIndex index, VbTypeEntry entry, Component component, AppConfiguration configuration)
    {
        var file = Path.GetFileName(entry.Block.SyntaxTree.FilePath);
        foreach (var node in index.OwnNodes(entry))
        {
            if (node is IdentifierNameSyntax identifier)
            {
                var type = ConfigurationTypes.FirstOrDefault(t => t.Equals(identifier.Identifier.ValueText, StringComparison.OrdinalIgnoreCase));
                if (type != null && !component.SecretsReferences.Contains(type))
                    component.SecretsReferences.Add(type);
                continue;
            }

            var reference = Reference(node);
            if (reference == null)
                continue;
            if (!component.SecretsReferences.Contains(reference.Value.Name))
                component.SecretsReferences.Add(reference.Value.Name);

            var source = PlaintextSource(reference.Value, configuration);
            if (source == null)
                continue;
            component.SensitiveData = true;
            var line = node.GetLocation().GetLineSpan().StartLinePosition.Line + 1;
            var location = $"{file}:{line}";
            if (component.CodeIssues.Any(i => i.Rule == "PLAINTEXT_SECRET_IN_CONFIG" && i.Location == location
                                              && i.Message.Contains($"'{reference.Value.Name}'", StringComparison.Ordinal)))
                continue;
            component.CodeIssues.Add(new CodeIssue
            {
                Rule = "PLAINTEXT_SECRET_IN_CONFIG",
                Type = "SECURITY",
                Severity = "CRITICAL",
                Message = $"Configuration entry '{reference.Value.Name}' is stored as a plaintext credential in {source}. "
                          + "Move it to a protected configuration section or a secret store.",
                Line = line,
                Location = location,
            });
        }
    }

    private readonly record struct ConfigReference(string Name, string Key, bool IsConnectionString);

    private static ConfigReference? Reference(SyntaxNode node)
    {
        switch (node)
        {
            case InvocationExpressionSyntax invocation:
                return InvocationReference(invocation);
            case MemberAccessExpressionSyntax { Expression: MemberAccessExpressionSyntax settings } access
                when settings.Name.Identifier.ValueText.Equals("Settings", StringComparison.OrdinalIgnoreCase)
                     && settings.Expression is IdentifierNameSyntax my
                     && my.Identifier.ValueText.Equals("My", StringComparison.OrdinalIgnoreCase):
                var key = access.Name.Identifier.ValueText;
                return new ConfigReference($"config:{key}", key, IsConnectionString: false);
            default:
                return null;
        }
    }

    private static ConfigReference? InvocationReference(InvocationExpressionSyntax invocation)
    {
        var arguments = invocation.ArgumentList?.Arguments;
        if (arguments is not { Count: 1 } || arguments.Value[0] is not SimpleArgumentSyntax { NameColonEquals: null } argument
            || argument.Expression is not LiteralExpressionSyntax literal || literal.Token.Value is not string key)
            return null;

        if (invocation.Expression is not MemberAccessExpressionSyntax access)
            return null;
        var member = access.Name.Identifier.ValueText;
        if (member.Equals("Item", StringComparison.OrdinalIgnoreCase) || member.Equals("Get", StringComparison.OrdinalIgnoreCase))
        {
            if (access.Expression is not MemberAccessExpressionSyntax inner)
                return null;
            var isGet = member.Equals("Get", StringComparison.OrdinalIgnoreCase);
            access = inner;
            member = access.Name.Identifier.ValueText;
            if (isGet && !member.Equals("AppSettings", StringComparison.OrdinalIgnoreCase))
                return null;
        }

        var owner = RightmostName(access.Expression);
        if (owner == null)
            return null;
        if (member.Equals("ConnectionStrings", StringComparison.OrdinalIgnoreCase)
            && owner.Equals("ConfigurationManager", StringComparison.OrdinalIgnoreCase))
            return new ConfigReference($"config:ConnectionStrings:{key}", key, IsConnectionString: true);
        if (member.Equals("AppSettings", StringComparison.OrdinalIgnoreCase)
            && ConfigurationTypes.Any(t => t.Equals(owner, StringComparison.OrdinalIgnoreCase)))
            return new ConfigReference($"config:{key}", key, IsConnectionString: false);
        return null;
    }

    private static string? RightmostName(ExpressionSyntax? expression) => expression switch
    {
        IdentifierNameSyntax identifier => identifier.Identifier.ValueText,
        MemberAccessExpressionSyntax access => access.Name.Identifier.ValueText,
        QualifiedNameSyntax qualified => qualified.Right.Identifier.ValueText,
        _ => null,
    };

    private static string? PlaintextSource(ConfigReference reference, AppConfiguration configuration)
    {
        if (reference.IsConnectionString)
        {
            return configuration.ConnectionStrings.TryGetValue(reference.Key, out var value)
                   && AppConfigParser.HasPlaintextPassword(value)
                ? configuration.ConnectionStringFiles.GetValueOrDefault(reference.Key)
                : null;
        }

        return configuration.Settings.TryGetValue(reference.Key, out var setting)
               && AppConfigParser.IsPlaintextSetting(reference.Key, setting)
            ? configuration.SettingFiles.GetValueOrDefault(reference.Key)
            : null;
    }
}
