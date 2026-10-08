# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-007
Feature: Optional corrections and per-stage parameters
  As an advanced user
  I want to enable the corrections of the known inconsistencies and tune each stage by configuration
  So that results change only when I ask for it

  Background:
    Given the server mode with the inference tools enabled

  @TS-039 @FR-025 @US-007 @P3 @acceptance
  Scenario: The default configuration keeps the legacy behaviour
    Given the stored analysis of the demo project "java-standar" in a folder without its sources
    When reinfer_architecture is called with the graphPath of that analysis and the configuration {"recommendation": {"dataJaccardMode": "legacy", "legacyDataJaccard": 0.8}}
    Then the response is byte-identical to the stored "output_architecture.json"

  @TS-040 @FR-025 @SC-005 @US-007 @P3 @acceptance
  Scenario: The computed data_jaccard mode emits the data cohesion of the proposal
    Given the stored analysis of the demo project "java-standar" in a folder without its sources
    When reinfer_architecture is called with the graphPath of that analysis and the configuration {"recommendation": {"dataJaccardMode": "data_cohesion"}}
    Then the proposal grouping cluster 0 reports data_jaccard 0.0
    And no proposal reports data_jaccard 0.8

  @TS-041 @FR-025 @SC-005 @US-007 @P3 @acceptance
  Scenario: An empty infrastructure keyword list for proposals keeps every component in the proposals
    Given the stored analysis of the demo project "java-standar" in a folder without its sources
    When reinfer_architecture is called with the graphPath of that analysis and the configuration {"recommendation": {"infrastructureKeywords": []}}
    Then there is no support library named "Infraestructura y Configuración Filtrada"
    And the proposals together contain all 27 components of the graph

  @TS-042 @FR-025 @US-007 @P3 @acceptance
  Scenario Outline: Checking only the root cluster of a group is equivalent to checking the whole group
    Given the dependency graph "<graph>"
    When its clusters are consolidated with the default configuration
    Then every source cluster of every consolidated group has the same support-library status as the root cluster of its group
    And the support-library status of every consolidated group computed over all its members equals that of its root cluster

    Examples:
      | graph                                    |
      | demo java-standar                        |
      | demo legacy-erp                          |
      | demo dotnet-ecommerce                    |
      | synthetic 500 components                 |

  @TS-043 @FR-004 @SC-005 @US-007 @P2 @acceptance
  Scenario: The consolidation stage is configurable
    Given the stored analysis of the demo project "java-standar" in a folder without its sources
    When reinfer_architecture is called with the graphPath of that analysis and the configuration {"consolidation": {"domainMergeMaxSize": 0}}
    Then the proposals group the clusters [0], [1] and [2] separately

  @TS-044 @FR-004 @SC-005 @US-007 @P2 @acceptance
  Scenario: The evidence stage is configurable
    Given the stored analysis of the demo project "java-standar" in a folder without its sources
    When reinfer_architecture is called with the graphPath of that analysis and the configuration {"evidence": {"evidenceThreshold": 0.3, "minStrongSignals": 1}}
    Then there is exactly one proposal and it groups the clusters [0, 1, 2]

  @TS-045 @FR-004 @SC-005 @US-007 @P2 @acceptance
  Scenario: The naming stage is configurable
    Given the stored analysis of the demo project "java-standar" in a folder without its sources
    When reinfer_architecture is called with the graphPath of that analysis and the configuration {"naming": {"excludeTokens": ["globalexception", "entity", "model", "data", "dto"]}}
    Then no proposal name contains "Globalexception"

  @TS-046 @FR-004 @SC-005 @US-007 @P2 @acceptance
  Scenario: The viability stage is configurable through its weights
    Given the stored analysis of the demo project "jee-architecture-master" in a folder without its sources
    When reinfer_architecture is called with the graphPath of that analysis and the configuration {"viability": {"weights": {"cohesion": 0.0, "coupling": 0.0, "data": 0.0}}}
    Then every proposal has viability "Baja"

  @TS-047 @FR-004 @SC-005 @US-007 @P2 @acceptance
  Scenario: The clustering stage is configurable
    Given a deterministic synthetic dependency graph of 500 components stored on disk
    When it is re-inferred with "clustering.singleDomainRatio" = 0.0 and with the default configuration
    Then the two architectures group the components differently
