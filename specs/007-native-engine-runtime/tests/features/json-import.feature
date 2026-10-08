# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-005
Feature: Import existing results validated against the data contract
  As a user who already has engine outputs
  I want to import them without re-analyzing
  So that I can explore them, and learn exactly what is wrong when they break the contract

  @TS-040 @FR-020 @FR-022 @SC-010 @P2 @acceptance
  Scenario Outline: Valid contract outputs are imported as a completed analysis
    Given the web server is running with a stub engine
    When the outputs of the contract fixture "<fixture>" are imported with entrypoints "<entrypoints>"
    Then the response status is 201 with a job identifier
    And the status of that analysis is "completed" with origin "import"
    And its "graph" and "architecture" documents equal the imported ones
    And the stub engine was not called

    Examples:
      | fixture          | entrypoints |
      | java-standar     | included    |
      | dotnet-ecommerce | omitted     |

  @TS-041 @FR-021 @SC-010 @P2 @contract
  Scenario: Every invalid contract fixture is rejected naming the offending fields
    Given the web server is running with a stub engine
    When each document of the contract fixtures under "schema/fixtures/invalid" is imported in its document slot
    Then every import is rejected with status 422 and error code "SCHEMA_VIOLATION"
    And every rejection lists at least one violation with its document, field pointer and reason
    And no analysis was created

  @TS-042 @FR-021 @P2 @contract
  Scenario: An unsupported contract version is rejected with found and supported versions
    Given the web server is running with a stub engine
    When the outputs of the contract fixture "java-standar" are imported with the graph contract version changed to "2.0.0"
    Then the response status is 422 with error code "UNSUPPORTED_SCHEMA_VERSION"
    And the error reports the found version "2.0.0" and the supported version "1.0.0"

  @TS-043 @FR-020 @P2 @contract
  Scenario Outline: An import without a mandatory document is rejected
    Given the web server is running with a stub engine
    When the outputs of the contract fixture "java-standar" are imported without the "<document>"
    Then the response status is 400 with error code "MISSING_DOCUMENT"
    And the error names the document "<document>"

    Examples:
      | document     |
      | graph        |
      | architecture |

  @TS-044 @FR-020 @P2 @validation
  Scenario: An import above the upload limit is rejected
    Given the web server is running with an upload limit of 1 MB
    When an import body of 2 MB is submitted
    Then the response status is 413 with error code "UPLOAD_TOO_LARGE"

  @TS-045 @FR-022 @P2 @contract
  Scenario: An imported analysis has no sources to view
    Given the web server is running with a stub engine
    And an imported analysis of the contract fixture "java-standar"
    When the source "src/App.java" of that analysis is requested
    Then the response status is 409 with error code "NO_SOURCES"

  @TS-046 @FR-022 @FR-012 @P2 @acceptance
  Scenario: Imported analyses expire like any other analysis
    Given the web server is running with a retention of 1 hour and a controllable clock
    And an imported analysis created 2 hours ago
    When the periodic cleanup runs
    Then requesting its status answers 404 with error code "NOT_FOUND"

  @TS-047 @FR-020 @P2 @acceptance @e2e @slow
  Scenario: The user imports results in the browser and explores them
    Given the product is built
    And the web is running
    And a browser session is open on the web
    When the user imports the outputs of the contract fixture "java-standar"
    Then the page shows at least one component and at least one proposal
