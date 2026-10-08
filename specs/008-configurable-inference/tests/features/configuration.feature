# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-002
Feature: Configure the inference of an analysis
  As a user of the command line or of the server mode
  I want to declare the weights, thresholds and lists of the inference in a configuration
  So that I can tune the proposals without recompiling, with clear errors when I make a mistake

  @TS-005 @FR-008 @FR-005 @US-002 @P1 @acceptance
  Scenario: An explicit configuration equal to the defaults changes nothing
    Given a configuration file containing every default inference parameter
    When the demo project "java-standar" is analyzed from the command line with that configuration file
    Then the three documents are byte-identical to the analysis without configuration

  @TS-006 @FR-004 @FR-006 @FR-008 @SC-005 @US-002 @P1 @acceptance
  Scenario: A partial configuration file only changes what it declares
    Given a configuration file declaring only "viability.thresholds.high" = 0.0 and "viability.thresholds.medium" = 0.0
    When the demo project "java-standar" is analyzed from the command line with that configuration file
    Then every proposal has viability "Alta"
    And the dependency graph and the entrypoints documents are byte-identical to the analysis without configuration
    And the proposals group the same clusters as the analysis without configuration

  @TS-007 @FR-007 @FR-010 @US-002 @P1 @acceptance
  Scenario: Command line and server mode produce identical documents with the same configuration
    Given a configuration file declaring only "viability.thresholds.high" = 0.0 and "viability.thresholds.medium" = 0.0
    When the demo project "java-standar" is analyzed from the command line with that configuration file
    And the demo project "java-standar" is analyzed with the analyze_project tool with the same configuration given inline
    Then both analyses produce byte-identical documents
    When the demo project "java-standar" is analyzed with the analyze_project tool with the same configuration given as configPath
    Then both analyses produce byte-identical documents

  @TS-008 @FR-009 @SC-006 @US-002 @P1 @validation
  Scenario Outline: Invalid configurations are rejected naming the parameter
    Given an inline configuration <config>
    When the demo project "java-standar" is analyzed with the analyze_project tool with that inline configuration into an empty output directory
    Then the tool reports an error containing "<message>"
    And no document is written to the output directory

    Examples:
      | config                                                          | message                                                                                          |
      | {"viability": {"thresholds": {"hihg": 0.8}}}                    | Invalid inference configuration: viability.thresholds.hihg: unknown parameter                     |
      | {"evidence": {"weights": {"table": "high"}}}                    | Invalid inference configuration: evidence.weights.table: must be a number                         |
      | {"evidence": {"evidenceThreshold": 1.5}}                        | Invalid inference configuration: evidence.evidenceThreshold: must be between 0 and 1              |
      | {"viability": {"thresholds": {"high": 0.4, "medium": 0.6}}}     | Invalid inference configuration: viability.thresholds.medium: must be <= viability.thresholds.high |
      | {"recommendation": {"dataJaccardMode": "exact"}}                | Invalid inference configuration: recommendation.dataJaccardMode: must be one of legacy, data_cohesion |
      | {"detection": {"maxDepth": 9}}                                  | Invalid inference configuration: detection.maxDepth: must be between 0 and 5                      |
      | {"naming": {"minTokenLength": 2.5}}                             | Invalid inference configuration: naming.minTokenLength: must be an integer                        |

  @TS-009 @FR-009 @SC-006 @US-002 @P1 @validation
  Scenario: The command line rejects an invalid configuration before analyzing
    Given a configuration file declaring an unknown parameter "viability.thresholds.hihg"
    When the demo project "java-standar" is analyzed from the command line with that configuration file into an empty output directory
    Then the command exits with code 1
    And the error output contains "Invalid inference configuration: viability.thresholds.hihg: unknown parameter"
    And no document is written to the output directory

  @TS-010 @FR-009 @SC-006 @US-002 @P1 @validation
  Scenario Outline: Unusable configuration files are rejected naming the file
    Given a configuration file that <problem>
    When the demo project "java-standar" is analyzed with the analyze_project tool with that configuration file as configPath
    Then the tool reports an error containing "Inference configuration file '"
    And the tool reports an error containing "<reason>"

    Examples:
      | problem             | reason              |
      | does not exist      | does not exist      |
      | is not valid JSON   | is not valid JSON   |

  @TS-011 @FR-007 @US-002 @P2 @validation
  Scenario: Inline configuration and configuration path are mutually exclusive
    Given an inline configuration {"viability": {"thresholds": {"high": 0.8}}}
    And a configuration file containing every default inference parameter
    When the analyze_project tool is called on the demo project "java-standar" with both the inline configuration and the configuration file
    Then the tool reports an error containing "Pass either config or configPath, not both"

  @TS-012 @FR-011 @US-002 @P2 @validation
  Scenario: Analyses with a non-default configuration are not reused
    Given the server mode with analysis reuse enabled
    When the demo project "java-standar" is analyzed with the analyze_project tool without configuration
    And the demo project "java-standar" is analyzed with the analyze_project tool with the inline configuration {"viability": {"thresholds": {"high": 0.0, "medium": 0.0}}}
    And the demo project "java-standar" is analyzed with the analyze_project tool without configuration
    Then the second analysis reports every proposal with viability "Alta"
    And the third analysis is byte-identical to the first

  @TS-013 @FR-004 @FR-022 @SC-004 @US-002 @P1 @contract
  Scenario: Every documented fixed parameter is a named configuration parameter
    Given the default inference configuration
    Then it declares a value for every parameter listed in the parameter table of the configuration guide
    And every listed default equals the value documented in the guide
