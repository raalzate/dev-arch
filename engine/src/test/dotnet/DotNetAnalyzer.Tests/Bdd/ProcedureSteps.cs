using System.Text;
using FluentAssertions;
using Reqnroll;

namespace DotNetAnalyzer.Tests.Bdd;

/// <summary>Steps of 020-stored-procedures (C# scratch projects, procedure catalogs, configured analyses, logs).</summary>
[Binding]
public sealed class ProcedureSteps
{
    private readonly VbAnalysisContext _context;

    public ProcedureSteps(VbAnalysisContext context)
    {
        _context = context;
    }

    [AfterScenario]
    public void DeleteConfigs()
    {
        foreach (var dir in _context.ConfigDirs.Where(Directory.Exists))
            Directory.Delete(dir, recursive: true);
    }

    [Given(@"^a C# legacy project with the file ""([^""]+)"":$")]
    public void GivenACSharpProjectWithTheFile(string fileName, string content)
    {
        // No project file on purpose: the analyzer falls back to the ad-hoc C# compilation of the directory.
        var dir = Path.Combine(Path.GetTempPath(), "cs020-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(dir);
        _context.ScratchDir = dir;
        _context.Target = dir;
        File.WriteAllText(Path.Combine(dir, fileName), content.Replace("\r\n", "\n"), new UTF8Encoding(false));
    }

    [Given(@"^the procedure catalog directory ""([^""]+)"" with the script ""([^""]+)"":$")]
    public void GivenCatalogScript(string directory, string fileName, string content)
    {
        var dir = Path.Combine(Root(), directory);
        Directory.CreateDirectory(dir);
        File.WriteAllText(Path.Combine(dir, fileName), content.Replace("\r\n", "\n"), new UTF8Encoding(false));
    }

    [Given(@"^the procedure catalog file ""([^""]+)"":$")]
    public void GivenCatalogFile(string relative, string content)
    {
        var file = Path.Combine(Root(), relative);
        Directory.CreateDirectory(Path.GetDirectoryName(file)!);
        File.WriteAllText(file, content.Replace("\r\n", "\n"), new UTF8Encoding(false));
    }

    [When(@"^the project is analyzed with the configuration:$")]
    public Task WhenAnalyzedWithConfig(string json) => _context.AnalyzeWithProcessAsync(json);

    [When(@"^the project is analyzed twice with the configuration:$")]
    public Task WhenAnalyzedTwiceWithConfig(string json) => _context.AnalyzeTwiceWithProcessAsync(json);

    [When(@"^the analyzer is run with the configuration:$")]
    public Task WhenAnalyzerRun(string json) => _context.AnalyzeWithProcessAsync(json);

    [Then(@"^the analyzer exits with code (\d+)$")]
    public void ThenExitCode(int code) => _context.ProcessExitCode.Should().Be(code, "stderr:\n" + _context.Log);

    [Then(@"^the analyzer error output contains ""([^""]+)""$")]
    public void ThenErrorOutputContains(string text) => _context.Log.Should().Contain(text);

    [Then(@"^the analysis log states that stored procedure detection is ""([^""]+)"" for ""([^""]+)"" because of ""([^""]+)""$")]
    public void ThenDetectionState(string state, string language, string reason) =>
        _context.Log.Should().Contain($"Stored procedure detection: {state} for {language} ({reason})",
            "the diagnostics were:\n" + _context.Log);

    [Then(@"^the product document ""([^""]+)"" mentions each of:$")]
    public void ThenDocumentMentions(string document, Table table)
    {
        var path = Path.Combine(VbAnalysisContext.EngineRoot, "..", document);
        File.Exists(path).Should().BeTrue($"{document} must exist");
        var content = File.ReadAllText(path);
        var missing = table.Rows.Select(r => r["text"]).Where(t => !content.Contains(t, StringComparison.Ordinal)).ToList();
        missing.Should().BeEmpty($"texts missing in {document}");
    }

    private string Root() =>
        _context.ScratchDir ?? _context.FixtureRoot ?? throw new InvalidOperationException("No project to attach the catalog to");
}
