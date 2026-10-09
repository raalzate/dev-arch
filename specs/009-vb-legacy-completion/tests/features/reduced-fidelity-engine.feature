# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-7 @P2 @engine
Feature: Reduced-fidelity warnings of VB analyses through the engine
  As a user of the product (command line, AI agent or web)
  I want to be warned when a VB legacy project is analyzed with reduced fidelity
  So that I interpret the results correctly

  @TS-090 @FR-061 @FR-062 @SC-006 @acceptance
  Scenario: Server mode exposes the reduced-fidelity warning of a VB project
    Given the engine host cannot load .NET Framework reference assemblies
    And a copy of the synthetic VB project "SyntheticDesktop"
    When it is analyzed in server mode
    Then the tool result metadata lists exactly one warning
    And that warning starts with "VB project 'SyntheticDesktop.vbproj' analyzed with reduced fidelity"
    And that warning mentions "docs/VB-LEGACY.md"
    And the dependency graph written in server mode declares the source "roslyn-fallback"

  @TS-091 @FR-062 @acceptance
  Scenario: Command-line mode prints the warning without changing the output documents
    Given the engine host cannot load .NET Framework reference assemblies
    And a copy of the synthetic VB project "SyntheticDesktop"
    When it is analyzed in server mode
    And it is analyzed in command-line mode
    Then the command error output contains a line starting with "[warning] VB project 'SyntheticDesktop.vbproj' analyzed with reduced fidelity"
    And the command standard output does not contain "[warning]"
    And both modes produce byte-identical output documents

  @TS-092 @FR-063 @SC-006 @acceptance
  Scenario Outline: C# analyses produce no new warnings
    Given a copy of the demo project "<demo>"
    When it is analyzed in server mode
    Then the tool result has no warning metadata

    Examples:
      | demo                |
      | dotnet-ecommerce    |
      | dotnet-unstructured |

  @TS-093 @FR-064 @acceptance
  Scenario: The product documentation describes the reduced-fidelity limitations
    Then the product document "docs/VB-LEGACY.md" mentions each of:
      | text                                |
      | Adhoc                               |
      | roslyn-fallback                     |
      | Visual Studio Build Tools           |
      | Windows                             |
      | .NET Framework                      |
      | static-inference/warnings           |
      | [warning]                           |
      | Option Strict                       |
      | LATE_BINDING                        |
      | app.config                          |
