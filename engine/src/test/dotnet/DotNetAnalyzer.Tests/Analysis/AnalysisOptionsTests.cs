using DotNetAnalyzer.Analysis;
using FluentAssertions;
using Xunit;

namespace DotNetAnalyzer.Tests.Analysis;

public class AnalysisOptionsTests
{
    [Fact]
    public void Empty_object_gives_the_defaults()
    {
        AnalysisOptions.Parse("{}").Should().Be(AnalysisOptions.Default);
        AnalysisOptions.Default.DataAccess.Procedures.Should().Be(ProceduresMode.Auto);
        AnalysisOptions.Default.DataAccess.CatalogMode.Should().Be(CatalogMode.Complement);
        AnalysisOptions.Default.DataAccess.CatalogPath.Should().BeNull();
    }

    [Fact]
    public void Known_values_are_read_and_unknown_keys_ignored()
    {
        var options = AnalysisOptions.Parse(
            """{ "dataAccess": { "procedures": "ON", "procedureCatalog": "/c/procs", "catalogMode": "replace", "procedureWeight": 0.5, "future": 1 }, "layers": {} }""");
        options.DataAccess.Should().Be(new DataAccessOptions(ProceduresMode.On, "/c/procs", CatalogMode.Replace));
    }

    [Theory]
    [InlineData("""{ "dataAccess": { "procedures": "sometimes" } }""", "dataAccess.procedures must be one of auto, on, off")]
    [InlineData("""{ "dataAccess": { "catalogMode": "merge" } }""", "dataAccess.catalogMode must be one of complement, replace")]
    [InlineData("""{ "dataAccess": 3 }""", "dataAccess must be an object")]
    [InlineData("""[]""", "the configuration must be a JSON object")]
    [InlineData("""{ "dataAccess": { "procedureCatalog": 7 } }""", "dataAccess.procedureCatalog must be a string or null")]
    [InlineData("""not json""", "not valid JSON")]
    public void Invalid_values_are_rejected_with_their_cause(string json, string message)
    {
        var act = () => AnalysisOptions.Parse(json);
        act.Should().Throw<ArgumentException>().WithMessage(message + "*");
    }

    [Fact]
    public void Null_catalog_and_blank_catalog_mean_no_catalog()
    {
        AnalysisOptions.Parse("""{ "dataAccess": { "procedureCatalog": null } }""").DataAccess.CatalogPath.Should().BeNull();
        AnalysisOptions.Parse("""{ "dataAccess": { "procedureCatalog": "  " } }""").DataAccess.CatalogPath.Should().BeNull();
    }
}
