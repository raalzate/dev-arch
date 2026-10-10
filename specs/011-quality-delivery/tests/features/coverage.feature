# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-003
Feature: Coverage reported for Java, .NET and TypeScript
  As a maintainer
  I want a machine-readable coverage report for every stack, locally and in CI
  So that I know which code is untested

  @TS-011 @FR-011 @P1 @contract
  Scenario: The engine verification produces a Java line and branch coverage report
    Given the engine build definition
    Then a coverage agent is prepared for the engine tests
    And a coverage report in XML and HTML is produced in the verify phase

  @TS-012 @FR-012 @P1 @contract
  Scenario: The .NET analyzer tests can produce a coverage report
    Given the .NET analyzer test project
    Then it references a coverage collector
    And the product test script runs the .NET analyzer tests collecting coverage excluding the category "Corpus"

  @TS-013 @FR-013 @FR-018 @SC-004 @P1 @acceptance
  Scenario: The web unit tests produce a coverage report covering every target module
    When the web unit tests are executed with coverage
    Then it exits with code 0
    And a machine-readable web coverage report and a per-file summary exist
    And every non-visual server, API route and utility module of the web appears in the summary
    And the aggregate line coverage of those modules is at least 85 percent

  @TS-014 @FR-018 @P1 @validation
  Scenario: The web coverage check fails when a target module is missing or under the threshold
    Given a web coverage summary where a target module was never loaded
    When the web coverage check evaluates it
    Then it fails naming the missing module
    Given a web coverage summary with an aggregate line coverage of 70 percent
    When the web coverage check evaluates it
    Then it fails naming the threshold of 85 percent

  @TS-015 @FR-014 @SC-003 @P1 @acceptance
  Scenario: The product coverage summary prints one line per stack
    Given coverage reports of the Java engine, the .NET analyzer and the web
    When the product coverage summary is executed
    Then it exits with code 0
    And it prints a line with the line coverage percentage and the report path for "java", "dotnet" and "web"
    Given the .NET analyzer coverage report is missing
    When the product coverage summary is executed
    Then it exits with a non-zero code
    And it prints "[coverage] dotnet: MISSING"

  @TS-016 @FR-014 @P1 @contract
  Scenario: The product offers a coverage command
    Given the product Makefile
    Then it declares a "coverage" target that runs the three coverage reports and the summary

  @TS-017 @FR-015 @SC-003 @P1 @contract
  Scenario Outline: CI publishes the coverage report of each stack
    Given the product continuous integration definition
    Then the job "<job>" uploads an artifact named "<artifact>" containing "<report>"

    Examples:
      | job           | artifact               | report                         |
      | engine-java   | engine-java-coverage   | engine/target/site/jacoco      |
      | engine-dotnet | engine-dotnet-coverage | engine/target/coverage/dotnet  |
      | web           | web-coverage           | web/coverage                   |

  @TS-018 @FR-016 @US-004 @P2 @contract
  Scenario: Every API route module has unit tests with a success and an error case
    Given the API route modules of the web
    Then each route module is imported by a web unit test
    And the unit tests of each route module assert a success status and an error status

  @TS-019 @FR-017 @US-004 @P2 @acceptance
  Scenario: The engine client unit tests cover start, success, tool error, crash and timeout
    When the engine client unit tests are executed
    Then they pass
    And they include cases for the engine start, a successful response, a tool error, a process crash and a timeout
