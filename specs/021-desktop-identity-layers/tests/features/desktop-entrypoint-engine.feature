# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-2 @P2 @engine
Feature: Batch entry points and the debt configuration through the engine
  As an architect
  I want a proposal that contains a batch module to declare it as its entry point, and the debt rules to be configurable from the engine
  So that the modernization plan knows where a legacy process starts

  @TS-020 @FR-015 @acceptance
  Scenario: A proposal with a Sub Main module declares an internal batch entry point
    Given a dependency graph with the annotated components:
      | id                       | layer   | annotations                   |
      | Sample.Jobs.NightlyProcess | Negocio | Layer:Batch, EntryPoint:Main |
      | Sample.Jobs.Archiver       | Negocio |                              |
    When the architecture is inferred with the default configuration
    Then the proposal containing "Sample.Jobs.NightlyProcess" has a legacy entry point of type "internal"
    And that entry point names "Sample.Jobs.NightlyProcess" as primary entry class
    And that entry point exposes exactly the operations "Main"
    And that entry point description contains "lotes"

  @TS-021 @FR-015 @acceptance
  Scenario: Without the annotation the entry point is unchanged
    Given a dependency graph with the annotated components:
      | id                   | layer   | annotations |
      | Sample.Jobs.Archiver | Negocio |             |
      | Sample.Jobs.Cleaner  | Negocio |             |
    When the architecture is inferred with the default configuration
    Then the proposal containing "Sample.Jobs.Archiver" has a legacy entry point of type "internal"
    And that entry point has no primary entry class

  @TS-022 @FR-030 @validation
  Scenario Outline: Invalid debt values are rejected by the configuration validation
    When the engine loads the configuration:
      """
      <json>
      """
    Then the configuration is rejected naming the parameter "<parameter>"

    Examples:
      | json                                                  | parameter                    |
      | { "debt": { "enabled": "maybe" } }                    | debt.enabled                 |
      | { "debt": { "godClass": { "minLoc": 0 } } }           | debt.godClass.minLoc         |
      | { "debt": { "godClass": { "minComplexity": -1 } } }   | debt.godClass.minComplexity  |
      | { "debt": { "unknownKey": true } }                    | debt.unknownKey              |

  @TS-023 @FR-030 @acceptance
  Scenario: The bridge forwards the debt section only when it is not the default
    Given a copy of the synthetic VB project "SyntheticProcedures"
    When it is analyzed in command-line mode with the configuration:
      """
      { "debt": { "enabled": "off" } }
      """
    Then the .NET analyzer was invoked with the arguments "<project>" and "--config=<file>"
    And that configuration file contained the section "debt" with "enabled" equal to "off"

  @TS-024 @FR-040 @SC-003 @acceptance
  Scenario Outline: Demo projects keep their baseline outputs without configuration
    Given a copy of the demo project "<demo>"
    When it is analyzed in command-line mode
    Then the output documents are byte-identical to the versioned baseline of "<demo>"

    Examples:
      | demo             |
      | java-standar     |
      | dotnet-ecommerce |
