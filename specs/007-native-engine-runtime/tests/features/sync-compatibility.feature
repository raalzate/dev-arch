# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-008
Feature: Existing synchronous analysis clients keep working
  As a client of the synchronous analysis interface delivered in feature 006
  I want the same request to keep returning the same response
  So that existing scripts and acceptance scenarios do not break while analyses stop interfering

  @TS-073 @FR-033 @P3 @contract
  Scenario: The synchronous interface keeps its request, response and engine invocation
    Given a fake Java runtime that records its arguments and writes the result documents in its working directory
    When a ZIP is posted to the synchronous analysis interface
    Then the response status is 200 with the components data and the architecture data
    And the engine received exactly the arguments "-jar", the engine archive, the project root and "output.json"
    And the response declares the interface as deprecated with a link to its successor

  @TS-074 @FR-033 @FR-008 @P3 @validation
  Scenario: Concurrent synchronous requests do not interfere
    Given a fake Java runtime that writes result documents naming the project it received
    When two ZIPs of different projects are posted to the synchronous analysis interface at the same time
    Then each response contains only the data of its own project
    And the server working directory contains no "output.json" or "output_architecture.json"

  @TS-075 @FR-033 @P3 @acceptance @e2e @slow
  Scenario: The web interface uses the asynchronous flow
    Given the product is built
    And the web is running
    And a browser session is open on the web
    When the user uploads the ZIP of the demo project "java-standar" and the analysis completes
    Then the page sent its upload to the asynchronous analyses interface
    And the page made no request to the synchronous analysis interface

  @TS-076 @FR-027 @SC-012 @P1 @validation
  Scenario: Locked artifacts of features 001 to 006 are unchanged
    When the product is compared with the 006 baseline tag "dev-arch-006-baseline"
    Then no ".feature" file, "context.json" assertion hash or test assertion of features 001 to 006 has changed

  @TS-077 @FR-028 @SC-012 @P1 @contract
  Scenario: Engine static quality gates are not relaxed
    Given the product continuous integration definition
    When the engine jobs are inspected
    Then static analysis runs with the SpotBugs exclude filter
    And Checkstyle runs with a maximum of 4763 allowed violations
    And the .NET format verification runs without tolerating failure
