# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-3 @P2 @engine
Feature: Shared procedures in the inference and configuration through the engine
  As an architect
  I want the inference to treat shared procedures like shared tables, with an adjustable weight
  So that components operating on the same procedures land in the same proposal

  @TS-020 @FR-020 @FR-022 @SC-006 @acceptance
  Scenario: Components sharing only procedures are grouped with the default weight
    Given a dependency graph with two components without calls between them:
      | id                  | layer | tables_used                    |
      | Sample.PolicyReader | Datos | sp:usp_Policy_A, sp:usp_Policy_B |
      | Sample.PolicyWriter | Datos | sp:usp_Policy_A, sp:usp_Policy_B |
    When the architecture is inferred with the default configuration
    Then the components "Sample.PolicyReader" and "Sample.PolicyWriter" belong to the same proposal
    And that proposal lists exactly the shared tables "sp:usp_Policy_A, sp:usp_Policy_B"

  @TS-021 @FR-021 @SC-006 @acceptance
  Scenario: A zero procedure weight ignores procedures in the grouping
    Given a dependency graph with two components without calls between them:
      | id                  | layer | tables_used                    |
      | Sample.PolicyReader | Datos | sp:usp_Policy_A, sp:usp_Policy_B |
      | Sample.PolicyWriter | Datos | sp:usp_Policy_A, sp:usp_Policy_B |
    When the architecture is inferred with the configuration:
      """
      { "dataAccess": { "procedureWeight": 0 } }
      """
    Then the components "Sample.PolicyReader" and "Sample.PolicyWriter" belong to different proposals
    And no proposal lists a shared table starting with "sp:"

  @TS-022 @FR-022 @acceptance
  Scenario: Shared tables are listed before shared procedures
    Given a dependency graph with two components without calls between them:
      | id              | layer | tables_used                      |
      | Sample.ReaderA  | Datos | sp:usp_Zeta, Alpha, zebra        |
      | Sample.ReaderB  | Datos | zebra, sp:usp_Zeta, Alpha        |
    When the architecture is inferred with the default configuration
    Then the components "Sample.ReaderA" and "Sample.ReaderB" belong to the same proposal
    And that proposal lists exactly the shared tables "Alpha, zebra, sp:usp_Zeta"

  @TS-023 @FR-023 @FR-031 @SC-004 @acceptance
  Scenario Outline: Demo projects keep their baseline outputs without configuration
    Given a copy of the demo project "<demo>"
    When it is analyzed in command-line mode
    Then the output documents are byte-identical to the versioned baseline of "<demo>"

    Examples:
      | demo                |
      | java-standar        |
      | dotnet-ecommerce    |
      | dotnet-unstructured |

  @TS-024 @FR-024 @acceptance
  Scenario: Re-inference accepts the procedure weight and records the applied configuration
    Given a dependency graph with two components without calls between them:
      | id                  | layer | tables_used     |
      | Sample.PolicyReader | Datos | sp:usp_Policy_A |
      | Sample.PolicyWriter | Datos | sp:usp_Policy_A |
    When the architecture is re-inferred through the engine with the configuration:
      """
      { "dataAccess": { "procedureWeight": 0.5 } }
      """
    Then the re-inference response reports "dataAccess.procedureWeight" as 0.5
    And the components "Sample.PolicyReader" and "Sample.PolicyWriter" belong to the same proposal

  @TS-025 @FR-024 @validation
  Scenario Outline: Invalid dataAccess values are rejected by the configuration validation
    When the engine loads the configuration:
      """
      <json>
      """
    Then the configuration is rejected naming the parameter "<parameter>"

    Examples:
      | json                                            | parameter                  |
      | { "dataAccess": { "procedureWeight": -1 } }     | dataAccess.procedureWeight |
      | { "dataAccess": { "procedures": "maybe" } }     | dataAccess.procedures      |
      | { "dataAccess": { "catalogMode": "merge" } }    | dataAccess.catalogMode     |
      | { "dataAccess": { "unknownKey": 1 } }           | dataAccess.unknownKey      |

  @TS-026 @FR-030 @FR-031 @acceptance
  Scenario: The bridge invokes the .NET analyzer exactly as before when dataAccess is the default
    Given a copy of the synthetic VB project "SyntheticDesktop"
    When it is analyzed in command-line mode
    Then the .NET analyzer was invoked with exactly the arguments "<project>"

  @TS-027 @FR-030 @FR-010 @acceptance
  Scenario: The bridge passes a configuration file when dataAccess is not the default
    Given a copy of the synthetic VB project "SyntheticDesktop"
    When it is analyzed in command-line mode with the configuration:
      """
      { "dataAccess": { "procedureCatalog": "Catalog/procs.csv", "catalogMode": "replace" } }
      """
    Then the .NET analyzer was invoked with the arguments "<project>" and "--config=<file>"
    And that configuration file contained the section "dataAccess" with "catalogMode" equal to "replace"
    And that configuration file no longer exists after the analysis

  @TS-028 @FR-040 @FR-041 @acceptance
  Scenario: The entity heuristic names a proposal when enabled and never when disabled
    Given a dependency graph with two components without calls between them:
      | id                   | layer | tables_used                          |
      | Sample.Data.ReaderA  | Datos | sp:AMPsp_Policy_Read, sp:usp_GetPolicy |
      | Sample.Data.ReaderB  | Datos | sp:AMPsp_Policy_Read, sp:usp_GetPolicy |
    When the architecture is inferred with the default configuration
    Then no proposal name contains "Policy"
    When the architecture is inferred with the configuration:
      """
      { "dataAccess": { "entityHeuristic": true } }
      """
    Then the proposal containing "Sample.Data.ReaderA" has a name containing "Policy"
    And the component "Sample.Data.ReaderA" still uses exactly the tables "sp:AMPsp_Policy_Read, sp:usp_GetPolicy"

  @TS-029 @FR-040 @FR-042 @validation
  Scenario Outline: Entity derived from a procedure name
    When the entity heuristic is applied to "<procedure>"
    Then the derived entity is "<entity>"

    Examples:
      | procedure            | entity        |
      | AMPsp_Policy_Read    | Policy        |
      | usp_GetPolicy        | Policy        |
      | usp_Policy_Holder_Update | PolicyHolder |
      | sp_Save              | (none)        |
      | Totals               | Totals        |
