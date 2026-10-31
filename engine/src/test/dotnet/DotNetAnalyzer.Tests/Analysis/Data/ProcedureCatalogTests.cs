using DotNetAnalyzer.Analysis.Data;
using FluentAssertions;
using Xunit;

namespace DotNetAnalyzer.Tests.Analysis.Data;

public class ProcedureCatalogTests : IDisposable
{
    private readonly string _dir = Path.Combine(Path.GetTempPath(), "catalog020-" + Guid.NewGuid().ToString("N"));

    public ProcedureCatalogTests() => Directory.CreateDirectory(_dir);

    public void Dispose() => Directory.Delete(_dir, recursive: true);

    private static ProcedureName N(string text) => ProcedureName.Parse(text)!;

    [Fact]
    public void Scripts_resolve_transitively_and_terminate_on_cycles()
    {
        File.WriteAllText(Path.Combine(_dir, "a.sql"), "CREATE PROCEDURE usp_A AS SELECT * FROM TA\nEXEC usp_B");
        File.WriteAllText(Path.Combine(_dir, "b.sql"), "CREATE PROCEDURE usp_B AS INSERT INTO TB SELECT * FROM TA\nEXECUTE usp_A");
        var catalog = ProcedureCatalog.Load(_dir);
        catalog.NotLoaded.Should().BeNull();
        catalog.Resolve(N("dbo.usp_A")).Should().Equal("TA", "TB");
        catalog.Resolve(N("USP_B")).Should().Equal("TA", "TB");
        catalog.Resolve(N("usp_Missing")).Should().BeNull();
        catalog.Warnings().Should().Equal($"Procedure catalog '{Path.GetFileName(_dir)}': 1 procedure(s) not found: usp_missing");
    }

    [Fact]
    public void Duplicates_keep_the_lowest_path_and_warn()
    {
        File.WriteAllText(Path.Combine(_dir, "b.sql"), "CREATE PROCEDURE usp_A AS SELECT * FROM Second");
        File.WriteAllText(Path.Combine(_dir, "a.sql"), "CREATE PROCEDURE usp_A AS SELECT * FROM First");
        Directory.CreateDirectory(Path.Combine(_dir, "bin"));
        File.WriteAllText(Path.Combine(_dir, "bin", "z.sql"), "CREATE PROCEDURE usp_Z AS SELECT * FROM Ignored");
        var catalog = ProcedureCatalog.Load(_dir);
        catalog.Resolve(N("usp_A")).Should().Equal("First");
        catalog.Resolve(N("usp_Z")).Should().BeNull();
        catalog.Warnings().Should().Contain(w => w.Contains("duplicate definition of usp_a in b.sql; a.sql used"));
    }

    [Fact]
    public void Csv_with_either_header_is_read_and_identifiers_are_matched_canonically()
    {
        var es = ProcedureCatalog.FromCsv("procs.csv", "procedimiento,tabla,operación\n\"[dbo].[usp_X]\",\"Policies\",SELECT\nUSP_X,[dbo].[Holders],UPDATE\n");
        es.Resolve(N("usp_x")).Should().Equal("Holders", "Policies");
        var en = ProcedureCatalog.FromCsv("procs.csv", "Procedure, Table, Operation\nusp_X,Policies,SELECT\n");
        en.Resolve(N("usp_X")).Should().Equal("Policies");
    }

    [Fact]
    public void Bad_csv_header_and_missing_path_are_reported_not_thrown()
    {
        var bad = ProcedureCatalog.FromCsv("bad.csv", "name,object\nusp_X,Policies\n");
        bad.NotLoaded.Should().StartWith("CSV header must be");
        bad.Resolve(N("usp_X")).Should().BeNull();
        bad.Warnings().Should().ContainSingle().Which.Should().StartWith("Procedure catalog 'bad.csv' not loaded: CSV header must be");

        var missing = ProcedureCatalog.Load(Path.Combine(_dir, "missing"));
        missing.NotLoaded.Should().Be("path not found");
        missing.Warnings().Should().ContainSingle().Which.Should().Be("Procedure catalog 'missing' not loaded: path not found; procedures are reported as sp:<name> only");
    }
}
