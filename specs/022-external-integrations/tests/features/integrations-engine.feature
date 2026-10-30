# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-4 @P2 @engine
Feature: Integration and dependency configuration through the engine
  As an architect
  I want the integration and dependency passes configurable from the engine
  So that the analysis of a C# legacy project can opt in and outputs stay reproducible

  @TS-020 @FR-040 @validation
  Scenario Outline: Invalid values are rejected by the configuration validation
    When the engine loads the configuration:
      """
      <json>
      """
    Then the configuration is rejected naming the parameter "<parameter>"

    Examples:
      | json                                                 | parameter              |
      | { "integrations": { "outbound": "maybe" } }          | integrations.outbound  |
      | { "dependencies": { "enabled": "sometimes" } }       | dependencies.enabled   |
      | { "dependencies": { "eol": [""] } }                  | dependencies.eol       |
      | { "integrations": { "unknownKey": 1 } }              | integrations.unknownKey |

  @TS-021 @FR-040 @acceptance
  Scenario: The bridge forwards the sections only when they are not the default
    Given a copy of the synthetic VB project "SyntheticProcedures"
    When it is analyzed in command-line mode with the configuration:
      """
      { "dependencies": { "eol": ["Legacy.Crypto"] } }
      """
    Then the .NET analyzer was invoked with the arguments "<project>" and "--config=<file>"
    And that configuration file contained the section "dependencies" with "enabled" equal to "auto"

  @TS-022 @FR-041 @SC-003 @acceptance
  Scenario Outline: Demo projects keep their baseline outputs without configuration
    Given a copy of the demo project "<demo>"
    When it is analyzed in command-line mode
    Then the output documents are byte-identical to the versioned baseline of "<demo>"

    Examples:
      | demo             |
      | java-standar     |
      | dotnet-ecommerce |
