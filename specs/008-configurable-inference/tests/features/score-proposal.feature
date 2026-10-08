# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-004
Feature: Score an edited proposal
  As an architect
  I want the engine to score a proposal I edited with the same criteria it uses for its own proposals
  So that I know whether my variant is more or less viable

  Background:
    Given the server mode with the inference tools enabled

  @TS-023 @FR-018 @FR-019 @SC-007 @US-004 @P2 @acceptance
  Scenario Outline: Scoring the components of an existing proposal reproduces its viability and rationale
    Given the stored analysis of the demo project "<project>" in a folder without its sources
    When score_proposal is called with the components of every stored proposal that has no filtered infrastructure component
    Then each response has the viability and the rationale of its proposal
    And at least one proposal was scored

    Examples:
      | project                 |
      | java-standar            |
      | jee-architecture-master |
      | legacy-erp              |
      | dotnet-ecommerce        |
      | dotnet-legacy-clinic    |

  @TS-024 @FR-018 @US-004 @P2 @contract
  Scenario: An edited proposal gets a complete evaluation
    Given the stored analysis of the demo project "java-standar" in a folder without its sources
    When score_proposal is called with the components of the first two stored proposals merged into one list
    Then the response validates against the score_proposal response schema
    And the response has a name, a viability, a score, the metrics cohesion_adjusted, external_coupling, data_cohesion, internal_edge_density, size and cluster_count, the components, the clusters, a rationale and recommended actions
    And the response components are the sorted union of both proposals

  @TS-025 @FR-020 @US-004 @P2 @validation
  Scenario: Unknown components are rejected listing them
    Given the stored analysis of the demo project "java-standar" in a folder without its sources
    When score_proposal is called with the components "com.unknown.B", "com.unknown.A" and one existing component
    Then the tool reports an error containing "Unknown components: com.unknown.A, com.unknown.B"

  @TS-026 @FR-020 @US-004 @P2 @validation
  Scenario: An empty proposal is rejected and duplicates are ignored
    Given the stored analysis of the demo project "java-standar" in a folder without its sources
    When score_proposal is called with no components
    Then the tool reports an error containing "components must contain at least one component id"
    When score_proposal is called with the components of the first stored proposal, each listed twice
    Then the response is identical to scoring the components of the first stored proposal once

  @TS-027 @FR-019 @US-004 @P2 @acceptance
  Scenario: The configuration changes the classification of a scored proposal
    Given the stored analysis of the demo project "java-standar" in a folder without its sources
    When score_proposal is called with the components of the first stored proposal and the configuration {"viability": {"thresholds": {"high": 0.0, "medium": 0.0}}}
    Then the response viability is "Alta"

  @TS-028 @FR-010 @FR-020 @US-004 @P2 @validation
  Scenario: Scoring is deterministic and writes nothing
    Given the stored analysis of the demo project "legacy-erp" in a folder without its sources
    When score_proposal is called twice with the components of the first stored proposal
    Then both responses are byte-identical
    And the files of the stored analysis are unchanged
