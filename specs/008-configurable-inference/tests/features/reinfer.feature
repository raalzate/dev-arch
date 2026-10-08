# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-001
Feature: Re-infer the architecture with other thresholds without analyzing again
  As an architect reviewing a monolith
  I want to re-run the inference on an already extracted dependency graph with other parameters
  So that I can explore "what if" scenarios in seconds without reading the sources again

  Background:
    Given the server mode with the inference tools enabled

  @TS-014 @FR-001 @FR-003 @FR-012 @FR-013 @SC-002 @US-001 @P1 @acceptance
  Scenario Outline: Re-inference with defaults reproduces the stored architecture
    Given the stored analysis of the demo project "<project>" in a folder without its sources
    When reinfer_architecture is called with the graphPath of that analysis and no configuration
    Then the response is byte-identical to the stored "output_architecture.json"
    And the response has no warnings

    Examples:
      | project                 |
      | java-standar            |
      | jee-architecture-master |
      | legacy-erp              |
      | dotnet-ecommerce        |
      | dotnet-legacy-clinic    |
      | dotnet-unstructured     |

  @TS-015 @FR-012 @SC-005 @US-001 @P1 @acceptance
  Scenario: Unreachable viability thresholds leave no Alta or Media proposal
    Given the stored analysis of the demo project "java-standar" in a folder without its sources
    When reinfer_architecture is called with the graphPath of that analysis and the configuration {"viability": {"thresholds": {"high": 1.0, "medium": 1.0}}}
    Then no proposal has viability "Alta" or "Media"
    And the response validates against the reinfer_architecture response schema

  @TS-016 @FR-012 @SC-005 @US-001 @P1 @acceptance
  Scenario: An unreachable evidence threshold never yields fewer groups
    Given the stored analysis of the demo project "legacy-erp" in a folder without its sources
    When reinfer_architecture is called with the graphPath of that analysis and the configuration {"evidence": {"evidenceThreshold": 1.0, "minStrongSignals": 4}}
    Then the number of proposals plus support libraries is at least that of the stored architecture

  @TS-017 @FR-012 @US-001 @P2 @acceptance
  Scenario: The minimum viability filter applies to the re-inferred architecture
    Given the stored analysis of the demo project "jee-architecture-master" in a folder without its sources
    When reinfer_architecture is called with the graphPath of that analysis and minViability "Alta"
    Then every proposal has viability "Alta"
    And there is at least one proposal

  @TS-018 @FR-017 @SC-003 @US-001 @P1 @acceptance
  Scenario: Re-inference of a 500-component graph answers in less than 2 seconds
    Given a deterministic synthetic dependency graph of 500 components stored on disk
    And reinfer_architecture has been called once on it
    When reinfer_architecture is called 5 more times on it with no configuration
    Then each of the 5 calls answers in less than 2 seconds
    And the 5 responses are byte-identical

  @TS-019 @FR-015 @US-001 @P1 @acceptance
  Scenario: A web analysis identifier resolves to the graph of that analysis
    Given a jobs directory containing the stored analysis of the demo project "java-standar" as job "job-0001"
    And the server mode is started with that jobs directory
    When reinfer_architecture is called with jobId "job-0001" and no configuration
    Then the response is byte-identical to the response for the graphPath of that job

  @TS-020 @FR-014 @US-001 @P1 @acceptance
  Scenario: A graph without its architecture is re-inferred with a warning
    Given the stored graph of the demo project "java-standar" alone in a folder
    When reinfer_architecture is called with the graphPath of that analysis and no configuration
    Then the response is an architecture document whose project metadata has no secrets locations
    And the response warnings contain "Project metadata not found next to the graph"

  @TS-021 @FR-015 @FR-016 @FR-029 @US-001 @P1 @validation
  Scenario Outline: Unusable graph references are rejected with a clear message
    Given <setup>
    When reinfer_architecture is called with <reference>
    Then the tool reports an error containing "<message>"

    Examples:
      | setup                                                          | reference                                      | message                                                    |
      | no graph file                                                  | the graphPath "/nonexistent/output.json"       | Graph file '/nonexistent/output.json' does not exist       |
      | a file that is not a dependency graph                          | the graphPath of that file                     | is not a dependency graph                                  |
      | a dependency graph declaring schema_version "9.9.9"            | the graphPath of that file                     | declares schema_version '9.9.9'; supported: 1.0.0          |
      | the server mode is started without a jobs directory            | jobId "job-0001"                               | jobId requires STATIC_INFERENCE_JOBS_DIR; pass graphPath instead |
      | an empty jobs directory configured for the server mode          | jobId "../etc"                                 | Invalid jobId '../etc'                                     |
      | an empty jobs directory configured for the server mode          | jobId "job-404"                                | Analysis 'job-404' has no dependency graph                 |
      | no graph file                                                  | neither graphPath nor jobId                    | Pass exactly one of graphPath or jobId                     |
      | the stored analysis of the demo project "java-standar" in a folder without its sources | the graphPath of that analysis and minViability "Excelente" | Invalid minViability 'Excelente'. Allowed: Alta, Media, Baja |

  @TS-022 @FR-010 @US-001 @P2 @validation
  Scenario: Re-inference is deterministic
    Given the stored analysis of the demo project "legacy-erp" in a folder without its sources
    When reinfer_architecture is called twice with the graphPath of that analysis and the configuration {"evidence": {"evidenceThreshold": 0.3}}
    Then both responses are byte-identical
