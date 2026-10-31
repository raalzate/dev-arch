# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-2 @P1
Feature: Component details drawer navigation history
  As an analyst
  I want to walk from a component to its callers and back inside the details panel
  So that exploring coupling does not lose my place

  @TS-001 @FR-002 @validation
  Scenario: Navigating pushes the previous component and back pops it
    Given an empty drawer history at "A"
    When the drawer navigates to "B"
    And the drawer navigates to "C"
    Then the drawer shows "C" with history "A, B"
    When the drawer goes back
    Then the drawer shows "B" with history "A"
    When the drawer goes back
    Then the drawer shows "A" with history ""
    When the drawer goes back
    Then the drawer shows "A" with history ""

  @TS-002 @FR-002 @validation
  Scenario: Navigating to the current component is a no-op and the history is capped at 20
    Given an empty drawer history at "A"
    When the drawer navigates to "A"
    Then the drawer shows "A" with history ""
    When the drawer navigates through 25 distinct components
    Then the history length is 20
