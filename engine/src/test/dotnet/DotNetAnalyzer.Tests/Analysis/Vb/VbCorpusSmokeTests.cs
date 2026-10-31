using DotNetAnalyzer.Analysis;
using DotNetAnalyzer.Tests.SchemaContract;
using FluentAssertions;
using Xunit;

namespace DotNetAnalyzer.Tests.Analysis.Vb;

/// <summary>
/// Smoke tests on the real reference corpus
/// (<c>test-for-demo/vb-demo-legacy</c>). The corpus is external and not redistributable: it is not
/// shipped with the product and must be provided locally. These tests are opt-in (category <c>Corpus</c>);
/// continuous integration excludes them and verifies VB support with the synthetic redistributable corpus
/// (<c>Fixtures/VbLegacy</c>, 009-vb-legacy-completion FR-070/FR-071):
///
///     dotnet test --filter "Category!=Corpus"
/// </summary>
[Trait("Category", "VbLegacy")]
[Trait("Category", "Corpus")]
public class VbCorpusSmokeTests
{
    private const string AccountingControllerProj =
        "test-for-demo/vb-demo-legacy/AmigosPlus.Accounting.Controller/AmigosPlus.Accounting.Controller.vbproj";

    private const string CommonAdaptersProj =
        "test-for-demo/vb-demo-legacy/AmigosPlus.Model.Common.Adapters/AmigosPlus.Model.Common.Adapters.vbproj";

