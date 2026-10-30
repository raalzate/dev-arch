# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-1 @P1
Feature: Complete identity of VB components under reduced fidelity
  As an architect
  I want every VB component to carry its fully qualified name even when the analysis has reduced fidelity
  So that classes with the same simple name in different projects never collide

  @TS-001 @FR-001 @acceptance
  Scenario: The project root namespace qualifies types declared without a Namespace block
    Given a VB legacy project with the file "PolicyForm.vb":
      """
      Public Class PolicyForm
          Public Sub Show()
          End Sub
      End Class
      """
    And the project file "Sample.vbproj":
      """
      <?xml version="1.0" encoding="utf-8"?>
      <Project DefaultTargets="Build" xmlns="http://schemas.microsoft.com/developer/msbuild/2003" ToolsVersion="4.0">
        <PropertyGroup>
          <OutputType>Library</OutputType>
          <RootNamespace>Acme.Policies</RootNamespace>
          <AssemblyName>Sample</AssemblyName>
          <TargetFrameworkVersion>v4.8</TargetFrameworkVersion>
        </PropertyGroup>
      </Project>
      """
    When the project is analyzed
    Then the components are exactly "Acme.Policies.PolicyForm"

  @TS-002 @FR-001 @acceptance
  Scenario: An explicit Namespace block nests under the root namespace
    Given a VB legacy project with the file "PolicyForm.vb":
      """
      Namespace Forms
          Public Class PolicyForm
          End Class
      End Namespace
      """
    And the project file "Sample.vbproj":
      """
      <?xml version="1.0" encoding="utf-8"?>
      <Project DefaultTargets="Build" xmlns="http://schemas.microsoft.com/developer/msbuild/2003" ToolsVersion="4.0">
        <PropertyGroup>
          <OutputType>Library</OutputType>
          <RootNamespace>Acme.Policies</RootNamespace>
          <AssemblyName>Sample</AssemblyName>
        </PropertyGroup>
      </Project>
      """
    When the project is analyzed
    Then the components are exactly "Acme.Policies.Forms.PolicyForm"

  @TS-003 @FR-001 @FR-003 @acceptance
  Scenario: Two nested projects with the same simple class get distinct identities
    Given a VB legacy project directory with the file "Common/Helper.vb":
      """
      Public Class Helper
      End Class
      """
    And the project directory file "Common/Acme.Common.vbproj":
      """
      <Project xmlns="http://schemas.microsoft.com/developer/msbuild/2003"><PropertyGroup><RootNamespace>Acme.Common</RootNamespace><AssemblyName>Acme.Common</AssemblyName></PropertyGroup></Project>
      """
    And the project directory file "Billing/Helper.vb":
      """
      Public Class Helper
          Public Sub Run()
              Dim shared As New Acme.Common.Helper()
          End Sub
      End Class
      """
    And the project directory file "Billing/Acme.Billing.vbproj":
      """
      <Project xmlns="http://schemas.microsoft.com/developer/msbuild/2003"><PropertyGroup><RootNamespace>Acme.Billing</RootNamespace><AssemblyName>Acme.Billing</AssemblyName></PropertyGroup><ItemGroup><ProjectReference Include="..\Common\Acme.Common.vbproj" /></ItemGroup></Project>
      """
    When the project is analyzed
    Then the components are exactly "Acme.Billing.Helper, Acme.Common.Helper"
    And the analysis declares the source "roslyn-fallback"

  @TS-004 @FR-003 @acceptance
  Scenario: Without a root namespace the identities do not change
    Given a VB legacy project with the file "Helper.vb":
      """
      Public Class Helper
      End Class
      """
    When the project is analyzed
    Then the components are exactly "Helper"

  @TS-005 @FR-002 @acceptance
  Scenario: Global project imports resolve framework names under reduced fidelity
    Given a VB legacy project with the file "ContactBase.vb":
      """
      Namespace Sample
          Public Class ContactBase
              Public Property ContactType As Integer
              Protected _permissions As Int64

              Public Sub New(Optional ByVal permissions As Int64 = 0)
                  _permissions = permissions
              End Sub
          End Class

          Public Class ContactCompany
              Inherits ContactBase

              Public Sub New()
                  Me.ContactType = 2
              End Sub
          End Class
      End Namespace
      """
    And the project file "Sample.vbproj":
      """
      <?xml version="1.0" encoding="utf-8"?>
      <Project xmlns="http://schemas.microsoft.com/developer/msbuild/2003">
        <PropertyGroup><RootNamespace></RootNamespace><AssemblyName>Sample</AssemblyName></PropertyGroup>
        <ItemGroup><Import Include="System" /><Import Include="System.Data" /></ItemGroup>
      </Project>
      """
    When the project is analyzed
    Then the analysis log does not contain "late-binding detection skipped"
    And the analysis log does not report an error analyzing the type "Sample.ContactCompany"
