using DotNetAnalyzer.Analysis.Vb;
using FluentAssertions;
using Xunit;

namespace DotNetAnalyzer.Tests.Analysis.Vb;

public class EolCatalogTests
{
    [Fact]
    public void Embedded_list_matches_by_prefix_and_major_version()
    {
        var catalog = EolCatalog.Load(Array.Empty<string>());
        catalog.Rules.Should().NotBeEmpty();
        catalog.Match("Microsoft.Practices.EnterpriseLibrary.Data", "3.1.0.0").Should().NotBeNull();
        catalog.Match("Microsoft.Practices.EnterpriseLibrary.Data", null).Should().NotBeNull("unknown versions match");
        catalog.Match("Microsoft.Practices.EnterpriseLibrary.Data", "6.0.0.0").Should().BeNull("Enterprise Library 6 is not end of life");
        catalog.Match("System.Web.Services", null).Should().NotBeNull();
        catalog.Match("Newtonsoft.Json", "13.0.3").Should().BeNull();
    }

    [Fact]
    public void Configured_prefixes_extend_the_list()
    {
        var catalog = EolCatalog.Load(new[] { "Legacy.Crypto", " " });
        catalog.Match("Legacy.Crypto", "1.0")!.Reason.Should().Be("listed in dependencies.eol");
    }

    [Theory]
    [InlineData("https://user:secret@api.example.invalid:8443/v1?key=abc", "api.example.invalid")]
    [InlineData("net.tcp://ofac.example.invalid:8012/Ofac", "ofac.example.invalid")]
    [InlineData("net.tcp://svc:s3cret@ofac.example.invalid:8012/Ofac?x=1", "ofac.example.invalid")]
    [InlineData("net.pipe://localhost/Pricing", "localhost")]
    [InlineData("http://rates.example.invalid/today", "rates.example.invalid")]
    [InlineData("/relative/path", null)]
    [InlineData("", null)]
    [InlineData("not a url", null)]
    public void Hosts_reduce_addresses_to_their_host(string text, string? host) => Hosts.Of(text).Should().Be(host);
}
