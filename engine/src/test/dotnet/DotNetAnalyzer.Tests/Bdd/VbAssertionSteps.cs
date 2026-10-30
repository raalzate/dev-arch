using System.Globalization;
using System.Reflection;
using System.Text.Json.Nodes;
using DotNetAnalyzer.Analysis.Vb;
using DotNetAnalyzer.Model;
using DotNetAnalyzer.Tests.SchemaContract;
using FluentAssertions;
using Reqnroll;

namespace DotNetAnalyzer.Tests.Bdd;

/// <summary>Assertion steps of 009-vb-legacy-completion (tables, issues, metrics, secrets, layers, endpoints).</summary>
[Binding]
public sealed class VbAssertionSteps
{
    private const double Tolerance = 0.001;
    private readonly VbAnalysisContext _context;

    public VbAssertionSteps(VbAnalysisContext context) => _context = context;

    private DependencyGraph Graph => _context.Graph ?? throw new InvalidOperationException("The project was not analyzed");

    private static List<string> Csv(string text) =>
        text.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();

    private static List<string> SortedCsv(string text) => Csv(text).OrderBy(t => t, StringComparer.Ordinal).ToList();

    private static double Number(string text) => double.Parse(text, CultureInfo.InvariantCulture);

    // ── Tables ──────────────────────────────────────────────────────────────

    [Then(@"^the component ""([^""]+)"" uses exactly the tables ""([^""]*)""$")]
    public void ThenUsesExactlyTheTables(string id, string tables) =>
        _context.Component(id).TablesUsed.Should().Equal(SortedCsv(tables), $"tables of {id}");

    [Then(@"^the component ""([^""]+)"" uses no tables$")]
    public void ThenUsesNoTables(string id) => _context.Component(id).TablesUsed.Should().BeEmpty();

    [Then(@"^the components using tables are exactly:$")]
    public void ThenTheComponentsUsingTablesAreExactly(Table table)
    {
        var actual = Graph.Components.Where(c => c.TablesUsed.Count > 0)
            .ToDictionary(c => c.Id, c => string.Join(", ", c.TablesUsed));
        var expected = table.Rows.ToDictionary(r => r["component"], r => string.Join(", ", SortedCsv(r["tables"])));
        actual.Should().BeEquivalentTo(expected);
    }

    // ── Code issues ─────────────────────────────────────────────────────────

    private List<CodeIssue> Issues(string id, string rule) =>
        _context.Component(id).CodeIssues.Where(i => i.Rule == rule).ToList();

    [Then(@"^the component ""([^""]+)"" has a code issue ""([^""]+)"" of type ""([^""]+)"" with severity ""([^""]+)"" at line (\d+)$")]
    public void ThenHasIssueAtLine(string id, string rule, string type, string severity, int line)
    {
        var issues = Issues(id, rule);
        issues.Should().Contain(i => i.Type == type && i.Severity == severity && i.Line == line,
            $"{id} must report {rule}/{type}/{severity} at line {line}; found {Describe(_context.Component(id))}");
        issues.Should().OnlyContain(i => !string.IsNullOrWhiteSpace(i.Message));
    }

    [Then(@"^the component ""([^""]+)"" has no code issue ""([^""]+)""$")]
    public void ThenHasNoIssue(string id, string rule) => Issues(id, rule).Should().BeEmpty();

    [Then(@"^the component ""([^""]+)"" has none of the code issues ""([^""]+)""$")]
    public void ThenHasNoneOf(string id, string rules)
    {
        var forbidden = Csv(rules);
        _context.Component(id).CodeIssues.Where(i => forbidden.Contains(i.Rule)).Should().BeEmpty(
            Describe(_context.Component(id)));
    }

    [Then(@"^the component ""([^""]+)"" has the code issues ""([^""]+)"" exactly at lines ""([^""]+)""$")]
    public void ThenHasIssuesAtLines(string id, string rule, string lines) =>
        Issues(id, rule).Select(i => i.Line).OrderBy(l => l).Should()
            .Equal(Csv(lines).Select(int.Parse).OrderBy(l => l), Describe(_context.Component(id)));

