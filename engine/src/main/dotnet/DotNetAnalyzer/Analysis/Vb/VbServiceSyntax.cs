using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.VisualBasic.Syntax;

namespace DotNetAnalyzer.Analysis.Vb;

/// <summary>Syntactic helpers shared by the VB layer and endpoint passes (ASMX and WCF markers).</summary>
public static class VbServiceSyntax
{
    /// <summary>True when one of <paramref name="attributes"/> is named <paramref name="name"/> (with or without the <c>Attribute</c> suffix, any qualification).</summary>
    public static bool HasAttribute(SyntaxList<AttributeListSyntax> attributes, string name) =>
        FindAttribute(attributes, name) != null;

    /// <summary>The first attribute of <paramref name="attributes"/> named <paramref name="name"/>, or null.</summary>
    public static AttributeSyntax? FindAttribute(SyntaxList<AttributeListSyntax> attributes, string name) =>
        attributes.SelectMany(l => l.Attributes).FirstOrDefault(a => Matches(SimpleName(a.Name), name));

    /// <summary>Simple names of the types in the <c>Inherits</c> statements of <paramref name="block"/>.</summary>
    public static IEnumerable<string> InheritedNames(TypeBlockSyntax block) =>
        block.Inherits.SelectMany(i => i.Types).Select(SimpleName);

    /// <summary>Simple names of the types in the <c>Implements</c> statements of <paramref name="block"/>.</summary>
    public static IEnumerable<string> ImplementedNames(TypeBlockSyntax block) =>
        block.Implements.SelectMany(i => i.Types).Select(SimpleName);

    /// <summary>ASMX web service: <c>Inherits [..]WebService</c> or a <c>WebService</c> attribute.</summary>
    public static bool IsAsmxService(TypeBlockSyntax block) =>
        block is ClassBlockSyntax
        && (InheritedNames(block).Any(n => n == "WebService") || HasAttribute(block.BlockStatement.AttributeLists, "WebService"));

    /// <summary>WCF service contract: interface or class with a <c>ServiceContract</c> attribute.</summary>
    public static bool IsServiceContract(TypeBlockSyntax block) =>
        HasAttribute(block.BlockStatement.AttributeLists, "ServiceContract");

    /// <summary>Rightmost identifier of a (possibly qualified or generic) type name.</summary>
    public static string SimpleName(TypeSyntax type) => type switch
    {
        QualifiedNameSyntax qualified => qualified.Right.Identifier.ValueText,
        SimpleNameSyntax simple => simple.Identifier.ValueText,
        _ => type.ToString(),
    };

    private static bool Matches(string actual, string name) =>
        actual.Equals(name, StringComparison.OrdinalIgnoreCase)
        || actual.Equals(name + "Attribute", StringComparison.OrdinalIgnoreCase);
}
