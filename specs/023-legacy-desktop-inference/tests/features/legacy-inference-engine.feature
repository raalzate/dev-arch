# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-1 @US-2 @US-3 @US-4 @P1 @engine
Feature: Inference preset, domain naming, support libraries and debt index for the legacy desktop profile
  As an architect
  I want the inference calibrated for the legacy desktop profile, with domain names and a debt index
  So that the proposal is presentable: few coherent groups, recognizable names, debt-aware viability

  Background:
    Given a dependency graph from the table with source "roslyn-fallback":
      | id                                        | layer   | loc | files                 | tables_used        | annotations                       | calls_out                                                                 | issues                        |
      | Acme.Win.Policies.PolicyScreen            | Web     | 300 | Forms/PolicyScreen.vb | ;                  | Layer:Presentación                | Acme.Policies.Controllers.PolicyController                                 |                               |
      | Acme.Win.Policies.ClaimScreen             | Web     | 250 | Forms/ClaimScreen.vb  | ;                  | Layer:Presentación                | Acme.Policies.Controllers.ClaimController                                  |                               |
      | Acme.Policies.Controllers.PolicyController | Negocio | 400 | PolicyController.vb   | ;                  |                                   | Acme.Policies.Adapters.PolicyAdapter, Acme.Common.Helpers.Formatter        | WARNING, WARNING, CRITICAL    |
      | Acme.Policies.Controllers.ClaimController  | Negocio | 350 | ClaimController.vb    | ;                  |                                   | Acme.Policies.Adapters.ClaimAdapter, Acme.Common.Helpers.Formatter         | INFO                          |
      | Acme.Policies.Adapters.PolicyAdapter       | Datos   | 200 | PolicyAdapter.vb      | sp:usp_Policy_Read; sp:usp_Policy_Save | Dependency:eol:Microsoft.Practices.EnterpriseLibrary.Data |                                    | WARNING                       |
      | Acme.Policies.Adapters.ClaimAdapter        | Datos   | 180 | ClaimAdapter.vb       | sp:usp_Claim_Read; sp:usp_Policy_Read |                                    |                                                                           |                               |
      | Acme.Billing.Controllers.InvoiceController | Negocio | 220 | InvoiceController.vb  | ;                  |                                   | Acme.Billing.Adapters.InvoiceAdapter, Acme.Common.Helpers.Formatter        |                               |
      | Acme.Billing.Adapters.InvoiceAdapter       | Datos   | 150 | InvoiceAdapter.vb     | sp:usp_Invoice_Read; |                                  |                                                                           |                               |
      | Acme.Common.Helpers.Formatter              | Compartida | 90 | Formatter.vb          | ;                  |                                   |                                                                           |                               |

  @TS-001 @FR-001 @FR-003 @acceptance
  Scenario: The legacy-desktop preset is applied automatically to a VB graph and recorded in the summary
    When the architecture is inferred with the default configuration
    Then the architecture summary contains "Preset de inferencia: legacy-desktop"

  @TS-002 @FR-001 @FR-050 @SC-002 @acceptance
  Scenario: A Java graph gets no preset and the demo baselines do not change
    Given a dependency graph from the table with source "spoon":
      | id                        | layer   | loc | files            | tables_used | annotations | calls_out                 | issues |
      | com.acme.orders.OrderService | Negocio | 100 | OrderService.java | orders;     |             | com.acme.orders.OrderRepo |        |
      | com.acme.orders.OrderRepo    | Datos   | 80  | OrderRepo.java    | orders;     |             |                           |        |
    When the architecture is inferred with the default configuration
    Then the architecture summary does not contain "Preset de inferencia"
    And no proposal rationale starts with "Deuda técnica"

  @TS-003 @FR-001 @acceptance
  Scenario Outline: The preset can be forced or disabled
    When the architecture is inferred with the configuration:
      """
      { "inference": { "preset": "<preset>" } }
      """
    Then the architecture summary <contains> "Preset de inferencia: legacy-desktop"

    Examples:
      | preset         | contains         |
      | none           | does not contain |
      | legacy-desktop | contains         |

  @TS-004 @FR-002 @acceptance
  Scenario: Explicit configuration wins over the preset
    When the architecture is inferred with the configuration:
      """
      { "viability": { "debtWeight": 0 } }
      """
    Then the architecture summary contains "Preset de inferencia: legacy-desktop"
    And no proposal rationale starts with "Deuda técnica"

  @TS-005 @FR-020 @acceptance
  Scenario: Proposals are named by their domain namespace under the preset
    When the architecture is inferred with the default configuration
    Then the proposal containing "Acme.Policies.Controllers.PolicyController" is named "Componente de Policies · Policy"
    And the proposal containing "Acme.Billing.Controllers.InvoiceController" is named "Componente de Billing · Invoice"

  @TS-006 @FR-020 @acceptance
  Scenario: Token naming stays the default outside the preset
    When the architecture is inferred with the configuration:
      """
      { "inference": { "preset": "none" } }
      """
    Then no proposal name contains "·"

  @TS-007 @FR-030 @acceptance
  Scenario: Common namespaces and widely referenced components are support libraries
    When the architecture is inferred with the default configuration
    Then "Acme.Common.Helpers.Formatter" belongs to a support library, not to a proposal

  @TS-008 @FR-010 @acceptance
  Scenario: Presentation components do not count in the cohesion of their proposal but stay members
    When the architecture is inferred with the default configuration
    Then the proposal containing "Acme.Win.Policies.PolicyScreen" also contains "Acme.Policies.Controllers.PolicyController"
    And that proposal has a cohesion computed without presentation members

  @TS-009 @FR-040 @FR-041 @FR-043 @acceptance
  Scenario: The debt index appears in the rationale with the most indebted components
    When the architecture is inferred with the default configuration
    Then the proposal containing "Acme.Policies.Controllers.PolicyController" has a rationale line matching "Deuda técnica: 0\.[0-9]{3}"
    And that proposal has a rationale line starting with "Mayor deuda: Acme.Policies.Controllers.PolicyController ("

  @TS-010 @FR-042 @acceptance
  Scenario: The debt weight lowers the viability score
    When the architecture is inferred with the configuration:
      """
      { "inference": { "preset": "none" }, "viability": { "debtWeight": 0 } }
      """
    And the viability score of the proposal containing "Acme.Policies.Controllers.PolicyController" is remembered
    And the architecture is inferred with the configuration:
      """
      { "inference": { "preset": "none" }, "viability": { "debtWeight": 1 } }
      """
    Then the viability score of the proposal containing "Acme.Policies.Controllers.PolicyController" is lower than remembered

  @TS-011 @FR-001 @FR-020 @FR-030 @FR-042 @validation
  Scenario Outline: Invalid values are rejected by the configuration validation
    When the engine loads the configuration:
      """
      <json>
      """
    Then the configuration is rejected naming the parameter "<parameter>"

    Examples:
      | json                                                      | parameter                              |
      | { "inference": { "preset": "windows-forms" } }            | inference.preset                       |
      | { "viability": { "debtWeight": 2 } }                      | viability.debtWeight                   |
      | { "naming": { "strategy": "random" } }                    | naming.strategy                        |
      | { "recommendation": { "minReferencingDomains": -1 } }     | recommendation.minReferencingDomains   |

  @TS-012 @FR-050 @SC-002 @SC-003 @acceptance
  Scenario Outline: Demo projects keep their baseline outputs without configuration
    Given a copy of the demo project "<demo>"
    When it is analyzed in command-line mode
    Then the output documents are byte-identical to the versioned baseline of "<demo>"

    Examples:
      | demo             |
      | java-standar     |
      | dotnet-ecommerce |

  @TS-013 @FR-040 @validation
  Scenario Outline: Debt index of a component
    When the debt index is computed for a component with loc <loc>, issues "<issues>", <eol> end-of-life dependencies and complexity max <cc>
    Then the debt index is <score>

    Examples:
      | loc  | issues                     | eol | cc | score |
      | 100  |                            | 0   | 5  | 0.000 |
      | 100  | WARNING, WARNING           | 0   | 5  | 0.286 |
      | 100  | CRITICAL, ERROR, INFO      | 2   | 20 | 0.856 |
      | 0    | INFO                       | 0   | 0  | 0.048 |
      | 2000 | CRITICAL                   | 4   | 16 | 0.439 |

  @TS-014 @FR-051 @acceptance
  Scenario: The configuration guide documents the preset and the new parameters
    Then the product document "engine/CONFIGURATION.md" mentions each of:
      | text                                 |
      | inference.preset                     |
      | inference.presentationInCohesion     |
      | viability.debtWeight                 |
      | naming.strategy                      |
      | recommendation.supportNamespaces     |
      | recommendation.minReferencingDomains |
      | legacy-desktop                       |
    And the product document "docs/VB-LEGACY.md" mentions each of:
      | text                     |
      | legacy-desktop           |
      | Deuda técnica            |
      | Preset de inferencia     |
