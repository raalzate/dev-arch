# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-005
Feature: Read algorithms, configuration and contract from the agent
  As an AI agent connected to the server mode
  I want to read the algorithm guide, the configuration guide with its defaults and the data contract
  So that I can explain and tune the results without leaving the session

  @TS-029 @FR-021 @SC-008 @US-005 @P2 @contract
  Scenario: The server lists the four documentation resources
    Given the server-mode resource registry
    Then it lists the resources:
      | uri                                         | mimeType         |
      | static-inference://algorithms               | text/markdown    |
      | static-inference://configuration            | text/markdown    |
      | static-inference://configuration/defaults   | application/json |
      | static-inference://schema                   | application/json |
    And every listed resource has a name and a description

  @TS-030 @FR-021 @SC-008 @US-005 @P2 @acceptance
  Scenario: Resource contents equal the published documentation, defaults and contract
    Given the server-mode resource registry
    When each resource is read
    Then "static-inference://algorithms" is byte-identical to "engine/ALGORITHMS.md"
    And "static-inference://configuration" is byte-identical to "engine/CONFIGURATION.md"
    And "static-inference://configuration/defaults" equals the default inference configuration applied by the engine
    And "static-inference://schema" declares schema_version "1.0.0" and contains every schema file of "schema/1.0.0"

  @TS-031 @FR-021 @US-005 @P3 @validation
  Scenario: An unknown resource is an error
    Given the server mode started over stdio
    When the resource "static-inference://nope" is read
    Then the response is an error whose message contains "static-inference://nope"

  @TS-032 @FR-021 @US-005 @P2 @acceptance
  Scenario: Resources are served from the packaged engine
    Given the server mode started over stdio from the packaged engine archive
    When the resource "static-inference://algorithms" is read
    Then its text is byte-identical to "engine/ALGORITHMS.md"
