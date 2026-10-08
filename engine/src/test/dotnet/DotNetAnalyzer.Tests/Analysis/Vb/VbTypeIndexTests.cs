using DotNetAnalyzer.Analysis.Vb;
using FluentAssertions;
using Microsoft.CodeAnalysis.VisualBasic.Syntax;
using Xunit;

namespace DotNetAnalyzer.Tests.Analysis.Vb;

[Trait("Category", "VbLegacy")]
public class VbTypeIndexTests
{
    private const string Source = """
        Namespace Shop.Core
            Public Class Outer
                Public Sub A()
                    Dim x As Integer = 1
                End Sub
                Public Class Inner
                    Public Sub B()
                        Dim y As Integer = 2
                    End Sub
                End Class
            End Class
            Public Module Helpers
            End Module
            Public Interface IThing
            End Interface
            Public Structure Point
            End Structure
        End Namespace
        """;

    [Fact]
    public void Build_MapsEveryTypeBlockToTheTypeAnalyzerId()
    {
        var index = VbTypeIndex.Build(VbTestCompilations.Create(("/p/A.vb", Source)));

        index.Types.Select(t => t.Id).Should().Equal(
            "Shop.Core.Outer", "Shop.Core.Inner", "Shop.Core.Helpers", "Shop.Core.IThing", "Shop.Core.Point");
    }

    [Fact]
    public void Owner_IsTheInnermostTypeBlock()
    {
        var index = VbTypeIndex.Build(VbTestCompilations.Create(("/p/A.vb", Source)));
        var outer = index.Types.Single(t => t.Id == "Shop.Core.Outer");
        var declarators = outer.Block.DescendantNodes().OfType<VariableDeclaratorSyntax>().ToList();

        index.Owner(declarators[0])!.Id.Should().Be("Shop.Core.Outer");
        index.Owner(declarators[1])!.Id.Should().Be("Shop.Core.Inner");
        index.OwnNodes(outer).OfType<VariableDeclaratorSyntax>().Should().ContainSingle();
    }
}
