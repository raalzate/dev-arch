using System.Text.RegularExpressions;
using FluentAssertions;
using Reqnroll;

namespace DotNetAnalyzer.Tests.Bdd;

/// <summary>Steps of 024-extended-static-analysis (official rules, dead code, duplication, maintainability, SARIF, suppressions).</summary>
[Binding]
public sealed class ExtendedSteps
{
    private readonly VbAnalysisContext _context;

    public ExtendedSteps(VbAnalysisContext context)
    {
        _context = context;
    }

    private IEnumerable<DotNetAnalyzer.Model.Component> Components => _context.Graph!.Components;

    [Then(@"^the component ""([^""]+)"" has a code issue ""([^""]+)"" whose message starts with ""([^""]+)""$")]
    public void ThenIssueMessageStartsWith(string id, string rule, string prefix)
    {
        var issues = _context.Component(id).CodeIssues.Where(i => i.Rule == rule).ToList();
        issues.Should().NotBeEmpty($"{id} must have {rule}; issues: {Describe(id)}");
        issues.Should().Contain(i => i.Message.StartsWith(prefix, StringComparison.Ordinal),
            $"a {rule} message of {id} must start with '{prefix}'; messages: {string.Join(" | ", issues.Select(i => i.Message))}");
    }

    [Then(@"^the code issue ""([^""]+)"" of ""([^""]+)"" has type ""([^""]+)""$")]
    public void ThenIssueType(string rule, string id, string type)
    {
        var issues = _context.Component(id).CodeIssues.Where(i => i.Rule == rule).ToList();
        issues.Should().NotBeEmpty($"{id} must have {rule}; issues: {Describe(id)}");
        issues.Should().OnlyContain(i => i.Type == type);
    }

    [Then(@"^the component ""([^""]+)"" has a code issue ""([^""]+)"" with severity ""([^""]+)"" and message containing ""([^""]+)""$")]
    public void ThenIssueSeverityAndMessageContains(string id, string rule, string severity, string text)
    {
        var issues = _context.Component(id).CodeIssues.Where(i => i.Rule == rule).ToList();
        issues.Should().Contain(i => i.Severity == severity && i.Message.Contains(text, StringComparison.Ordinal),
            $"{id} must have {rule} ({severity}) mentioning '{text}'; issues: {Describe(id)}");
    }

    [Then(@"^the extended issues cover at least (\d+) distinct categories$")]
    public void ThenCategories(int n)
    {
        var categories = Components.SelectMany(c => c.CodeIssues)
            .Where(i => i.Rule.StartsWith("CA", StringComparison.Ordinal))
            .Select(i => Regex.Match(i.Message, @"^\[([a-z]+)\]").Groups[1].Value)
            .Where(c => c.Length > 0)
            .Distinct(StringComparer.Ordinal)
            .OrderBy(c => c, StringComparer.Ordinal)
            .ToList();
        categories.Count.Should().BeGreaterOrEqualTo(n, "categories: " + string.Join(", ", categories));
    }

    [Then(@"^every code issue has a type among ""([^""]+)""$")]
    public void ThenTypesAmong(string csv)
    {
        var allowed = csv.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries).ToHashSet(StringComparer.Ordinal);
        var offending = Components.SelectMany(c => c.CodeIssues.Select(i => (c.Id, i.Rule, i.Type)))
            .Where(t => !allowed.Contains(t.Type)).ToList();
        offending.Should().BeEmpty();
    }

    /// <summary>Official rule ids: the prefix followed by digits (so the engine's own CATCH_* rules do not match "CA").</summary>
    [Then(@"^no component has a code issue whose rule starts with ""([^""]+)""$")]
    public void ThenNoRuleStartsWith(string prefix) =>
        Components.SelectMany(c => c.CodeIssues.Select(i => c.Id + ":" + i.Rule))
            .Where(r => Regex.IsMatch(r.Substring(r.IndexOf(':') + 1), "^" + Regex.Escape(prefix) + "[0-9]+$"))
            .Should().BeEmpty();

    [Then(@"^the analysis log states that extended analysis is ""([^""]+)""$")]
    public void ThenExtendedState(string state) =>
        _context.Log.Should().Contain("Extended analysis: " + state, "the diagnostics were:\n" + _context.Log);

    [Then(@"^the component ""([^""]+)"" has an annotation ""Maintainability:<n>"" with n between (\d+) and (\d+)$")]
    public void ThenMaintainability(string id, int min, int max)
    {
        var annotations = _context.Component(id).Annotations.Where(a => a.StartsWith("Maintainability:", StringComparison.Ordinal)).ToList();
        annotations.Should().ContainSingle($"{id} must have one Maintainability annotation; annotations: {string.Join(", ", _context.Component(id).Annotations)}");
        var value = int.Parse(annotations[0].Substring("Maintainability:".Length));
        value.Should().BeInRange(min, max);
    }

    private string Describe(string id) =>
        string.Join("; ", _context.Component(id).CodeIssues.Select(i => $"{i.Rule}@{i.Line} {i.Type}/{i.Severity}"));
}
