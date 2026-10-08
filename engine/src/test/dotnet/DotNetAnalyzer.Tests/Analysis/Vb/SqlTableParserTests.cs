using DotNetAnalyzer.Analysis.Vb;
using FluentAssertions;
using Xunit;

namespace DotNetAnalyzer.Tests.Analysis.Vb;

[Trait("Category", "VbLegacy")]
public class SqlTableParserTests
{
    [Theory]
    [InlineData("SELECT c.Id FROM dbo.Customers c INNER JOIN [Orders] o ON o.Id = c.Id", "Customers|Orders")]
    [InlineData("select * from customers", "customers")]
    [InlineData("SELECT Id FROM [CUSTOMERS] WHERE Id = 1", "CUSTOMERS")]
    [InlineData("SELECT TOP 5 Name FROM \"Sales\".\"Regions\"", "Regions")]
    [InlineData("INSERT INTO Customers (Name) VALUES (@n)", "Customers")]
    [InlineData("INSERT INTO Archive SELECT * FROM Orders", "Archive|Orders")]
    [InlineData("update [sales].[Invoices] set Paid = 1 where Id = @id", "Invoices")]
    [InlineData("DELETE FROM AuditLog WHERE CreatedOn < @limit", "AuditLog")]
    [InlineData("DELETE TOP (10) FROM Queue", "Queue")]
    [InlineData("MERGE INTO Stock AS s USING StockImport AS i ON s.Sku = i.Sku WHEN MATCHED THEN DELETE;", "Stock|StockImport")]
    [InlineData("SELECT * FROM \u0001 t JOIN Regions r ON r.Id = t.RegionId", "Regions")]
    [InlineData("SELECT a.Id FROM Orders a JOIN orders b ON a.Id = b.Id", "Orders")]
    public void Recognized_statements_yield_their_tables(string sql, string expected)
    {
        SqlTableParser.Parse(sql).Should().Equal(expected.Split('|'));
    }

    [Theory]
    [InlineData("Select a customer from the list")]
    [InlineData("Update the record set")]
    [InlineData("Insert into the box")]
    [InlineData("Delete from the list first")]
    [InlineData("EXEC usp_PurgeCustomers")]
    [InlineData("usp_NightlyMaintenance")]
    [InlineData("SELECT * FROM #Staging")]
    [InlineData("SELECT * FROM @pending")]
    [InlineData("SELECT * FROM dbo.fnActiveCustomers(1)")]
    [InlineData("SELECT * FROM \u0001")]
    [InlineData("C:\\Reports\\select from here.txt")]
    [InlineData("")]
    public void Text_that_is_not_table_producing_SQL_yields_nothing(string text)
    {
        SqlTableParser.Parse(text).Should().BeEmpty();
    }

    [Theory]
    [InlineData("dbo.Invoices", "Invoices")]
    [InlineData("[sales].[Invoice Lines]", "Invoice Lines")]
    [InlineData("Orders", "Orders")]
    [InlineData("not a table", null)]
    public void Normalize_keeps_the_last_part_without_delimiters(string tableRef, string? expected)
    {
        SqlTableParser.Normalize(tableRef).Should().Be(expected);
    }
}
