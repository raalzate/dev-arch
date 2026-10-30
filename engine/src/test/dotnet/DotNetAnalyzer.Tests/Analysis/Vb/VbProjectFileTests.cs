using DotNetAnalyzer.Analysis.Vb;
using FluentAssertions;
using Xunit;

namespace DotNetAnalyzer.Tests.Analysis.Vb;

public class VbProjectFileTests : IDisposable
{
    private readonly string _dir = Path.Combine(Path.GetTempPath(), "vbproj021-" + Guid.NewGuid().ToString("N"));

    public VbProjectFileTests() => Directory.CreateDirectory(_dir);

    public void Dispose() => Directory.Delete(_dir, recursive: true);

    private string Write(string name, string xml)
    {
        var path = Path.Combine(_dir, name);
        File.WriteAllText(path, xml);
        return path;
    }

    [Fact]
    public void Reads_root_namespace_imports_option_strict_output_startup_references_and_reports()
    {
        var path = Write("A.vbproj", """
            <Project xmlns="http://schemas.microsoft.com/developer/msbuild/2003">
              <PropertyGroup><RootNamespace> Acme.Legacy </RootNamespace><OptionStrict>off</OptionStrict><OutputType>WinExe</OutputType><StartupObject>Acme.Legacy.Main</StartupObject></PropertyGroup>
              <ItemGroup><Import Include="System" /><Import Include="System.Data" /><Import Include="System" /></ItemGroup>
              <ItemGroup><ProjectReference Include="..\Common\Common.vbproj" /><EmbeddedResource Include="Reports\Listing.rdlc" /><Compile Include="A.vb" /></ItemGroup>
            </Project>
            """);
        var project = VbProjectFile.Load(path);
        project.RootNamespace.Should().Be("Acme.Legacy");
        project.GlobalImports.Should().Equal("System", "System.Data");
        project.OptionStrictOff.Should().BeTrue();
        project.IsExe.Should().BeTrue();
        project.StartupObject.Should().Be("Acme.Legacy.Main");
        project.ProjectReferences.Should().ContainSingle().Which.Should().EndWith(Path.Combine("Common", "Common.vbproj"));
        project.ReportDefinitions.Should().Contain("Listing");
        project.Diagnostics.Should().BeEmpty();
    }

    [Fact]
    public void Invalid_root_namespace_is_ignored_with_a_diagnostic()
    {
        var project = VbProjectFile.Load(Write("B.vbproj", "<Project><PropertyGroup><RootNamespace>Acme Legacy!</RootNamespace></PropertyGroup></Project>"));
        project.RootNamespace.Should().BeNull();
        project.Diagnostics.Should().ContainSingle().Which.Should().Contain("not a valid qualified identifier");
    }

    [Fact]
    public void Empty_or_absent_values_give_defaults_and_broken_xml_is_reported_not_thrown()
    {
        var project = VbProjectFile.Load(Write("C.vbproj", "<Project><PropertyGroup><RootNamespace></RootNamespace><OptionStrict>On</OptionStrict></PropertyGroup></Project>"));
        project.RootNamespace.Should().BeNull();
        project.OptionStrictOff.Should().BeFalse();
        project.IsExe.Should().BeFalse();
        project.GlobalImports.Should().BeEmpty();

        var broken = VbProjectFile.Load(Write("D.vbproj", "<Project><PropertyGroup>"));
        broken.Diagnostics.Should().ContainSingle().Which.Should().StartWith("could not read 'D.vbproj'");
    }

    [Fact]
    public void Context_finds_the_first_project_file_ordinally_and_nested_ones_without_build_outputs()
    {
        Write("Zeta.vbproj", "<Project />");
        Write("Alpha.vbproj", "<Project />");
        Directory.CreateDirectory(Path.Combine(_dir, "Sub", "obj"));
        File.WriteAllText(Path.Combine(_dir, "Sub", "Nested.vbproj"), "<Project />");
        File.WriteAllText(Path.Combine(_dir, "Sub", "obj", "Ignored.vbproj"), "<Project />");
        Path.GetFileName(VbProjectContext.FindProjectFile(_dir)!).Should().Be("Alpha.vbproj");
        VbProjectContext.NestedProjectFiles(_dir).Select(Path.GetFileName).Should().Equal("Alpha.vbproj", "Nested.vbproj", "Zeta.vbproj");
        VbProjectContext.FindProjectFile(Path.Combine(_dir, "missing")).Should().BeNull();
    }
}
