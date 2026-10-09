# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-008
Feature: Analysis history and comparison
  As an architect
  I want to list previous analyses, reopen one and compare two
  So that I can measure the progress of the modernization

  @TS-041 @FR-036 @FR-043 @P2 @acceptance
  Scenario: The server lists the analyses newest first with their technology and without server paths
    Given the web runs with the stub engine
    And two completed analyses of the stub engine created one after the other
    When the client lists the analyses
    Then the response lists both analyses, the most recent first
    And each completed analysis declares its technology
    And the response contains no absolute server path

  @TS-042 @FR-043 @P2 @validation
  Scenario Outline: The new operations require the API token when one is configured
    Given the web runs with the stub engine and the API token "s3cret-token"
    When the client calls "<operation>" without a token
    Then the response status is 401 with the error code "UNAUTHORIZED"

    Examples:
      | operation                         |
      | GET /api/analyses                 |
      | GET /api/inference/defaults       |
      | POST /api/analyses/{id}/reinfer   |
      | POST /api/analyses/{id}/score     |

  @TS-043 @FR-038 @P2 @acceptance
  Scenario: Two analyses are compared by totals, differences and exclusive components
    Given the analysis output fixtures "java-standar" and "dotnet-ecommerce"
    When the two analyses are compared
    Then the comparison shows for each analysis its components, lines of code, dependencies, proposals per viability and code issues per severity
    And each difference equals the second total minus the first
    And the components present only in each analysis are listed in alphabetical order

  @TS-044 @FR-038 @P2 @validation
  Scenario: Only completed analyses can be compared
    Given history entries with the states "completed", "failed", "running" and "queued"
    Then only the "completed" entry can be selected for comparison

  @TS-045 @FR-036 @FR-037 @FR-038 @P2 @acceptance @e2e @slow
  Scenario: The user reopens a previous analysis from the history and compares two analyses
    Given the product is built with the .NET analyzer staged next to the engine
    And the web is running
    And a browser session is open on the web
    When the user uploads the ZIP of the demo project "java-standar" and the analysis completes
    And the user uploads the ZIP of the demo project "dotnet-ecommerce" and the analysis completes
    And the user opens the history
    Then the history lists both analyses, the most recent first, each with its technology
    When the user opens the "java-standar" analysis from the history
    Then the page shows the results of that analysis and keeps it as the active analysis
    When the user compares the two analyses from the history
    Then the comparison shows the totals of both analyses and the components present only in each one
