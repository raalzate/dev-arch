# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-1 @US-2 @P1 @engine
Feature: Reference assemblies configuration, forwarding, Windows runner and documentation

  @TS-010 @FR-001 @acceptance
  Scenario: The path is forwarded to the .NET analyzer as an absolute path
    Given a copy of the demo project "dotnet-ecommerce"
    When it is analyzed in command-line mode with the configuration:
      """
      { "analysis": { "referenceAssemblies": "refs/net48" } }
      """
    Then the .NET analyzer was invoked with the arguments "<project>" and "--config=<file>"
    And that configuration file contained the section "analysis" with "referenceAssemblies" equal to an absolute path ending with "refs/net48"
    And that configuration file no longer exists after the analysis

  @TS-011 @FR-001 @validation
  Scenario: A non-string value is rejected
    When the engine loads the configuration:
      """
      { "analysis": { "referenceAssemblies": 5 } }
      """
    Then the configuration is rejected naming the parameter "analysis.referenceAssemblies"

  @TS-012 @FR-020 @SC-002 @acceptance
  Scenario Outline: Demo projects keep their baseline outputs without configuration
    Given a copy of the demo project "<demo>"
    When it is analyzed in command-line mode
    Then the output documents are byte-identical to the versioned baseline of "<demo>"

    Examples:
      | demo             |
      | java-standar     |
      | dotnet-ecommerce |

  @TS-013 @FR-030 @FR-040 @acceptance
  Scenario: The manual Windows runner and the documentation exist
    Then the product document ".github/workflows/windows-fidelity.yml" mentions each of:
      | text                 |
      | workflow_dispatch    |
      | windows-latest       |
      | dotnet test          |
    And the product document "engine/CONFIGURATION.md" mentions each of:
      | text                          |
      | analysis.referenceAssemblies  |
    And the product document "docs/VB-LEGACY.md" mentions each of:
      | text                          |
      | referenceAssemblies           |
      | windows-fidelity.yml          |
