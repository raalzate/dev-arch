using FluentAssertions;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using DotNetAnalyzer.Analysis;
using Xunit;

namespace DotNetAnalyzer.Tests.Analysis;

/// <summary>
/// BUG-009 (014-standalone-repo): a project whose framework or package types do not resolve (e.g. the .NET 8
/// targeting pack of ASP.NET Core is not installed) is reported as a reduced-resolution analysis, never silently.
/// </summary>
public class ResolutionWarningsTests
{
    private static CSharpCompilation Compile(string assembly, string source) =>
        CSharpCompilation.Create(assembly, new[] { CSharpSyntaxTree.ParseText(source) },
            new[] { MetadataReference.CreateFromFile(typeof(object).Assembly.Location) },
            new CSharpCompilationOptions(OutputKind.DynamicallyLinkedLibrary));

    [Fact]
    public void UnresolvedBaseTypesProduceOneWarningPerProject()
    {
        var api = Compile("Shop.Api", "using Microsoft.AspNetCore.Mvc; public class OrdersController : ControllerBase {} public class Cart : MissingBase {}");
        var core = Compile("Shop.Core", "public class Order {}");

        var warnings = ResolutionWarnings.For(new Compilation[] { core, api });

        warnings.Should().ContainSingle();
        warnings[0].Should().StartWith("C# project 'Shop.Api'");
        warnings[0].Should().Contain("2 unresolved type references");
        warnings[0].Should().Contain("targeting pack");
    }

    [Fact]
    public void FullyResolvedProjectsProduceNoWarning()
    {
        ResolutionWarnings.For(new Compilation[] { Compile("Shop.Core", "public class Order { public string Id { get; set; } = \"\"; }") })
            .Should().BeEmpty();
    }
}