    private static string FindRepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            if (Directory.Exists(Path.Combine(dir.FullName, "test-for-demo", "vb-demo-legacy")))
                return dir.FullName;
            dir = dir.Parent;
        }
        throw new DirectoryNotFoundException(
            "vb-demo-legacy reference corpus not found in any ancestor of " + AppContext.BaseDirectory);
    }

    [Fact(DisplayName = "TS-016/TS-037: Accounting.Controller — all *Controller land in Negocio (FR-021), LOC > 1")]
    public async Task AccountingController_NoFalseControllers_AndRealLoc()
    {
        var path = Path.Combine(FindRepoRoot(), AccountingControllerProj);
        File.Exists(path).Should().BeTrue($"Reference project not found: {path}");

        var analyzer = new ProjectAnalyzer();
        var graph = await analyzer.AnalyzeProjectAsync(path);

        graph.Components.Should().NotBeEmpty();

        // SC-004: zero false Controllers in *.Controller projects.
        var falseControllers = graph.Components
            .Where(c => c.Layer == "Controlador")
            .Select(c => c.Id)
            .ToList();
        falseControllers.Should().BeEmpty(
            "VB legacy *Controller facades have no HTTP markers and must not be classified as Controlador (FR-021)");

        // LOC must be > 1 for the majority of non-trivial classes (TypeAnalyzer
        // bug fix: walk the full ClassBlockSyntax for VB types).
        var nonTrivialLoc = graph.Components.Count(c => c.Loc > 1);
        nonTrivialLoc.Should().BeGreaterThan(graph.Components.Count / 2,
            "the majority of VB controller-style facades have multiple methods and dozens of LOC");
    }

    [Fact(DisplayName = "TS-038: *Adapter classes land in Datos layer (FR-021)")]
    public async Task CommonAdapters_AreClassifiedAsDatos()
    {
        var path = Path.Combine(FindRepoRoot(), CommonAdaptersProj);
        File.Exists(path).Should().BeTrue($"Reference project not found: {path}");

        var analyzer = new ProjectAnalyzer();
        var graph = await analyzer.AnalyzeProjectAsync(path);

        graph.Components.Should().NotBeEmpty();

        var adapterComponents = graph.Components
            .Where(c => c.Id.EndsWith("Adapter", StringComparison.Ordinal))
            .ToList();

        adapterComponents.Should().NotBeEmpty("the project is named *.Adapters and contains Adapter classes");

        var adaptersInDatos = adapterComponents.Count(c => c.Layer == "Datos");
        var pct = adaptersInDatos * 100.0 / adapterComponents.Count;

        pct.Should().BeGreaterThanOrEqualTo(80.0,
            $"FR-021 requires *Adapter components to land in Datos; got {adaptersInDatos}/{adapterComponents.Count} = {pct:F1}%");
    }

    /// <summary>
    /// 020 SC-002 / SC-008 (opt-in): on the reference corpus the stored procedure pass makes the data access
    /// visible (≥ 80 % of the *Adapter components with tables_used, ≥ 850 distinct procedures) without exceeding
    /// 110 % of the analysis time with the pass disabled.
    /// </summary>
    [Fact(DisplayName = "020 SC-002/SC-008: stored procedures of the reference corpus")]
    public async Task StoredProcedures_CoverTheAdapters_WithinTheTimeBudget()
    {
        var root = Path.Combine(FindRepoRoot(), "test-for-demo", "vb-demo-legacy");
        Directory.Exists(root).Should().BeTrue($"Reference corpus not found: {root}");

        var off = new DotNetAnalyzer.Analysis.AnalysisOptions(
            new DotNetAnalyzer.Analysis.DataAccessOptions(DotNetAnalyzer.Analysis.ProceduresMode.Off, null,
                DotNetAnalyzer.Analysis.CatalogMode.Complement));
        var baseline = System.Diagnostics.Stopwatch.StartNew();
        await new ProjectAnalyzer().AnalyzeProjectAsync(root, off);
        baseline.Stop();

        var timed = System.Diagnostics.Stopwatch.StartNew();
        var graph = await new ProjectAnalyzer().AnalyzeProjectAsync(root);
        timed.Stop();

        var adapters = graph.Components.Where(c => c.Id.EndsWith("Adapter", StringComparison.Ordinal)).ToList();
        adapters.Should().NotBeEmpty();
        var covered = adapters.Count(c => c.TablesUsed.Count > 0);
        ((double)covered / adapters.Count).Should().BeGreaterOrEqualTo(0.8,
            $"{covered} of {adapters.Count} *Adapter components have tables_used");

        var procedures = graph.Components.SelectMany(c => c.TablesUsed)
            .Where(t => t.StartsWith("sp:", StringComparison.Ordinal)).Distinct(StringComparer.OrdinalIgnoreCase).Count();
        procedures.Should().BeGreaterOrEqualTo(850);

        timed.Elapsed.Should().BeLessThanOrEqualTo(baseline.Elapsed * 1.10 + TimeSpan.FromSeconds(2),
            "the pass is linear in syntax nodes (SC-008)");
    }

    /// <summary>
    /// 021 SC-001 / SC-006 (opt-in): identity, fine layers, batch entry point and edge resolution on the reference
    /// corpus. Projects that declare a root namespace have no unqualified component; forms and reports of the
    /// *.Win.* projects carry the fine layer; the console module is the batch entry point; the per-project
    /// compilation keeps the inter-project edges (≥ 1 100 edges, 1 249 before 021).
    /// </summary>
    [Fact(DisplayName = "021 SC-001/SC-006: identity, fine layers and edges of the reference corpus")]
    public async Task DesktopIdentity_LayersAndEdges_OnTheReferenceCorpus()
    {
        var root = Path.Combine(FindRepoRoot(), "test-for-demo", "vb-demo-legacy");
        Directory.Exists(root).Should().BeTrue($"Reference corpus not found: {root}");
        var timed = System.Diagnostics.Stopwatch.StartNew();
        var graph = await new ProjectAnalyzer().AnalyzeProjectAsync(root);
        timed.Stop();

        var projectsWithRoot = Directory.GetFiles(root, "*.vbproj", SearchOption.AllDirectories)
            .Select(DotNetAnalyzer.Analysis.Vb.VbProjectFile.Load)
            .Where(p => p.RootNamespace != null)
            .Select(p => p.Directory)
            .ToList();
        projectsWithRoot.Should().NotBeEmpty();
        var unqualified = graph.Components
            .Where(c => !c.Id.Contains('.') && c.Files.Any(f => projectsWithRoot.Any(d => f.StartsWith(d, StringComparison.Ordinal))))
            .Select(c => c.Id).ToList();
        unqualified.Should().BeEmpty("components of projects declaring a RootNamespace must be qualified");

        var win = graph.Components.Where(c => c.Files.Any(f => f.Contains(".Win.", StringComparison.Ordinal))).ToList();
        win.Should().NotBeEmpty();
        var presentation = win.Count(c => c.Annotations.Contains("Layer:Presentación") || c.Annotations.Contains("Layer:Reportes"));
        ((double)presentation / win.Count).Should().BeGreaterOrEqualTo(0.9, $"{presentation} of {win.Count} *.Win.* components");

        graph.Components.Should().Contain(c => c.Annotations.Contains("Layer:Batch") && c.Annotations.Contains("EntryPoint:Main") && c.Layer == "Negocio",
            "the console process module is a batch entry point");
        graph.Edges.Count.Should().BeGreaterOrEqualTo(1100, "per-project compilation must keep the inter-project edges");
        timed.Elapsed.Should().BeLessThan(TimeSpan.FromSeconds(90));
    }

    /// <summary>
    /// 022 SC-001 (opt-in): outbound integrations, missing projects and end-of-life dependencies of the reference
    /// corpus; no full address ever reaches the output.
    /// </summary>
    [Fact(DisplayName = "022 SC-001: integrations, missing projects and EOL dependencies of the reference corpus")]
    public async Task ExternalIntegrations_OnTheReferenceCorpus()
    {
        var root = Path.Combine(FindRepoRoot(), "test-for-demo", "vb-demo-legacy");
        Directory.Exists(root).Should().BeTrue($"Reference corpus not found: {root}");
        var analyzer = new ProjectAnalyzer();
        var graph = await analyzer.AnalyzeProjectAsync(root);

        var integrations = graph.Components.SelectMany(c => c.Annotations).Where(a => a.StartsWith("Integration:", StringComparison.Ordinal)).Distinct().ToList();
        integrations.Count.Should().BeGreaterOrEqualTo(12, "outbound integrations: " + string.Join(", ", integrations));
        analyzer.UserWarnings.Should().Contain(w => w.StartsWith("Referenced projects not included in the analyzed sources: ", StringComparison.Ordinal));
        var missing = analyzer.UserWarnings.First(w => w.StartsWith("Referenced projects", StringComparison.Ordinal));
        missing.Split(':', 2)[1].Split(',').Length.Should().BeGreaterOrEqualTo(11);
        graph.Components.SelectMany(c => c.Annotations).Where(a => a.StartsWith("Dependency:eol:", StringComparison.Ordinal)).Distinct()
            .Count().Should().BeGreaterOrEqualTo(3);
        var json = GraphJson.Serialize(graph);
        json.Should().NotContain("http://").And.NotContain("https://").And.NotContain("net.tcp://");
    }
}
