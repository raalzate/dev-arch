using DotNetAnalyzer.Analysis.Vb;
using FluentAssertions;
using Xunit;

namespace DotNetAnalyzer.Tests.Analysis.Vb;

[Trait("Category", "VbLegacy")]
public sealed class VbProjectContextTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "vb009-ctx-" + Guid.NewGuid().ToString("N"));

    public VbProjectContextTests()
    {
        Directory.CreateDirectory(Path.Combine(_root, "Forms"));
        Directory.CreateDirectory(Path.Combine(_root, "Data", "Sets"));
        Directory.CreateDirectory(Path.Combine(_root, "obj", "Debug"));
        File.WriteAllText(Path.Combine(_root, "App.vbproj"), "<Project />");
        File.WriteAllText(Path.Combine(_root, "Web.config"), "<configuration />");
        File.WriteAllText(Path.Combine(_root, "app.config"), "<configuration />");
        File.WriteAllText(Path.Combine(_root, "Web.Debug.config"), "<configuration />");
        File.WriteAllText(Path.Combine(_root, "Data", "Sets", "Sales.xsd"), "<xs:schema />");
        File.WriteAllText(Path.Combine(_root, "obj", "Debug", "Copy.xsd"), "<xs:schema />");
    }

    public void Dispose() => Directory.Delete(_root, recursive: true);

    [Fact]
    public void ResolveProjectDirectory_WalksUpToTheVbproj()
    {
        var compilation = VbTestCompilations.Create(
            (Path.Combine(_root, "Forms", "A.vb"), "Class A\nEnd Class"),
            (Path.Combine(_root, "Forms", "B.vb"), "Class B\nEnd Class"));

        VbProjectContext.ResolveProjectDirectory(compilation).Should().Be(_root);
    }

    [Fact]
    public void ResolveProjectDirectory_CommonAncestorOfSeveralFolders()
    {
        var compilation = VbTestCompilations.Create(
            (Path.Combine(_root, "Forms", "A.vb"), "Class A\nEnd Class"),
            (Path.Combine(_root, "Data", "B.vb"), "Class B\nEnd Class"));

        VbProjectContext.ResolveProjectDirectory(compilation).Should().Be(_root);
    }

    [Fact]
    public void ConfigFiles_AreAppAndWebConfigInOrdinalOrder()
    {
        VbProjectContext.ConfigFiles(_root).Select(Path.GetFileName).Should().Equal("Web.config", "app.config");
    }

    [Fact]
    public void TypedDataSetFiles_SkipBuildOutput()
    {
        VbProjectContext.TypedDataSetFiles(_root).Select(Path.GetFileName).Should().Equal("Sales.xsd");
    }

    [Fact]
    public void MissingDirectory_YieldsNothing()
    {
        VbProjectContext.ConfigFiles(Path.Combine(_root, "none")).Should().BeEmpty();
        VbProjectContext.TypedDataSetFiles(Path.Combine(_root, "none")).Should().BeEmpty();
    }
}
