# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-001
Feature: Feature 013 is strictly additive and keeps every quality gate
  As a maintainer
  I want this feature to change no locked artifact and to relax no gate
  So that the previous features stay protected

  @TS-033 @FR-022 @SC-005 @P1 @validation
  Scenario: No locked artifact or existing test of features 001 to 012 changed
    When the product is compared with the closing commit of feature 012
    Then no ".feature" file, "context.json" or specification file of features 001 to 012 was modified or deleted
    And no existing step definition or test source file was modified or deleted
    And Compose and the engine sources are unchanged

  @TS-034 @FR-022 @SC-005 @P1 @validation @slow
  Scenario: The engine MCP tools are unchanged
    Given the engine archive of the build
    When the engine MCP server lists its tools
    Then they are exactly the tools of the engine before feature 013
