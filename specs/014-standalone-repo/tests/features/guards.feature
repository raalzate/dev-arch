# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-003
Feature: Feature 014 only re-testifies the location-dependent scenarios
  As a maintainer
  I want every other locked scenario and hash untouched
  So that the previous features stay protected after the move

  @TS-009 @FR-004 @FR-005 @SC-004 @US-003 @P1 @validation
  Scenario: Only the approved scenarios were re-testified
    When the product is compared with the closing commit of feature 013
    Then the only modified ".feature" files are the re-testified ones of features 006, 007, 011, 012 and 013
    And every assertion integrity hash of features 001 to 014 verifies

  @TS-010 @FR-004 @US-003 @P1 @validation
  Scenario: The additive guards of earlier features compare their own range
    Given the guard scenarios of features 007, 011, 012 and 013
    Then each compares the closing commit of its feature with the base of its feature
    And every commit they reference exists in this repository
