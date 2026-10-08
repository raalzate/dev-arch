# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-001
Feature: Asynchronous analysis of an uploaded project
  As a dev-arch user
  I want my upload to be registered immediately and to follow its phases
  So that long analyses never block the request and I can see components and proposals at the end

  @TS-001 @FR-001 @SC-004 @P1 @acceptance
  Scenario: Submitting a ZIP registers the analysis before it runs
    Given the web server is running with a stub engine that takes 30 seconds per analysis
    When the ZIP of the demo project "java-standar" is submitted for analysis
    Then the response arrives within 2 seconds with status 202
    And the response contains a job identifier in UUID format
    And the status of that analysis is "queued" or "running"

  @TS-002 @FR-002 @FR-023 @P1 @acceptance
  Scenario: The analysis status reports the phases in order
    Given the web server is running with a stub engine that reports the phases "detection, extraction, inference, writing"
    When an analysis is submitted and its status is polled until it finishes
    Then every observed phase belongs to "detection, extraction, inference, writing" and the phases never go backwards
    And the final status is "completed" with creation, start and finish timestamps
    And the final status lists the warnings reported by the engine

  @TS-003 @FR-003 @P1 @acceptance @slow
  Scenario: A completed Java analysis exposes its three documents separately
    Given the product is built
    And the web is running
    When the ZIP of the demo project "java-standar" is submitted and the analysis completes
    Then the "graph", "architecture" and "contracts" documents are each retrievable on their own
    And each document declares the contract version "1.0.0" and validates against the data contract
    And the graph has at least one component and the architecture at least one proposal

  @TS-004 @FR-003 @P1 @acceptance @slow
  Scenario: A completed .NET analysis exposes its documents when the .NET SDK is available
    Given the product is built with the .NET analyzer staged next to the engine
    And the web is running
    When the ZIP of the demo project "dotnet-ecommerce" is submitted and the analysis completes
    Then the graph declares a .NET source
    And the architecture has at least one proposal

  @TS-005 @FR-004 @P1 @contract
  Scenario: Results of an analysis that is still running are not ready
    Given an analysis that is still running
    When its "architecture" document is requested
    Then the response status is 409 with error code "NOT_READY"
    And the response reports the current status and phase

  @TS-006 @FR-004 @P1 @contract
  Scenario: Results of a failed analysis report the failure
    Given an analysis that failed with error code "ENGINE_ERROR"
    When its "graph" document is requested
    Then the response status is 409 with error code "ANALYSIS_FAILED"
    And the response includes the failure reason

  @TS-007 @FR-004 @P1 @contract
  Scenario Outline: Unknown or malformed analysis identifiers do not exist
    When the "<resource>" of the analysis "<id>" is requested
    Then the response status is 404 with error code "NOT_FOUND"

    Examples:
      | resource     | id                                   |
      | status       | 00000000-0000-4000-8000-000000000000 |
      | graph        | 00000000-0000-4000-8000-000000000000 |
      | status       | not-a-uuid                           |
      | architecture | ..%2F..%2Fetc                        |

  @TS-008 @FR-006 @P1 @acceptance @slow
  Scenario: An ambiguous project without a language choice fails asking for the language
    Given the product is built
    And the web is running
    When a ZIP containing both "pom.xml" and "App.csproj" markers is submitted without a language
    Then the analysis ends with status "failed" and error code "AMBIGUOUS_PROJECT"
    And the failure message mentions "language"

  @TS-009 @FR-006 @P1 @acceptance @slow
  Scenario Outline: An ambiguous project is analyzed with the chosen language
    Given the product is built with the .NET analyzer staged next to the engine
    And the web is running
    When a ZIP containing both "pom.xml" and "App.csproj" markers is submitted with the language "<language>"
    Then the analysis ends with status "completed"
    And the graph declares a "<source>" source

    Examples:
      | language | source |
      | java     | Java   |
      | dotnet   | .NET   |

  @TS-010 @FR-006 @P1 @contract
  Scenario: An unrecognized language is rejected
    Given the web server is running with a stub engine
    When a ZIP is submitted with the language "cobol"
    Then the response status is 400 with error code "INVALID_LANGUAGE"
    And no analysis area is created

  @TS-011 @FR-032 @P1 @acceptance
  Scenario: Submitting without a built engine explains how to build it
    Given the staged engine archive does not exist
    And no engine path override is configured
    When a ZIP is submitted for analysis
    Then the response status is 500 with error code "ENGINE_NOT_BUILT"
    And the error message names "Engine not built", the engine path that was tried and "make build"

  @TS-012 @FR-005 @P2 @validation
  Scenario Outline: Local folder analysis is only allowed in development mode
    Given the web server runs with local folder analysis "<mode>"
    When an analysis of the local folder of the demo project "java-standar" is requested
    Then the response status is <status>

    Examples:
      | mode     | status |
      | enabled  | 202    |
      | disabled | 403    |

  @TS-013 @FR-007 @SC-003 @P1 @acceptance @e2e @slow
  Scenario: Upload a Java ZIP in the browser and see proposals
    Given the product is built
    And the web is running
    And a browser session is open on the web
    When the user uploads the ZIP of the demo project "java-standar"
    Then the page shows the analysis phase while it runs
    And within 2 minutes of the upload the page shows at least one component and at least one proposal

  @TS-014 @FR-007 @SC-003 @P1 @acceptance @e2e @slow
  Scenario: Upload a .NET ZIP in the browser and see proposals
    Given the product is built with the .NET analyzer staged next to the engine
    And the web is running
    And a browser session is open on the web
    When the user uploads the ZIP of the demo project "dotnet-ecommerce"
    Then within 2 minutes of the upload the page shows at least one component and at least one proposal

  @TS-015 @FR-007 @P1 @validation @e2e @slow
  Scenario: The browser keeps only the active analysis identifier
    Given the product is built
    And the web is running
    And a browser session is open on the web
    When the user uploads the ZIP of the demo project "java-standar" and the analysis completes
    Then the browser storage holds the active analysis identifier
    And the browser storage holds no analysis results
