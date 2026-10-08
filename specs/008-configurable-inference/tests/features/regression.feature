# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-003
Feature: Default outputs do not change
  As a consumer of the current outputs (web, agents, scripts)
  I want exactly the same documents for the same projects after the engine is restructured
  So that the restructuring is not observable (Constitution I)

  @TS-001 @FR-002 @FR-005 @SC-001 @US-003 @P1 @acceptance
  Scenario Outline: Command-line documents are byte-identical to the 1.2.0 baseline
    Given the regression baseline of the demo project "<project>"
    When the demo project "<project>" is analyzed from the command line without configuration
    Then the "output.json", "output_architecture.json" and "output_entrypoints.json" documents are byte-identical to the baseline

    Examples:
      | project                 |
      | java-standar            |
      | jee-architecture-master |
      | legacy-erp              |
      | dotnet-ecommerce        |
      | dotnet-legacy-clinic    |
      | dotnet-unstructured     |

  @TS-002 @FR-002 @FR-005 @FR-010 @SC-001 @US-003 @P1 @acceptance
  Scenario Outline: Server-mode documents are byte-identical to the 1.2.0 baseline
    Given the regression baseline of the demo project "<project>"
    When the demo project "<project>" is analyzed with the analyze_project tool without configuration
    Then the "output.json", "output_architecture.json" and "output_entrypoints.json" documents are byte-identical to the baseline

    Examples:
      | project                 |
      | java-standar            |
      | jee-architecture-master |
      | legacy-erp              |
      | dotnet-ecommerce        |
      | dotnet-legacy-clinic    |
      | dotnet-unstructured     |

  @TS-003 @FR-027 @US-003 @P1 @contract
  Scenario: The server offers exactly the five existing tools unless the inference tools are enabled
    Given the server-mode tool registry without the inference tools enabled
    Then it registers exactly the tools "analyze_project", "get_dependency_graph", "get_architecture_proposal", "get_api_contracts" and "get_component_metrics"
    When the inference tools are enabled
    Then it registers those five tools plus "reinfer_architecture" and "score_proposal"

  @TS-004 @FR-026 @US-003 @P1 @contract
  Scenario: Documents keep declaring contract version 1.0.0
    When the demo project "java-standar" is analyzed from the command line without configuration
    Then the graph, architecture and entrypoints documents declare schema_version "1.0.0"
