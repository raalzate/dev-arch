using DotNetAnalyzer.Analysis.Vb;
using DotNetAnalyzer.Tests.Bdd;
using FluentAssertions;
using Xunit;

namespace DotNetAnalyzer.Tests.Analysis.Vb;

[Trait("Category", "VbLegacy")]
public class TypedDataSetParserTests
{
    [Fact]
    public void Adapters_and_typed_tables_of_the_synthetic_DataSet_resolve_to_database_tables()
    {
        var path = Path.Combine(VbAnalysisContext.FixturesDir, "VbLegacy", "SyntheticDesktop", "DataAccess", "SalesDataSet.xsd");

        var dataSet = TypedDataSetParser.Parse(path);

        dataSet.Should().NotBeNull();
        dataSet!.File.Should().Be("SalesDataSet.xsd");
        dataSet.Adapters.Should().Equal(
            new TypedDataSetClass("InvoicesTableAdapter", "Invoices"),
            new TypedDataSetClass("InvoiceLinesTableAdapter", "InvoiceLines"));
        dataSet.DataTables.Should().Equal(
            new TypedDataSetClass("InvoicesDataTable", "Invoices"),
            new TypedDataSetClass("InvoiceLinesDataTable", "InvoiceLines"));
    }

    [Fact]
    public void Adapter_without_source_falls_back_to_its_name_and_default_class_name()
    {
        var dir = Directory.CreateTempSubdirectory("vb009-xsd-");
        try
        {
            var path = Path.Combine(dir.FullName, "Bare.xsd");
            File.WriteAllText(path, """
                <?xml version="1.0" encoding="utf-8"?>
                <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
                  <DataSource xmlns="urn:schemas-microsoft-com:xml-msdatasource">
                    <Tables><TableAdapter Name="Regions" /></Tables>
                  </DataSource>
                </xs:schema>
                """);

            var dataSet = TypedDataSetParser.Parse(path);

            dataSet!.Adapters.Should().Equal(new TypedDataSetClass("RegionsTableAdapter", "Regions"));
            dataSet.DataTables.Should().BeEmpty();
        }
        finally
        {
            dir.Delete(recursive: true);
        }
    }

    [Fact]
    public void Malformed_or_DTD_files_are_ignored()
    {
        var dir = Directory.CreateTempSubdirectory("vb009-xsd-");
        try
        {
            var broken = Path.Combine(dir.FullName, "Broken.xsd");
            File.WriteAllText(broken, "<xs:schema");
            var dtd = Path.Combine(dir.FullName, "Dtd.xsd");
            File.WriteAllText(dtd, "<?xml version=\"1.0\"?><!DOCTYPE x [<!ENTITY e \"v\">]><x>&e;</x>");

            TypedDataSetParser.Parse(broken).Should().BeNull();
            TypedDataSetParser.Parse(dtd).Should().BeNull();
        }
        finally
        {
            dir.Delete(recursive: true);
        }
    }
}
