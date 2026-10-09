# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-002
Feature: Five-step modernization flow with a sober technical look
  As an architect
  I want to walk the results in the order I take the modernization decision, in light or dark mode
  So that each screen answers one concrete question

  @TS-011 @FR-008 @FR-010 @P1 @acceptance @e2e @slow
  Scenario: The steps are offered in order, start at the summary and are reachable with the keyboard
    Given the product is built
    And the web is running
    And a browser session is open on the web
    When the user uploads the ZIP of the demo project "java-standar" and the analysis completes
    Then the step navigation lists "summary", "map", "proposals", "findings" and "plan" in this order
    And the step "summary" is marked as the current step
    And the user can activate each step using only the keyboard, and each activated step is shown and marked as current

  @TS-012 @FR-009 @P1 @acceptance @e2e @slow
  Scenario: The summary presents technology, size, legacy health, candidates, risky components and warnings
    Given the product is built
    And the web is running
    And a browser session is open on the web
    When the user uploads a ZIP of the demo project "java-standar" with an extra Java file that cannot be parsed
    And the analysis completes
    Then the summary shows the technology badge, the component count, the lines of code and the dependency count of the analysis
    And the summary shows the number of code issues of each severity present in the analysis
    And the summary shows between 1 and 3 candidate proposals and between 1 and 8 risky components
    And the summary shows the analysis warnings

  @TS-013 @FR-011 @P1 @acceptance @e2e @slow
  Scenario: While an analysis runs the page shows its real phase and elapsed time and no partial results
    Given the product is built
    And the web is running
    And a browser session is open on the web
    When the user uploads the ZIP of the demo project "java-standar"
    Then while the analysis is running the page shows the current phase marked within the four phases and an elapsed time
    And no step of the results is shown before the analysis completes

  @TS-014 @FR-013 @FR-012 @US-003 @P1 @acceptance @e2e @slow
  Scenario: The chosen theme persists across reloads without storing results
    Given the product is built
    And the web is running
    And a browser session is open on the web
    When the user uploads the ZIP of the demo project "java-standar" and the analysis completes
    And the user switches the theme to dark
    And the user reloads the page
    Then the page is displayed in dark mode
    And the browser storage holds no analysis results

  @TS-015 @FR-013 @US-003 @P1 @acceptance @e2e @slow
  Scenario: Without a saved preference the theme follows the operating system
    Given the product is built
    And the web is running
    And a browser session that prefers a dark color scheme is open on the web
    Then the page is displayed in dark mode

  @TS-016 @FR-014 @FR-015 @FR-016 @SC-007 @US-003 @P1 @acceptance
  Scenario: Severities and technologies have their own labels and colors
    Given the visual vocabulary of the interface
    Then each severity "CRITICAL", "ERROR", "WARNING" and "INFO" has a distinct Spanish label and a distinct color
    And each technology accent "java", "dotnet" and "vb" has a distinct color
    And every severity and accent color reaches a contrast ratio of at least 4.5 against the light and the dark surface
