using DotNetAnalyzer.Analysis.Vb;
using FluentAssertions;
using Xunit;

namespace DotNetAnalyzer.Tests.Analysis.Vb;

[Trait("Category", "VbLegacy")]
public sealed class AppConfigParserTests : IDisposable
{
    private readonly DirectoryInfo _dir = Directory.CreateTempSubdirectory("vb009-config-");

    public void Dispose() => _dir.Delete(recursive: true);

    private void Write(string name, string content) => File.WriteAllText(Path.Combine(_dir.FullName, name), content);

    [Fact]
    public void Reads_connection_strings_app_settings_and_typed_settings()
    {
        Write("app.config", """
            <?xml version="1.0" encoding="utf-8"?>
            <configuration>
              <connectionStrings><add name="Main" connectionString="Server=x;Password=p" /></connectionStrings>
              <appSettings><add key="PageSize" value="25" /></appSettings>
              <applicationSettings><App.My.MySettings>
                <setting name="ReportsPath" serializeAs="String"><value>C:\Reports</value></setting>
              </App.My.MySettings></applicationSettings>
              <userSettings><App.My.MySettings>
                <setting name="LastUser" serializeAs="String"><value>someone</value></setting>
              </App.My.MySettings></userSettings>
            </configuration>
            """);

        var config = AppConfigParser.Load(_dir.FullName);

        config.Files.Should().Equal("app.config");
        config.ConnectionStrings.Should().ContainKey("main");
        config.Settings.Keys.Should().BeEquivalentTo("PageSize", "ReportsPath", "LastUser");
        config.SettingFiles["ReportsPath"].Should().Be("app.config");
        config.Diagnostics.Should().BeEmpty();
    }

    [Fact]
    public void First_file_in_ordinal_order_wins()
    {
        Write("Web.config", "<configuration><appSettings><add key=\"K\" value=\"web\" /></appSettings></configuration>");
        Write("app.config", "<configuration><appSettings><add key=\"K\" value=\"app\" /></appSettings></configuration>");

        var config = AppConfigParser.Load(_dir.FullName);

        config.Files.Should().Equal("Web.config", "app.config");
        config.Settings["K"].Should().Be("web");
        config.SettingFiles["K"].Should().Be("Web.config");
    }

    [Fact]
    public void Malformed_and_DTD_files_produce_a_diagnostic_naming_the_file()
    {
        Write("app.config", "<?xml version=\"1.0\"?><!DOCTYPE c [<!ENTITY e \"v\">]><configuration>&e;</configuration>");
        Write("web.config", "<configuration><appSettings>");

        var config = AppConfigParser.Load(_dir.FullName);

        config.Files.Should().BeEmpty();
        config.Diagnostics.Should().HaveCount(2);
        config.Diagnostics.Should().Contain(d => d.Contains("'app.config'", StringComparison.Ordinal));
        config.Diagnostics.Should().Contain(d => d.Contains("'web.config'", StringComparison.Ordinal));
    }

    [Theory]
    [InlineData("Server=x;User Id=u;Password=secret", true)]
    [InlineData("Server=x;PWD=secret", true)]
    [InlineData("Server=x;Password=", false)]
    [InlineData("Server=x;Integrated Security=SSPI", false)]
    public void Connection_strings_with_a_password_are_plaintext_credentials(string value, bool expected)
    {
        AppConfigParser.HasPlaintextPassword(value).Should().Be(expected);
    }

    [Theory]
    [InlineData("ServiceApiKey", "k", true)]
    [InlineData("SmtpPassword", "p", true)]
    [InlineData("PartnerToken", "t", true)]
    [InlineData("SmtpPassword", " ", false)]
    [InlineData("PageSize", "25", false)]
    [InlineData("ArchiveConnectionString", "Server=x;Trusted_Connection=True", false)]
    [InlineData("ArchiveConnectionString", "Server=x;Pwd=p", true)]
    public void Settings_with_secret_names_are_plaintext_credentials(string key, string value, bool expected)
    {
        AppConfigParser.IsPlaintextSetting(key, value).Should().Be(expected);
    }
}
