using FluentAssertions;
using Reqnroll;

namespace DotNetAnalyzer.Tests.Bdd;

/// <summary>Steps of 022-external-integrations (external dependencies, outbound warnings, pass state).</summary>
[Binding]
public sealed class IntegrationSteps
{
    private readonly VbAnalysisContext _context;

    public IntegrationSteps(VbAnalysisContext context)
    {
        _context = context;
    }

    [Then(@"^the component ""([^""]+)"" has exactly the external dependencies ""([^""]*)""$")]
    public void ThenExternalDependencies(string id, string csv)
    {
        var expected = csv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
        _context.Component(id).ExternalDependencies.Should().Equal(expected);
    }

    [Then(@"^the analyzer reports exactly these outbound warnings:$")]
    public void ThenOutboundWarnings(string text) =>
        _context.UserWarnings.Where(w => w.StartsWith("Outbound ", StringComparison.Ordinal))
            .Should().Equal(text.Replace("\r\n", "\n").Split('\n', StringSplitOptions.RemoveEmptyEntries));

    [Then(@"^no user warning starts with ""([^""]+)""$")]
    public void ThenNoWarningStartsWith(string prefix) =>
        _context.UserWarnings.Should().NotContain(w => w.StartsWith(prefix, StringComparison.Ordinal));

    [Then(@"^the analysis log states that outbound integrations are ""([^""]+)"" for ""([^""]+)"" because of ""([^""]+)""$")]
    public void ThenOutboundState(string state, string language, string reason) =>
        _context.Log.Should().Contain($"Outbound integrations: {state} for {language} ({reason})",
            "the diagnostics were:\n" + _context.Log);
}
