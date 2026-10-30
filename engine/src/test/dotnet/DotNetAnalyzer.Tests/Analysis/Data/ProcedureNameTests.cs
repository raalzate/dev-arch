using DotNetAnalyzer.Analysis.Data;
using FluentAssertions;
using Xunit;

namespace DotNetAnalyzer.Tests.Analysis.Data;

public class ProcedureNameTests
{
    [Theory]
    [InlineData("usp_Policy_Read", "usp_Policy_Read")]
    [InlineData("[dbo].[usp_Policy_Read]", "usp_Policy_Read")]
    [InlineData("dbo.usp_Policy_Read", "usp_Policy_Read")]
    [InlineData("\"usp_Policy_Read\"", "usp_Policy_Read")]
    [InlineData("  Server.db.dbo.usp_X  ", "usp_X")]
    [InlineData("`usp_X`", "usp_X")]
    public void Canonical_is_the_last_part_without_delimiters(string text, string canonical)
    {
        var name = ProcedureName.Parse(text);
        name.Should().NotBeNull();
        name!.Canonical.Should().Be(canonical);
        name.Entry.Should().Be("sp:" + canonical);
    }

    [Theory]
    [InlineData("USP_POLICY_READ")]
    [InlineData("[dbo].[usp_policy_read]")]
    public void Key_ignores_case_and_schema(string text) =>
        ProcedureName.Parse(text)!.Key.Should().Be(ProcedureName.Parse("usp_Policy_Read")!.Key);

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("SELECT * FROM Customers")]
    [InlineData("usp_X ")]  // trailing space is trimmed: valid; covered below as positive
    [InlineData("a.b.c.d.e")]
    [InlineData("[dbo].usp_X]")]
    [InlineData("dbo.")]
    [InlineData("usp X")]
    [InlineData("usp-X")]
    public void Non_identifiers_are_rejected(string text)
    {
        if (text == "usp_X ")
        {
            ProcedureName.Parse(text).Should().NotBeNull();
            return;
        }

        ProcedureName.Parse(text).Should().BeNull();
        ProcedureName.LooksLikeIdentifier(text).Should().BeFalse();
    }

    [Fact]
    public void Too_long_names_are_rejected() =>
        ProcedureName.Parse(new string('x', ProcedureName.MaxLength + 1)).Should().BeNull();
}
