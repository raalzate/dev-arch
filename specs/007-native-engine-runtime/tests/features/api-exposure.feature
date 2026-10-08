# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-009
Feature: API responses without server paths and with an optional access token
  As the operator of a dev-arch instance exposed beyond my machine
  I want responses that never reveal absolute server paths and an optional shared token for the API
  So that analyses cannot be used to map the server or be driven by anyone who reaches it

  @TS-078 @FR-034 @SC-013 @P2 @contract
  Scenario: Status and result documents expose only relative paths
    Given the web server is running with a stub engine
    When a ZIP whose entries are "demo/src/App.java" and "demo/pom.xml" is submitted and the analysis completes
    Then the status reports the project root "demo"
    And every component file in the served graph is "src/App.java" or another path relative to the project root
    And no response about that analysis contains the data directory or the web working directory

  @TS-079 @FR-034 @SC-013 @P2 @acceptance @slow
  Scenario Outline: Real analyses of the demo projects expose no absolute server path
    Given the product is built with the .NET analyzer staged next to the engine
    And the web is running
    When the ZIP of the demo project "<project>" is submitted and the analysis completes
    Then no response about that analysis contains the data directory or the web working directory
    And the "graph", "architecture" and "contracts" documents still validate against the data contract

    Examples:
      | project          |
      | java-standar     |
      | dotnet-ecommerce |

  @TS-080 @FR-034 @P2 @validation
  Scenario: Warnings and failure messages that name analysis files are relativized
    Given the web server is running with a stub engine that reports a warning and then fails naming the absolute path of "src/Broken.java"
    When an analysis is submitted
    Then the analysis status lists a warning that names "src/Broken.java"
    And the failure message names "src/Broken.java"
    And no response about that analysis contains the data directory or the web working directory

  @TS-081 @FR-035 @SC-014 @P2 @contract
  Scenario Outline: With a token configured every analysis operation rejects missing or wrong tokens
    Given the web server is running with a stub engine and the API token "s3cret-token"
    And a completed analysis submitted with the token "s3cret-token"
    When the operation "<operation>" is called <credential>
    Then the response status is 401 with error code "UNAUTHORIZED"
    And the response is identical for an existing and an unknown analysis
    And no new analysis area is created

    Examples:
      | operation        | credential                    |
      | submit           | without a token               |
      | submit           | with the token "wrong-token"  |
      | status           | without a token               |
      | status           | with the token "wrong-token"  |
      | graph            | without a token               |
      | architecture     | with the token "wrong-token"  |
      | contracts        | without a token               |
      | import           | without a token               |
      | import           | with the token "wrong-token"  |
      | source           | without a token               |
      | source           | with the token "wrong-token"  |
      | synchronous      | without a token               |

  @TS-082 @FR-035 @SC-014 @P2 @contract
  Scenario: With the correct token every analysis operation is served
    Given the web server is running with a stub engine and the API token "s3cret-token"
    When every analysis operation is called with the token "s3cret-token"
    Then none of the responses has status 401
    And the submitted analysis completes and its documents and sources are served

  @TS-083 @FR-035 @P2 @validation
  Scenario Outline: Without a configured token the operations need no token
    Given the web server is running with a stub engine and the API token setting "<setting>"
    When an analysis is submitted without a token
    Then the response status is 202

    Examples:
      | setting |
      | unset   |
      | blank   |

  @TS-084 @FR-036 @P2 @validation
  Scenario Outline: Listening beyond the local machine without a token logs a prominent warning
    Given the web server is configured to listen on "<host>" with the API token "<token>"
    When the web server starts
    Then the server log <outcome> the warning that the API is not protected

    Examples:
      | host      | token        | outcome          |
      | 0.0.0.0   | (none)       | contains         |
      | (unset)   | (none)       | contains         |
      | 127.0.0.1 | (none)       | does not contain |
      | localhost | (none)       | does not contain |
      | 0.0.0.0   | s3cret-token | does not contain |

  @TS-085 @FR-035 @P2 @acceptance @e2e @slow
  Scenario: The user enters the API token in the browser and analyzes a project
    Given the product is built
    And the web is running with the API token "s3cret-token"
    And a browser session is open on the web
    When the user enters the API token "s3cret-token" and uploads the ZIP of the demo project "java-standar"
    Then within 2 minutes of the upload the page shows at least one component and at least one proposal
