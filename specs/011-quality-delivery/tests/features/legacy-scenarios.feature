# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-002
Feature: Legacy scenarios of 001 to 003 run in the engine verification
  As a maintainer
  I want every locked scenario of 001, 002 and 003 executed against the real engine
  So that their acceptance criteria are living tests

  @TS-006 @FR-006 @FR-007 @P1 @contract
  Scenario: Every legacy feature folder is selected by its own engine runner
    Given the engine test sources
    Then a Cucumber runner selects the features folder of "001-mcp-server-local" with its own glue package
    And a Cucumber runner selects the features folder of "002-dotnet-roslyn-analyzer" with its own glue package
    And a Cucumber runner selects the features folder of "003-dotnet-code-issues" with its own glue package
    And those glue packages contain only files added after feature 010

  @TS-007 @FR-008 @SC-002 @P1 @acceptance
  Scenario: No legacy scenario is undefined, pending or ambiguous
    When the legacy engine runners are executed in dry-run mode
    Then every scenario of "001-mcp-server-local", "002-dotnet-roslyn-analyzer" and "003-dotnet-code-issues" is reported
    And no step is undefined, pending or ambiguous

  @TS-008 @FR-006 @FR-009 @SC-002 @P1 @acceptance @slow
  Scenario: With the .NET analyzer available every legacy scenario passes and none is skipped
    Given the .NET analyzer of the engine is available
    When the legacy engine runners are executed
    Then every scenario of "001-mcp-server-local", "002-dotnet-roslyn-analyzer" and "003-dotnet-code-issues" passed
    And no scenario is skipped

  @TS-009 @FR-009 @P1 @acceptance @slow
  Scenario: Without the .NET analyzer the scenarios that need it are skipped with an explicit reason
    When the legacy engine runners are executed with the .NET analyzer reported absent
    Then every scenario that needs the .NET analyzer is skipped with a reason starting with "requires-dotnet"
    And every other legacy scenario passed

  @TS-010 @FR-010 @P1 @contract
  Scenario: The Java engine CI job prepares the .NET analyzer before the engine verification
    Given the product continuous integration definition
    Then the job "engine-java" sets up .NET 8
    And the job "engine-java" publishes the .NET analyzer before it runs the engine verification