    [Then(@"^every ""([^""]+)"" issue of the component ""([^""]+)"" has type ""([^""]+)"" and severity ""([^""]+)""$")]
    public void ThenEveryIssueHas(string rule, string id, string type, string severity)
    {
        var issues = Issues(id, rule);
        issues.Should().NotBeEmpty();
        issues.Should().OnlyContain(i => i.Type == type && i.Severity == severity);
    }

    [Then(@"^the component ""([^""]+)"" has exactly (\d+) code issues? ""([^""]+)""$")]
    public void ThenHasExactlyNIssues(string id, int count, string rule) => Issues(id, rule).Should().HaveCount(count);

    [Then(@"^the components have exactly these code issue counts:$")]
    public void ThenIssueCounts(Table table)
    {
        var actual = Graph.Components.SelectMany(c => c.CodeIssues.Select(i => (c.Id, i.Rule)))
            .GroupBy(x => $"{x.Id}|{x.Rule}").ToDictionary(g => g.Key, g => g.Count());
        var expected = table.Rows.ToDictionary(r => $"{r["component"]}|{r["rule"]}", r => int.Parse(r["count"]));
        actual.Should().BeEquivalentTo(expected);
    }

    [Then(@"^the code issues of every component are ordered by location and rule$")]
    public void ThenIssuesOrdered()
    {
        foreach (var component in Graph.Components)
        {
            var sorted = component.CodeIssues
                .OrderBy(i => i.Location ?? string.Empty, StringComparer.Ordinal)
                .ThenBy(i => i.Rule, StringComparer.Ordinal)
                .ToList();
            component.CodeIssues.Should().Equal(sorted, $"issues of {component.Id}");
        }
    }

    [Then(@"^the component ""([^""]+)"" is marked as handling sensitive data$")]
    public void ThenSensitive(string id) => _context.Component(id).SensitiveData.Should().BeTrue();

    [Then(@"^the component ""([^""]+)"" is not marked as handling sensitive data$")]
    public void ThenNotSensitive(string id) => _context.Component(id).SensitiveData.Should().BeFalse();

    [Then(@"^the serialized output does not contain ""([^""]+)""$")]
    public void ThenOutputDoesNotContain(string text) => _context.Json.Should().NotContain(text);

    // ── Metrics ─────────────────────────────────────────────────────────────

    [Then(@"^the component ""([^""]+)"" has cbo (\d+)$")]
    public void ThenCbo(string id, int cbo) => _context.Component(id).Cbo.Should().Be(cbo);

    [Then(@"^the component ""([^""]+)"" has lcom ([0-9.]+)$")]
    public void ThenLcom(string id, string lcom) =>
        _context.Component(id).Lcom.Should().NotBeNull().And.BeApproximately(Number(lcom), Tolerance);

    [Then(@"^the component ""([^""]+)"" has complexity max (\d+) and average ([0-9.]+)$")]
    public void ThenComplexity(string id, int max, string avg)
    {
        var component = _context.Component(id);
        component.ComplexityMax.Should().Be(max);
        component.ComplexityAvg.Should().NotBeNull().And.BeApproximately(Number(avg), Tolerance);
    }

    [Then(@"^the component ""([^""]+)"" has (\d+) code issue ""([^""]+)"" with type ""([^""]+)"", severity ""([^""]+)"" and message ""([^""]+)""$")]
    public void ThenIssueWithMessage(string id, int count, string rule, string type, string severity, string message)
    {
        var issues = Issues(id, rule);
        issues.Should().HaveCount(count);
        if (count > 0)
        {
            issues.Should().OnlyContain(i => i.Type == type && i.Severity == severity && i.Message == message);
        }
    }

    [Then(@"^the components have these metrics:$")]
    public void ThenMetrics(Table table)
    {
        foreach (var row in table.Rows)
        {
            var c = _context.Component(row["component"]);
            c.Cbo.Should().Be(int.Parse(row["cbo"]), $"cbo of {c.Id}");
            c.Lcom.Should().NotBeNull().And.BeApproximately(Number(row["lcom"]), Tolerance, $"lcom of {c.Id}");
            c.ComplexityMax.Should().Be(int.Parse(row["complexity_max"]), $"complexity_max of {c.Id}");
            c.ComplexityAvg.Should().NotBeNull().And.BeApproximately(Number(row["complexity_avg"]), Tolerance,
                $"complexity_avg of {c.Id}");
        }
    }

