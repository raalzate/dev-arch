# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-1 @P1
Feature: Synthetic legacy debt corpus, goldens and documentation
  As a maintainer
  I want a redistributable fixture exercising identity, fine layers, the batch entry point and every debt rule
  So that continuous integration guards the rules

  @TS-050 @FR-042 @SC-002 @acceptance
  Scenario: The synthetic legacy debt project is identified under its root namespace with fine layers
    Given the synthetic VB project "SyntheticLegacyDebt"
    When the project is analyzed
    Then the component "Acme.Legacy.Forms.PolicyScreen" has the annotation "Layer:Presentación"
    And the component "Acme.Legacy.Reports.PolicyListing" has the annotation "Layer:Reportes"
    And the component "Acme.Legacy.Jobs.NightlyProcess" has the annotation "EntryPoint:Main"
    And the component "Acme.Legacy.Jobs.NightlyProcess" is in layer "Negocio"
    And the component "Acme.Legacy.Rules.PolicyValidator" is in layer "Negocio"
    And the components have exactly these code issue counts:
      | component                              | rule                       | count |
      | Acme.Legacy.Forms.PolicyScreen         | PROJECT_OPTION_STRICT_OFF  | 1     |
      | Acme.Legacy.Reports.PolicyListing      | PROJECT_OPTION_STRICT_OFF  | 1     |
      | Acme.Legacy.Jobs.NightlyProcess        | PROJECT_OPTION_STRICT_OFF  | 1     |
      | Acme.Legacy.Jobs.NightlyProcess        | UI_CALL_IN_BUSINESS_LAYER  | 1     |
      | Acme.Legacy.Rules.PolicyValidator      | PROJECT_OPTION_STRICT_OFF  | 1     |
      | Acme.Legacy.Data.PolicyRepository      | PROJECT_OPTION_STRICT_OFF  | 1     |
      | Acme.Legacy.Data.PolicyRepository      | SQL_CONCAT_INJECTION       | 1     |
      | Acme.Legacy.Data.PolicyRepository      | MIXED_TRANSACTION_MODELS   | 1     |
      | Acme.Legacy.Data.PolicyRepository      | CATCH_GENERIC_EXCEPTION    | 1     |
      | Acme.Legacy.Facades.PolicyFacade       | PROJECT_OPTION_STRICT_OFF  | 1     |
      | Acme.Legacy.Facades.PolicyFacade       | STATIC_FACADE              | 1     |
      | Acme.Legacy.Facades.PolicyFacade       | GOD_CLASS                  | 1     |
      | Acme.Legacy.Facades.PolicyFacade       | HIGH_CYCLOMATIC_COMPLEXITY | 1     |
      | Acme.Legacy.Facades.PolicyFacade       | MISSING_SWITCH_DEFAULT     | 1     |

  @TS-051 @FR-042 @FR-041 @SC-004 @acceptance
  Scenario: Golden output of the synthetic legacy debt project
    Given the synthetic VB project "SyntheticLegacyDebt"
    When the project is analyzed twice
    Then the serialized output, with the fixture root replaced by "<ROOT>", equals the golden file "SyntheticLegacyDebt.golden.json"
    And both serialized outputs are byte-identical

  @TS-052 @FR-030 @FR-042 @acceptance
  Scenario: Golden output with the debt rules disabled keeps identity and layers
    Given the synthetic VB project "SyntheticLegacyDebt"
    When the project is analyzed with the configuration:
      """
      { "debt": { "enabled": "off" } }
      """
    Then the serialized output, with the fixture root replaced by "<ROOT>", equals the golden file "SyntheticLegacyDebt.debt-off.golden.json"
    And the component "Acme.Legacy.Facades.PolicyFacade" has none of the code issues "STATIC_FACADE, GOD_CLASS, PROJECT_OPTION_STRICT_OFF"
    And the component "Acme.Legacy.Jobs.NightlyProcess" has the annotation "EntryPoint:Main"

  @TS-053 @FR-042 @acceptance
  Scenario: The fixture ships its files and README
    Then the synthetic VB corpus contains the files:
      | project             | file                          |
      | SyntheticLegacyDebt | SyntheticLegacyDebt.vbproj    |
      | SyntheticLegacyDebt | README.md                     |
      | SyntheticLegacyDebt | Forms/PolicyScreen.vb         |
      | SyntheticLegacyDebt | Reports/PolicyListing.vb      |
      | SyntheticLegacyDebt | Reports/PolicyListing.rdlc    |
      | SyntheticLegacyDebt | Jobs/NightlyProcess.vb        |
      | SyntheticLegacyDebt | Rules/PolicyValidator.vb      |
      | SyntheticLegacyDebt | Data/PolicyRepository.vb      |
      | SyntheticLegacyDebt | Facades/PolicyFacade.vb       |

  @TS-054 @FR-043 @acceptance
  Scenario: The documentation describes the fine layers, the entry point and the rules
    Then the product document "docs/VB-LEGACY.md" mentions each of:
      | text                        |
      | Layer:Presentación          |
      | Layer:Reportes              |
      | Layer:Batch                 |
      | EntryPoint:Main             |
      | RootNamespace               |
      | PROJECT_OPTION_STRICT_OFF   |
      | UI_CALL_IN_BUSINESS_LAYER   |
      | SQL_CONCAT_INJECTION        |
      | STATIC_FACADE               |
      | MIXED_TRANSACTION_MODELS    |
      | GOD_CLASS                   |
      | debt.enabled                |
    And the product document "engine/CONFIGURATION.md" mentions each of:
      | text                        |
      | debt.enabled                |
      | debt.godClass.minLoc        |
      | debt.godClass.minComplexity |
