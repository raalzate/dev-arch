using FluentAssertions;
using Reqnroll;

namespace DotNetAnalyzer.Tests.Bdd;

/// <summary>Steps of 025-reference-assemblies (.NET Framework reference assemblies for the Adhoc fallback).</summary>
[Binding]
public sealed class ReferenceAssemblySteps
{
    private const string Package = "microsoft.netframework.referenceassemblies.net48/1.0.3/build/.NETFramework/v4.8";

    private readonly VbAnalysisContext _context;
    private string? _refs;

    public ReferenceAssemblySteps(VbAnalysisContext context)
    {
        _context = context;
    }

    [Given(@"^the \.NET Framework 4\.8 reference assemblies of the test host$")]
    public void GivenHostReferenceAssemblies()
    {
        var root = Environment.GetEnvironmentVariable("NUGET_PACKAGES");
        if (string.IsNullOrEmpty(root))
            root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".nuget", "packages");
        _refs = Path.GetFullPath(Path.Combine(root, Package.Replace('/', Path.DirectorySeparatorChar)));
        Directory.Exists(_refs).Should().BeTrue($"the test project restores the net48 reference assemblies ({_refs})");
    }

    [When(@"^the project is analyzed with the configuration using the reference assemblies:$")]
    public Task WhenAnalyzedWithRefs(string json) => _context.AnalyzeWithProcessAsync(Substitute(json));

    [When(@"^the project is analyzed twice with the configuration using the reference assemblies:$")]
    public Task WhenAnalyzedTwiceWithRefs(string json) => _context.AnalyzeTwiceWithProcessAsync(Substitute(json));

    [Then(@"^the analysis log contains ""([^""]+)""$")]
    public void ThenLogContains(string text) =>
        _context.Log.Should().Contain(text, "the diagnostics were:\n" + _context.Log);

    private string Substitute(string json)
    {
        _refs.Should().NotBeNull("the reference assemblies step must run first");
        return json.Replace("<REFS>", _refs!.Replace("\\", "\\\\"));
    }
}