    [Then(@"^the component ""([^""]+)"" has a code issue ""([^""]+)"" with severity ""([^""]+)"" and message ""([^""]+)""$")]
    public void ThenIssueSeverityMessage(string id, string rule, string severity, string message) =>
        Issues(id, rule).Should().Contain(i => i.Severity == severity && i.Message == message,
            Describe(_context.Component(id)));

    [Then(@"^the component ""([^""]+)"" has loc (\d+)$")]
    public void ThenLoc(string id, int loc) => _context.Component(id).Loc.Should().Be(loc);

    // ── Configuration and secrets ───────────────────────────────────────────

    [Then(@"^the component ""([^""]+)"" has exactly the secrets references ""([^""]*)""$")]
    public void ThenSecrets(string id, string references) =>
        _context.Component(id).SecretsReferences.Should().Equal(SortedCsv(references));

    [Then(@"^the components have these secrets references and sensitivity:$")]
    public void ThenSecretsTable(Table table)
    {
        foreach (var row in table.Rows)
        {
            var c = _context.Component(row["component"]);
            c.SecretsReferences.Should().Equal(SortedCsv(row["references"]), $"secrets of {c.Id}");
            c.SensitiveData.Should().Be(bool.Parse(row["sensitive"]), $"sensitive_data of {c.Id}");
        }
    }

    [Then(@"^reading the configuration of the project reports a diagnostic naming ""([^""]+)""$")]
    public void ThenConfigDiagnostic(string fileName)
    {
        var dir = Path.GetDirectoryName(_context.Target)!;
        AppConfigParser.Load(dir).Diagnostics.Should().Contain(d => d.Contains(fileName, StringComparison.Ordinal));
    }

    // ── Layers ──────────────────────────────────────────────────────────────

    [Then(@"^the component ""([^""]+)"" is in layer ""([^""]+)""$")]
    public void ThenLayer(string id, string layer) => _context.Component(id).Layer.Should().Be(layer);

    // ── Endpoints ───────────────────────────────────────────────────────────

    private ApiEndpoint Endpoint(string id) =>
        Graph.ApiContracts.Endpoints.SingleOrDefault(e => e.Id == id)
        ?? throw new Xunit.Sdk.XunitException(
            $"Endpoint '{id}' not found; endpoints: {string.Join(", ", Graph.ApiContracts.Endpoints.Select(e => e.Id))}");

    [Then(@"^the endpoints are exactly:$")]
    public void ThenEndpoints(Table table)
    {
        Graph.ApiContracts.Endpoints.Select(e => $"{e.Method} {e.Path} {e.ComponentId}").Should()
            .Equal(table.Rows.Select(r => $"{r["method"]} {r["path"]} {r["component"]}"));
        Graph.ApiContracts.Endpoints.Should().OnlyContain(e => e.Id == $"{e.Method} {e.Path}");
    }

    [Then(@"^there are no endpoints$")]
    public void ThenNoEndpoints() => Graph.ApiContracts.Endpoints.Should().BeEmpty();

    [Then(@"^the endpoint ""([^""]+)"" has the parameters:$")]
    public void ThenParameters(string id, Table table) =>
        Endpoint(id).Parameters.Select(p => $"{p.Name}|{p.In}|{p.Type}|{p.Required.ToString().ToLowerInvariant()}")
            .Should().Equal(table.Rows.Select(r => $"{r["name"]}|{r["in"]}|{r["type"]}|{r["required"]}"));

    [Then(@"^the endpoint ""([^""]+)"" has no parameters$")]
    public void ThenNoParameters(string id) => Endpoint(id).Parameters.Should().BeEmpty();

