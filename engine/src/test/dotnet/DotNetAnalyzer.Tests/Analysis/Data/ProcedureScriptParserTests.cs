using DotNetAnalyzer.Analysis.Data;
using FluentAssertions;
using Xunit;

namespace DotNetAnalyzer.Tests.Analysis.Data;

public class ProcedureScriptParserTests
{
    private const string Script = """
        -- fictitious
        CREATE PROCEDURE [dbo].[usp_Policy_Read] @Id INT AS
        BEGIN
            SELECT p.Id FROM dbo.Policies p INNER JOIN PolicyHolders h ON h.Id = p.HolderId WHERE p.Id = @Id;
        END
        GO
        CREATE OR ALTER PROCEDURE dbo.usp_Policy_Archive @Id INT AS
        BEGIN
            INSERT INTO PolicyArchive SELECT * FROM Policies WHERE Id = @Id
            DELETE FROM Policies WHERE Id = @Id
            EXEC dbo.usp_Audit_Write @Id
        END
        GO
        ALTER PROC usp_Audit_Write @Id INT AS
            INSERT INTO AuditLog (PolicyId) VALUES (@Id)
        """;

    [Fact]
    public void Headers_bodies_tables_and_calls_are_read()
    {
        var definitions = ProcedureScriptParser.Parse(Script);
        definitions.Select(d => d.Name.Canonical).Should().Equal("usp_Policy_Read", "usp_Policy_Archive", "usp_Audit_Write");
        definitions[0].Tables.Should().Equal("Policies", "PolicyHolders");
        definitions[1].Tables.Should().Equal("Policies", "PolicyArchive");
        definitions[1].Calls.Should().Equal("usp_audit_write");
        definitions[2].Tables.Should().Equal("AuditLog");
    }

    [Fact]
    public void Statements_split_at_semicolons_and_statement_starts()
    {
        var body = "SELECT a FROM A\n    UPDATE B SET x = 1;\nDELETE FROM C";
        ProcedureScriptParser.SplitStatements(body).Should().Equal("SELECT a FROM A", "UPDATE B SET x = 1", "DELETE FROM C");
    }

    [Fact]
    public void Scripts_without_procedures_or_with_other_objects_yield_nothing()
    {
        ProcedureScriptParser.Parse("CREATE TABLE Policies (Id INT)\nGO\nCREATE VIEW v AS SELECT * FROM Policies").Should().BeEmpty();
        ProcedureScriptParser.Parse(string.Empty).Should().BeEmpty();
    }
}
