# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify
@US-002
Feature: Quality guards stay intact
  As a maintainer
  I want this feature to be strictly additive
  So that no locked artifact or quality gate of the previous features is weakened

  @TS-032 @FR-031 @SC-008 @P1 @contract
  Scenario: Engine static quality gates are not relaxed
    Given the product continuous integration definition
    When the engine jobs are inspected
    Then static analysis runs with the SpotBugs exclude filter
    And Checkstyle runs with a maximum of 4763 allowed violations
    And the .NET format verification runs without tolerating failure
    When the jobs are inspected
    Then every area job declares a timeout of at most 20 minutes

  @TS-033 @FR-007 @FR-031 @SC-008 @P1 @validation
  Scenario: No locked artifact or existing test of features 001 to 010 changed
    When the product at the closing commit "b64722a15602" of feature 011 is compared with the delivery commit "69c3f8e192ac" of feature 010
    Then no ".feature" file, "context.json" or specification file of features 001 to 010 was modified or deleted
    And no existing test source file was modified or deleted
    And every assertion integrity hash of features 001 to 010 verifies

  @TS-034 @FR-032 @P3 @validation
  Scenario: The BUG-007 investigation is recorded
    Given the research of this feature
    Then it has a section about "BUG-007" with the findings and the next step