    [Then(@"^the endpoint ""([^""]+)"" has the response schema ""([^""]+)""$")]
    public void ThenResponse(string id, string schema) => Endpoint(id).ResponseSchema.Should().Be(schema);

    [Then(@"^the endpoint ""([^""]+)"" has no response schema$")]
    public void ThenNoResponse(string id) => Endpoint(id).ResponseSchema.Should().BeNull();

    // ── Reduced fidelity and warnings ───────────────────────────────────────

    [Then(@"^the analysis declares the source ""([^""]+)""$")]
    public void ThenSource(string source) => Graph.Meta.Source.Should().Be(source);

    [Then(@"^the analyzer reports exactly the user warnings:$")]
    public void ThenExactWarnings(string text) =>
        _context.UserWarnings.Should().Equal(text.Replace("\r\n", "\n").Split('\n', StringSplitOptions.RemoveEmptyEntries));

    [Then(@"^the analyzer reports exactly one user warning, starting with ""([^""]+)""$")]
    public void ThenOneWarning(string prefix)
    {
        _context.UserWarnings.Should().ContainSingle();
        _context.UserWarnings[0].Should().StartWith(prefix);
    }

    [Then(@"^the analyzer reports no user warnings$")]
    public void ThenNoWarnings() => _context.UserWarnings.Should().BeEmpty();

    [Then(@"^no user warning contains an absolute path$")]
    public void ThenNoAbsolutePath()
    {
        var root = Path.GetDirectoryName(Path.GetFullPath(_context.Target!))!;
        _context.UserWarnings.Should().OnlyContain(w => !w.Contains(root, StringComparison.Ordinal)
                                                       && !w.Contains(Path.GetTempPath(), StringComparison.Ordinal));
    }

    [Then(@"^the analysis log does not report an error analyzing the type ""([^""]+)""$")]
    public void ThenLogHasNoTypeError(string id) =>
        _context.Log.Should().NotContain($"error analyzing type '{id}'", "the diagnostics were:\n" + _context.Log);

    [Then(@"^the analysis log reports that a SQL literal of (\d+) characters exceeds the bound of (\d+) and was ignored$")]
    public void ThenLogReportsLiteralBound(int length, int bound) =>
        _context.Log.Should().Contain($"SQL literal of {length} characters exceeds the bound of {bound} and was ignored",
            "the diagnostics were:\n" + _context.Log);

    [Then(@"^the SQL table parser builds its regular expressions without a match timeout$")]
    public void ThenSqlParserHasNoMatchTimeout()
    {
        var regexes = typeof(SqlTableParser)
            .GetFields(BindingFlags.NonPublic | BindingFlags.Static)
            .Where(f => f.FieldType == typeof(System.Text.RegularExpressions.Regex))
            .Select(f => (System.Text.RegularExpressions.Regex)f.GetValue(null)!)
            .ToList();
        regexes.Should().NotBeEmpty();
        regexes.Should().OnlyContain(r => r.MatchTimeout == System.Text.RegularExpressions.Regex.InfiniteMatchTimeout,
            "a wall-clock timeout makes the tables depend on the machine (Constitution IV)");
    }

    [Then(@"^both analyses report the same user warnings$")]
    public void ThenSameWarnings() => _context.SecondUserWarnings.Should().Equal(_context.UserWarnings);

    [Then(@"^both serialized outputs are byte-identical$")]
    public void ThenSameJson() => _context.SecondJson.Should().Be(_context.Json);

    [Then(@"^no source file under ""([^""]+)"" or ""([^""]+)"" is part of any component$")]
    public void ThenNoBuildOutputs(string first, string second)
    {
        var segments = new[] { $"/{first}/", $"/{second}/" };
        Graph.Components.SelectMany(c => c.Files)
            .Should().OnlyContain(f => !segments.Any(s => f.Replace('\\', '/').Contains(s, StringComparison.OrdinalIgnoreCase)));
    }

    // ── Compatibility ───────────────────────────────────────────────────────

