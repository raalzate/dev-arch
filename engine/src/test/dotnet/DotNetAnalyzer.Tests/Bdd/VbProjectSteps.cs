using System.Runtime.InteropServices;
using FluentAssertions;
using System.Text;
using DotNetAnalyzer.Tests.SchemaContract;
using Reqnroll;
using Reqnroll.UnitTestProvider;

namespace DotNetAnalyzer.Tests.Bdd;

/// <summary>Arrange/act steps of 009-vb-legacy-completion: VB projects, fixtures and the analysis.</summary>
[Binding]
public sealed class VbProjectSteps
{
    private const string MinimalVbProj = """
        <?xml version="1.0" encoding="utf-8"?>
        <Project DefaultTargets="Build" xmlns="http://schemas.microsoft.com/developer/msbuild/2003" ToolsVersion="4.0">
          <PropertyGroup>
            <OutputType>Library</OutputType>
            <RootNamespace></RootNamespace>
            <AssemblyName>Sample</AssemblyName>
            <MyType>Empty</MyType>
            <TargetFrameworkVersion>v4.8</TargetFrameworkVersion>
          </PropertyGroup>
        </Project>
        """;

    private readonly VbAnalysisContext _context;
    private readonly IUnitTestRuntimeProvider _runtime;

    public VbProjectSteps(VbAnalysisContext context, IUnitTestRuntimeProvider runtime)
    {
        _context = context;
        _runtime = runtime;
    }

    [AfterScenario]
    public void DeleteScratch()
    {
        if (_context.ScratchDir != null && Directory.Exists(_context.ScratchDir))
        {
            Directory.Delete(_context.ScratchDir, recursive: true);
        }
    }

    [Given(@"^a VB legacy project with the file ""([^""]+)"":$")]
    public void GivenAVbProjectWithTheFile(string fileName, string content)
    {
        var dir = Path.Combine(Path.GetTempPath(), "vb009-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(dir);
        File.WriteAllText(Path.Combine(dir, "Sample.vbproj"), MinimalVbProj);
        _context.ScratchDir = dir;
        _context.Target = Path.Combine(dir, "Sample.vbproj");
        GivenTheProjectFile(fileName, content);
    }

    [Given(@"^the project file ""([^""]+)"":$")]
    public void GivenTheProjectFile(string fileName, string content)
    {
        var dir = _context.ScratchDir ?? throw new InvalidOperationException("No scratch VB project");
        File.WriteAllText(Path.Combine(dir, fileName), content.Replace("\r\n", "\n"), new UTF8Encoding(false));
    }

    [Given(@"^a VB legacy project with a class ""([^""]+)"" containing the string literal ""(.*)""$")]
    public void GivenAClassWithLiteral(string id, string literal)
    {
        var (ns, name) = Split(id);
        GivenAVbProjectWithTheFile("Sample.vb", $"""
            Namespace {ns}
                Public Class {name}
                    Public Function Text() As String
                        Return "{literal.Replace("\"", "\"\"")}"
                    End Function
                End Class
            End Namespace
            """);
    }

    [Given(@"^a VB legacy project with an empty class ""([^""]+)""$")]
    public void GivenAnEmptyClass(string id)
    {
        var (ns, name) = Split(id);
        GivenAVbProjectWithTheFile("Sample.vb", $"""
            Namespace {ns}
                Public Class {name}
                End Class
            End Namespace
            """);
    }

    [Given(@"^a VB legacy project with a class ""([^""]+)"" whose method ""([^""]+)"" has (\d+) single-line If statements$")]
    public void GivenABranchyClass(string id, string method, int ifs)
    {
        var (ns, name) = Split(id);
        var body = new StringBuilder();
        for (var i = 0; i < ifs; i++)
        {
            body.Append("            If n = ").Append(i).Append(" Then n = n + 1\n");
        }

        GivenAVbProjectWithTheFile("Sample.vb",
            $"Namespace {ns}\n    Public Class {name}\n        Public Function {method}(ByVal n As Integer) As Integer\n"
            + body
            + "            Return n\n        End Function\n    End Class\nEnd Namespace\n");
    }

    [Given(@"^the synthetic VB project ""([^""]+)""$")]
    public void GivenTheSyntheticProject(string name)
    {
        var dir = Path.Combine(VbAnalysisContext.FixturesDir, "VbLegacy", name);
        _context.FixtureRoot = dir;
        _context.Target = Path.Combine(dir, name + ".vbproj");
        File.Exists(_context.Target).Should().BeTrue($"synthetic project {_context.Target} must exist");
    }

    [Given(@"^the VB fixture project ""([^""]+)""$")]
    public void GivenTheVbFixture(string relative)
    {
        _context.Target = Path.Combine(VbAnalysisContext.FixturesDir, "VbLegacy", relative);
        _context.FixtureRoot = Path.GetDirectoryName(_context.Target);
    }

    [Given(@"^the C# fixture project ""([^""]+)""$")]
    public void GivenTheCSharpFixture(string name)
    {
        _context.Target = GraphJson.FixtureTarget(name);
        _context.FixtureRoot = Path.Combine(VbAnalysisContext.FixturesDir, name);
    }

    [Given(@"^the C# demo project ""([^""]+)""$")]
    public void GivenTheCSharpDemo(string name)
    {
        _context.Target = Path.Combine(VbAnalysisContext.EngineRoot, "test-for-demo", name);
        _context.FixtureRoot = _context.Target;
        Directory.Exists(_context.Target).Should().BeTrue($"demo project {_context.Target} must exist");
    }

    [Given(@"^the analysis host cannot load \.NET Framework reference assemblies$")]
    public void GivenANonWindowsHost()
    {
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            _runtime.TestIgnore("Windows hosts may resolve .NET Framework reference assemblies (full fidelity)");
        }
    }

    [When(@"^the project is analyzed$")]
    public Task WhenTheProjectIsAnalyzed() => _context.AnalyzeAsync();

    [When(@"^the project is analyzed twice$")]
    public Task WhenTheProjectIsAnalyzedTwice() => _context.AnalyzeTwiceAsync();

    private static (string Namespace, string Name) Split(string id)
    {
        var dot = id.LastIndexOf('.');
        return (id[..dot], id[(dot + 1)..]);
    }
}
