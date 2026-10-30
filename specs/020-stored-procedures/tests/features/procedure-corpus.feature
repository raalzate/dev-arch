# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-1 @P1
Feature: Synthetic corpus, golden outputs and documentation for stored procedures
  As a maintainer
  I want the redistributable VB corpus to exercise every recognized form with and without a catalog
  So that continuous integration guards the rules and the reference corpus stays opt-in

  @TS-040 @FR-051 @SC-001 @acceptance
  Scenario: The synthetic desktop project invokes procedures in every recognized form
    Given the synthetic VB project "SyntheticDesktop"
    When the project is analyzed
    Then the component "LegacyShop.DataAccess.PolicyAdapter" uses exactly the tables "sp:usp_Policy_Archive, sp:usp_Policy_Count, sp:usp_Policy_List, sp:usp_Policy_Read, sp:usp_Policy_Save, sp:usp_Policy_Touch"
    And the component "LegacyShop.DataAccess.CustomerDataAccess" uses exactly the tables "AuditLog, Customers, Orders"
    And the analyzer reports exactly the user warnings:
      """
      Procedure name is not a literal in LegacyShop.DataAccess.PolicyAdapter (PolicyAdapter.vb:34)
      """

  @TS-041 @FR-051 @FR-050 @SC-001 @SC-005 @acceptance
  Scenario: Golden output of the synthetic desktop project without a catalog
    Given the synthetic VB project "SyntheticDesktop"
    When the project is analyzed twice
    Then the serialized output, with the fixture root replaced by "<ROOT>", equals the golden file "SyntheticDesktop.golden.json"
    And both serialized outputs are byte-identical

  @TS-042 @FR-051 @SC-003 @SC-005 @acceptance
  Scenario Outline: Golden output of the synthetic desktop project with each catalog form
    Given the synthetic VB project "SyntheticDesktop"
    When the project is analyzed twice with the configuration:
      """
      { "dataAccess": { "procedureCatalog": "<catalog>", "catalogMode": "replace" } }
      """
    Then the component "LegacyShop.DataAccess.PolicyAdapter" uses exactly the tables "AuditLog, Policies, PolicyArchive, PolicyHolders, sp:usp_Policy_Touch"
    And the serialized output, with the fixture root replaced by "<ROOT>", equals the golden file "SyntheticDesktop.catalog.golden.json"
    And both serialized outputs are byte-identical

    Examples:
      | catalog           |
      | Catalog/procs     |
      | Catalog/procs.csv |

  @TS-043 @FR-051 @acceptance
  Scenario: The synthetic corpus ships both catalog forms and documents them
    Then the synthetic VB corpus contains the files:
      | project          | file                           |
      | SyntheticDesktop | DataAccess/PolicyAdapter.vb    |
      | SyntheticDesktop | Catalog/procs/policy.sql       |
      | SyntheticDesktop | Catalog/procs/audit.sql        |
      | SyntheticDesktop | Catalog/procs.csv              |
    And every synthetic VB project declares in its README that it is synthetic and fictitious

  @TS-044 @FR-053 @SC-002 @acceptance
  Scenario: The reference corpus criteria stay opt-in
    Then the test class "VbCorpusSmokeTests" belongs to the test category "Corpus"
    And the documentation of "VbCorpusSmokeTests" states that the corpus is external, not redistributable and opt-in

  @TS-045 @FR-052 @acceptance
  Scenario: The product documentation describes stored procedure support
    Then the product document "docs/VB-LEGACY.md" mentions each of:
      | text                    |
      | sp:                     |
      | GetStoredProcCommand    |
      | CommandType.StoredProcedure |
      | Dapper                  |
      | procedureCatalog        |
      | catalogMode             |
      | complement              |
      | replace                 |
      | dataAccess.procedures   |
      | procedureWeight         |
      | entityHeuristic         |
    And the product document "docs/SCHEMA.md" mentions each of:
      | text                    |
      | dataAccess              |
      | procedureWeight         |
