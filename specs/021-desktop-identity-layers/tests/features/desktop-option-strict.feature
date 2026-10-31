# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-3 @P2
Feature: Option Strict Off declared at project level
  As an architect
  I want a project compiled with Option Strict Off reflected on each of its components
  So that relaxed typing is not hidden when the files do not declare it

  @TS-030 @FR-020 @acceptance
  Scenario: Every component of a project with Option Strict Off reports the project issue
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
      <Project xmlns="http://schemas.microsoft.com/developer/msbuild/2003"><PropertyGroup><RootNamespace></RootNamespace><AssemblyName>Sample</AssemblyName><OptionStrict>Off</OptionStrict></PropertyGroup></Project>
      """
    When the project is analyzed
    Then the component "Sample.First" has a code issue "PROJECT_OPTION_STRICT_OFF" with severity "WARNING" and message "The project 'Sample.vbproj' compiles with Option Strict Off. Enable Option Strict On in the project."
    And the component "Sample.Second" has exactly 1 code issue "PROJECT_OPTION_STRICT_OFF"

  @TS-031 @FR-020 @acceptance
  Scenario: File and project declarations are both reported
    Given a VB legacy project with the file "Loose.vb":
      """
      Option Strict Off

      Namespace Sample
          Public Class Loose
          End Class
      End Namespace
      """
    And the project file "Sample.vbproj":
      """
      <Project xmlns="http://schemas.microsoft.com/developer/msbuild/2003"><PropertyGroup><RootNamespace></RootNamespace><AssemblyName>Sample</AssemblyName><OptionStrict>Off</OptionStrict></PropertyGroup></Project>
      """
    When the project is analyzed
    Then the component "Sample.Loose" has exactly 1 code issue "OPTION_STRICT_OFF"
    And the component "Sample.Loose" has exactly 1 code issue "PROJECT_OPTION_STRICT_OFF"

  @TS-032 @FR-020 @acceptance
  Scenario Outline: Option Strict On or absent produces no project issue
    Given a VB legacy project with the file "Strict.vb":
      """
      Namespace Sample
          Public Class Strict
          End Class
      End Namespace
      """
    And the project file "Sample.vbproj":
      """
      <Project xmlns="http://schemas.microsoft.com/developer/msbuild/2003"><PropertyGroup><RootNamespace></RootNamespace><AssemblyName>Sample</AssemblyName><property></PropertyGroup></Project>
      """
    When the project is analyzed
    Then the component "Sample.Strict" has no code issue "PROJECT_OPTION_STRICT_OFF"

    Examples:
      | property                            |
      | <OptionStrict>On</OptionStrict>     |
      |                                     |
