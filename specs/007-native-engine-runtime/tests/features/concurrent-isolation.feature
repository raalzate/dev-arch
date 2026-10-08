# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-002
Feature: Concurrent analyses are isolated and survive reloads
  As a dev-arch user, possibly alongside other users
  I want each analysis to get exactly its own results and to outlive a browser reload or a server restart
  So that results are never mixed and never lost

  @TS-016 @FR-008 @FR-010 @SC-001 @P1 @acceptance @e2e @slow
  Scenario: Two browser sessions analyze different projects at the same time
    Given the product is built with the .NET analyzer staged next to the engine
    And the web is running
    And two independent browser sessions are open on the web
    When the first session uploads "java-standar" and the second uploads "dotnet-ecommerce" at the same time
    Then both analyses complete
    And each session shows only components of its own project

  @TS-017 @FR-010 @P1 @acceptance @slow
  Scenario: Concurrent analyses through the API produce independent results
    Given the product is built with the .NET analyzer staged next to the engine
    And the web is running
    When the ZIPs of "java-standar" and "dotnet-ecommerce" are submitted at the same time
    Then both analyses complete
    And no component of one analysis references a file of the other analysis

  @TS-018 @FR-008 @P1 @validation
  Scenario: No analysis uses fixed-name files in the server working directory
    Given the web server is running with a stub engine
    When two analyses are submitted at the same time and both complete
    Then the server working directory contains no "output.json", "output_architecture.json" or "output_entrypoints.json"
    And each analysis area contains its own three result documents

  @TS-019 @FR-007 @SC-002 @P1 @acceptance @e2e @slow
  Scenario: Reloading the browser during an analysis resumes the same analysis
    Given the product is built
    And the web is running
    And a browser session is open on the web
    When the user uploads the ZIP of the demo project "java-standar"
    And the user reloads the page before the analysis completes
    Then the page follows the same analysis identifier without a new upload
    And the page eventually shows at least one proposal

  @TS-020 @FR-009 @P1 @acceptance
  Scenario: Completed analyses survive a web server restart
    Given the web server is running with a stub engine
    And an analysis has completed
    When the web server restarts with the same data directory
    Then the status of that analysis is "completed"
    And its "graph", "architecture" and "contracts" documents are still retrievable

  @TS-021 @FR-009 @P1 @acceptance
  Scenario: Analyses that were active at a restart become interrupted
    Given the web server is running with a stub engine that takes 30 seconds per analysis
    And one analysis is running and another is queued
    When the web server restarts with the same data directory
    Then both analyses have status "failed" with error code "INTERRUPTED"

  @TS-022 @FR-010 @P2 @validation
  Scenario: Analyses of the same local folder are serialized
    Given the web server runs with local folder analysis "enabled" and a stub engine that records its call intervals
    When two analyses of the same local folder are requested at the same time
    Then the engine calls for that folder do not overlap in time
    And both analyses complete with identical documents
