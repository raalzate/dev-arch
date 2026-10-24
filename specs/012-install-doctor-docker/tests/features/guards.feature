# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-001
Feature: Feature 012 is strictly additive and keeps every quality gate
  As a maintainer
  I want this feature to change no locked artifact and to relax no gate
  So that the previous features stay protected

  @TS-036 @FR-027 @SC-006 @P1 @validation
  Scenario: No locked artifact or existing test of features 001 to 011 changed
    When the product at the closing commit "b5cec37b9b24" of feature 012 is compared with the closing commit "b64722a15602" of feature 011
    Then no ".feature" file, "context.json" or specification file of features 001 to 011 was modified or deleted
    And no existing step definition or test source file was modified or deleted
    And the product root entries and the workspaces are unchanged

  @TS-037 @FR-027 @SC-006 @P1 @validation @slow
  Scenario: Engine static gates hold at the current baseline
    When the engine static analysis is run
    Then Checkstyle reports at most 4589 violations
    And SpotBugs reports no bug
