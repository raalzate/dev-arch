using System.Text;
using FluentAssertions;
using Reqnroll;

namespace DotNetAnalyzer.Tests.Bdd;

/// <summary>Steps of 021-desktop-identity-layers (nested project directories, identities, annotations, debt log).</summary>
[Binding]
public sealed class DesktopSteps
{
    private readonly VbAnalysisContext _context;

    public DesktopSteps(VbAnalysisContext context)
    {
        _context = context;
    }

    [Given(@"^a VB legacy project directory with the file ""([^""]+)"":$")]
    public void GivenAProjectDirectoryWithTheFile(string relative, string content)
    {
        // A directory of nested projects without a solution: the analyzer resolves it as a directory.
        var dir = Path.Combine(Path.GetTempPath(), "vb021-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(dir);
        _context.ScratchDir = dir;
        _context.Target = dir;
        GivenTheProjectDirectoryFile(relative, content);
    }

    [Given(@"^the project directory file ""([^""]+)"":$")]
    public void GivenTheProjectDirectoryFile(string relative, string content)
    {
        var dir = _context.ScratchDir ?? throw new InvalidOperationException("No scratch project directory");
        var file = Path.Combine(dir, relative.Replace('/', Path.DirectorySeparatorChar));
        Directory.CreateDirectory(Path.GetDirectoryName(file)!);
        File.WriteAllText(file, content.Replace("\r\n", "\n"), new UTF8Encoding(false));
    }

    [Then(@"^the components are exactly ""([^""]*)""$")]
    public void ThenComponentsAreExactly(string csv)
    {
        var expected = csv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .OrderBy(x => x, StringComparer.Ordinal).ToList();
        _context.Graph!.Components.Select(c => c.Id).OrderBy(x => x, StringComparer.Ordinal).Should().Equal(expected);
    }

    [Then(@"^the component ""([^""]+)"" has the annotation ""([^""]+)""$")]
    public void ThenHasAnnotation(string id, string annotation) =>
        _context.Component(id).Annotations.Should().Contain(annotation,
            "annotations were: " + string.Join(", ", _context.Component(id).Annotations));

    [Then(@"^the component ""([^""]+)"" has no annotation starting with ""([^""]+)""$")]
    public void ThenNoAnnotationStartingWith(string id, string prefix) =>
        _context.Component(id).Annotations.Should().NotContain(a => a.StartsWith(prefix, StringComparison.Ordinal));

    [Then(@"^the analysis log does not contain ""([^""]+)""$")]
    public void ThenLogDoesNotContain(string text) =>
        _context.Log.Should().NotContain(text, "the diagnostics were:\n" + _context.Log);

    [Then(@"^the analysis log states that legacy debt rules are ""([^""]+)"" for ""([^""]+)"" because of ""([^""]+)""$")]
    public void ThenDebtState(string state, string language, string reason) =>
        _context.Log.Should().Contain($"Legacy debt rules: {state} for {language} ({reason})",
            "the diagnostics were:\n" + _context.Log);
}
