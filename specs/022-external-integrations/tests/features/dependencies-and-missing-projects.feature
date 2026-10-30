# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-3 @US-4 @P1
Feature: Missing project references, third-party dependencies and end-of-life libraries
  As an architect
  I want the analysis to list the external libraries of each project, flag the end-of-life ones and warn about referenced projects that are missing from the delivery
  So that a partial corpus is not mistaken for a complete system and dependency debt counts in the viability

  @TS-010 @FR-020 @acceptance
  Scenario: Missing project references are warned once and recorded as external dependencies
    Given a VB legacy project directory with the file "Common/Helper.vb":
      """
      Public Class Helper
      End Class
      """
    And the project directory file "Common/Acme.Common.vbproj":
      """
      <Project xmlns="http://schemas.microsoft.com/developer/msbuild/2003"><PropertyGroup><RootNamespace>Acme.Common</RootNamespace><AssemblyName>Acme.Common</AssemblyName></PropertyGroup><ItemGroup><ProjectReference Include="..\Acme.Billing\Acme.Billing.vbproj" /><ProjectReference Include="..\Acme.Audit\Acme.Audit.vbproj" /></ItemGroup></Project>
      """
    When the project is analyzed
    Then the component "Acme.Common.Helper" has exactly the external dependencies "project:Acme.Audit, project:Acme.Billing"
    And the analyzer reports a user warning starting with "Referenced projects not included in the analyzed sources: Acme.Audit, Acme.Billing"
    And no user warning contains an absolute path

  @TS-011 @FR-020 @acceptance
  Scenario: Present project references produce no warning
    Given a VB legacy project directory with the file "Common/Helper.vb":
      """
      Public Class Helper
      End Class
      """
    And the project directory file "Common/Acme.Common.vbproj":
      """
      <Project xmlns="http://schemas.microsoft.com/developer/msbuild/2003"><PropertyGroup><RootNamespace>Acme.Common</RootNamespace><AssemblyName>Acme.Common</AssemblyName></PropertyGroup></Project>
      """
    And the project directory file "Billing/Invoice.vb":
      """
      Public Class Invoice
      End Class
      """
    And the project directory file "Billing/Acme.Billing.vbproj":
      """
      <Project xmlns="http://schemas.microsoft.com/developer/msbuild/2003"><PropertyGroup><RootNamespace>Acme.Billing</RootNamespace><AssemblyName>Acme.Billing</AssemblyName></PropertyGroup><ItemGroup><ProjectReference Include="..\Common\Acme.Common.vbproj" /></ItemGroup></Project>
      """
    When the project is analyzed
    Then the component "Acme.Billing.Invoice" has exactly the external dependencies ""
    And no user warning starts with "Referenced projects"

  @TS-012 @FR-030 @FR-031 @acceptance
  Scenario: Third-party packages and assembly references, with one end-of-life library
    Given a VB legacy project with the file "Types.vb":
      """
      Namespace Sample
          Public Class First
          End Class
          Public Class Second
          End Class
      End Namespace
      """
    And the project file "Sample.vbproj":
      """
      <Project xmlns="http://schemas.microsoft.com/developer/msbuild/2003">
        <PropertyGroup><RootNamespace></RootNamespace><AssemblyName>Sample</AssemblyName></PropertyGroup>
        <ItemGroup>
          <Reference Include="System" />
          <Reference Include="System.Data" />
          <Reference Include="Microsoft.VisualBasic" />
          <Reference Include="DevExpress.Data.v21.2, Version=21.2.5.0, Culture=neutral, PublicKeyToken=b88d1754d700e49a" />
          <Reference Include="Microsoft.Practices.EnterpriseLibrary.Data, Version=3.1.0.0, Culture=neutral" />
          <Reference Include="Newtonsoft.Json" />
        </ItemGroup>
      </Project>
      """
    And the project file "packages.config":
      """
      <?xml version="1.0" encoding="utf-8"?>
      <packages>
        <package id="Newtonsoft.Json" version="13.0.3" targetFramework="net481" />
        <package id="RestSharp" version="106.15.0" targetFramework="net481" />
      </packages>
      """
    When the project is analyzed
    Then the component "Sample.First" has exactly the external dependencies "DevExpress.Data.v21.2, Microsoft.Practices.EnterpriseLibrary.Data, Newtonsoft.Json, RestSharp"
    And the component "Sample.Second" has a code issue "EOL_DEPENDENCY" with severity "WARNING" and message "Dependency 'Microsoft.Practices.EnterpriseLibrary.Data' has reached end of life: Enterprise Library 5 and earlier reached end of life in 2013. Plan its replacement."
    And the component "Sample.Second" has exactly 1 code issue "EOL_DEPENDENCY"
    And the component "Sample.Second" has the annotation "Dependency:eol:Microsoft.Practices.EnterpriseLibrary.Data"
    And the component "Sample.First" has no annotation starting with "Dependency:eol:DevExpress"

  @TS-013 @FR-032 @acceptance
  Scenario: The configuration extends the end-of-life list
    Given a VB legacy project with the file "Types.vb":
      """
      Namespace Sample
          Public Class First
          End Class
      End Namespace
      """
    And the project file "Sample.vbproj":
      """
      <Project xmlns="http://schemas.microsoft.com/developer/msbuild/2003"><PropertyGroup><RootNamespace></RootNamespace><AssemblyName>Sample</AssemblyName></PropertyGroup><ItemGroup><Reference Include="Legacy.Crypto, Version=1.0.0.0" /></ItemGroup></Project>
      """
    When the project is analyzed with the configuration:
      """
      { "dependencies": { "eol": ["Legacy.Crypto"] } }
      """
    Then the component "Sample.First" has a code issue "EOL_DEPENDENCY" with severity "WARNING" and message "Dependency 'Legacy.Crypto' has reached end of life: listed in dependencies.eol. Plan its replacement."

  @TS-014 @FR-033 @acceptance
  Scenario: Setup projects are reported
    Given a VB legacy project with the file "Types.vb":
      """
      Namespace Sample
          Public Class First
          End Class
      End Namespace
      """
    And the project file "Setup/Installer.vdproj":
      """
      "DeployProject" { }
      """
    When the project is analyzed
    Then the analyzer reports a user warning starting with "Setup project(s) without support since Visual Studio 2010: Installer.vdproj"

  @TS-015 @FR-040 @FR-042 @SC-004 @acceptance
  Scenario: Disabled by configuration, off for C# by default, and deterministic
    Given a VB legacy project with the file "Gateway.vb":
      """
      Namespace Sample
          Public Class Gateway
              Inherits System.ServiceModel.ClientBase(Of IPricing)
          End Class
      End Namespace
      """
    And the project file "Sample.vbproj":
      """
      <Project xmlns="http://schemas.microsoft.com/developer/msbuild/2003"><PropertyGroup><RootNamespace></RootNamespace><AssemblyName>Sample</AssemblyName></PropertyGroup><ItemGroup><Reference Include="Microsoft.Practices.EnterpriseLibrary.Data, Version=3.1.0.0" /></ItemGroup></Project>
      """
    When the project is analyzed twice with the configuration:
      """
      { "integrations": { "outbound": "off" }, "dependencies": { "enabled": "off" } }
      """
    Then the component "Sample.Gateway" has no annotation starting with "Integration:"
    And the component "Sample.Gateway" has exactly the external dependencies ""
    And the component "Sample.Gateway" has no code issue "EOL_DEPENDENCY"
    And both serialized outputs are byte-identical
    And the analysis log states that outbound integrations are "off" for "Visual Basic" because of "config"

  @TS-016 @FR-040 @acceptance
  Scenario: C# projects run the passes only when enabled
    Given a C# legacy project with the file "Gateway.cs":
      """
      namespace Sample
      {
          public class Gateway : System.ServiceModel.ClientBase<IPricing> { }
      }
      """
    When the project is analyzed
    Then the component "Sample.Gateway" has no annotation starting with "Integration:"
    And the analysis log states that outbound integrations are "off" for "C#" because of "auto"