    [Then(@"^the serialized output, with the fixture root replaced by ""([^""]+)"", equals the golden file ""([^""]+)""$")]
    public void ThenGolden(string marker, string golden)
    {
        var root = Path.GetFullPath(_context.FixtureRoot!).Replace('\\', '/').TrimEnd('/');
        var actual = _context.Json!.Replace(root, marker, StringComparison.Ordinal);
        var path = Path.Combine(VbAnalysisContext.FixturesDir, "Golden", golden);
        if (Environment.GetEnvironmentVariable("VB009_WRITE_GOLDEN") == "1" && !File.Exists(path))
        {
            File.WriteAllText(path, actual);
        }

        File.Exists(path).Should().BeTrue($"golden file {path} must exist (captured before feature 009)");
        actual.Should().Be(File.ReadAllText(path));
    }

    // ── Corpus ──────────────────────────────────────────────────────────────

    [Then(@"^at least (\d+) components use tables$")]
    public void ThenAtLeastTables(int n) => Graph.Components.Count(c => c.TablesUsed.Count > 0).Should().BeGreaterOrEqualTo(n);

    [Then(@"^at least (\d+) components report cbo, lcom, complexity_max and complexity_avg$")]
    public void ThenAtLeastMetrics(int n) =>
        Graph.Components.Count(c => c.Cbo != null && c.Lcom != null && c.ComplexityMax != null && c.ComplexityAvg != null)
            .Should().BeGreaterOrEqualTo(n);

    [Then(@"^the code issues cover at least (\d+) distinct rules$")]
    public void ThenAtLeastRules(int n) =>
        Graph.Components.SelectMany(c => c.CodeIssues).Select(i => i.Rule).Distinct().Count().Should().BeGreaterOrEqualTo(n);

    [Then(@"^the synthetic VB corpus contains the files:$")]
    public void ThenCorpusFiles(Table table)
    {
        foreach (var row in table.Rows)
        {
            var path = Path.Combine(VbAnalysisContext.FixturesDir, "VbLegacy", row["project"], row["file"]);
            File.Exists(path).Should().BeTrue(path);
        }
    }

    [Then(@"^every synthetic VB project declares in its README that it is synthetic and fictitious$")]
    public void ThenReadmes()
    {
        foreach (var project in new[] { "SyntheticDesktop", "SyntheticWebServices" })
        {
            var readme = File.ReadAllText(Path.Combine(VbAnalysisContext.FixturesDir, "VbLegacy", project, "README.md"));
            readme.Should().Contain("Synthetic").And.Contain("fictitious");
        }
    }

    [Then(@"^the serialized output validates against the dependency-graph contract ""([^""]+)""$")]
    public void ThenValidates(string version)
    {
        ContractSchemas.Shared.Version.Should().Be(version);
        ContractSchemas.Shared.Validate("dependency-graph", JsonNode.Parse(_context.Json!)).Should().BeEmpty();
    }

    [Then(@"^the test class ""([^""]+)"" belongs to the test category ""([^""]+)""$")]
    public void ThenCategory(string className, string category)
    {
        var type = Assembly.GetExecutingAssembly().GetTypes().Single(t => t.Name == className);
        type.GetCustomAttributesData()
            .Where(a => a.AttributeType == typeof(Xunit.TraitAttribute))
            .Select(a => $"{a.ConstructorArguments[0].Value}={a.ConstructorArguments[1].Value}")
            .Should().Contain($"Category={category}");
    }

    [Then(@"^the documentation of ""([^""]+)"" states that the corpus is external, not redistributable and opt-in$")]
    public void ThenCorpusDocs(string className)
    {
        var source = Directory.GetFiles(Path.Combine(VbAnalysisContext.EngineRoot, "src", "test", "dotnet"),
            className + ".cs", SearchOption.AllDirectories).Single();
        var docs = string.Join("\n", File.ReadAllLines(source).Where(l => l.TrimStart().StartsWith("///", StringComparison.Ordinal)));
        docs.Should().Contain("external").And.Contain("not redistributable").And.Contain("opt-in");
        docs.Should().NotContain("part of this repository");
    }

    private static string Describe(Component c) =>
        string.Join("; ", c.CodeIssues.Select(i => $"{i.Rule}/{i.Type}/{i.Severity}@{i.Line}"));
}
