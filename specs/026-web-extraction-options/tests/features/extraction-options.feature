# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-1 @US-2 @P1
Feature: Extraction options when analyzing from the web
  As an analyst
  I want to send extraction options with the uploaded project
  So that opt-in analyzer passes run without the command line

  Background:
    Given the web runs with the stub engine

  @TS-001 @FR-001 @FR-002 @FR-003 @acceptance
  Scenario: A ZIP submitted with a config reaches the engine and is kept with the analysis
    When a ZIP is submitted with the extraction config:
      """
      { "detection": { "maxDepth": 3 }, "analysis": { "extended": "on", "referenceAssemblies": "/refs/v4.8" } }
      """
    Then the analysis completes
    And the analysis status exposes the extraction config with "detection.maxDepth" equal to 3
    And the engine received analyze_project with "config.analysis.extended" equal to "on"

  @TS-002 @FR-020 @acceptance
  Scenario: A ZIP submitted without a config carries none
    When a ZIP is submitted without extraction config
    Then the analysis completes
    And the analysis status exposes no extraction config
    And the engine received analyze_project without "config"

  @TS-003 @FR-001 @validation
  Scenario Outline: Invalid configs are rejected before any analysis starts
    When a ZIP is submitted with the raw config query "<query>"
    Then the response is 400 with code "INVALID_CONFIG"

    Examples:
      | query        |
      | not-json     |
      | ["a"]        |
      | 42           |

  @TS-004 @FR-001 @validation
  Scenario: An oversized config is rejected
    When a ZIP is submitted with an extraction config of 9000 characters
    Then the response is 400 with code "INVALID_CONFIG"

  @TS-005 @FR-004 @acceptance
  Scenario: A config the engine rejects fails the analysis with the engine message
    Given the stub engine rejects the configuration with "Invalid inference configuration: analysis.extended must be one of auto, on, off"
    When a ZIP is submitted with the extraction config:
      """
      { "analysis": { "extended": "maybe" } }
      """
    Then the analysis fails with code "INFERENCE_CONFIG_INVALID" and a message containing "analysis.extended"

  @TS-006 @FR-010 @acceptance
  Scenario Outline: The UI builds only the non-default values
    When the extraction options are extended <extended>, max depth <depth> and reference assemblies "<refs>"
    Then the extraction config sent is <json>

    Examples:
      | extended | depth | refs        | json                                                                              |
      | false    | 0     |             | null                                                                              |
      | true     | 0     |             | {"analysis":{"extended":"on"}}                                                    |
      | false    | 3     |             | {"detection":{"maxDepth":3}}                                                      |
      | true     | 2     | /refs/v4.8  | {"detection":{"maxDepth":2},"analysis":{"extended":"on","referenceAssemblies":"/refs/v4.8"}} |
