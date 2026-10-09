# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-8 @P1
Feature: Redistributable VB corpus in CI and opt-in real corpus
  As a maintainer
  I want a synthetic, redistributable VB corpus that exercises every VB analyzer, and real-corpus tests that stay opt-in
  So that continuous integration verifies VB support without depending on non-redistributable code

  @TS-080 @FR-070 @SC-001 @SC-009 @acceptance
  Scenario: The synthetic desktop corpus yields non-empty tables, metrics and code issues
    Given the synthetic VB project "SyntheticDesktop"
    When the project is analyzed
    Then at least 3 components use tables
    And at least 5 components report cbo, lcom, complexity_max and complexity_avg
    And the code issues cover at least 8 distinct rules

  @TS-081 @FR-070 @acceptance
  Scenario: The synthetic corpus covers the legacy desktop and web service profile with fictitious content
    Then the synthetic VB corpus contains the files:
      | project              | file                                   |
      | SyntheticDesktop     | SyntheticDesktop.vbproj                |
      | SyntheticDesktop     | app.config                             |
      | SyntheticDesktop     | Forms/CustomerForm.vb                  |
      | SyntheticDesktop     | Forms/CustomerForm.Designer.vb         |
      | SyntheticDesktop     | Modules/AppGlobals.vb                  |
      | SyntheticDesktop     | DataAccess/CustomerDataAccess.vb       |
      | SyntheticDesktop     | DataAccess/SalesDataSet.xsd            |
      | SyntheticDesktop     | Reports/MonthlySalesReport.vb          |
      | SyntheticDesktop     | Business/CustomerController.vb         |
      | SyntheticWebServices | SyntheticWebServices.vbproj            |
      | SyntheticWebServices | Web.config                             |
      | SyntheticWebServices | Services/CustomerWebService.asmx.vb    |
      | SyntheticWebServices | Services/IOrderService.vb              |
      | SyntheticWebServices | Services/OrderService.svc.vb           |
    And every synthetic VB project declares in its README that it is synthetic and fictitious

  @TS-082 @FR-082 @SC-005 @acceptance
  Scenario Outline: Two consecutive analyses of the synthetic corpus are byte-identical
    Given the synthetic VB project "<project>"
    When the project is analyzed twice
    Then both serialized outputs are byte-identical

    Examples:
      | project              |
      | SyntheticDesktop     |
      | SyntheticWebServices |

  @TS-083 @FR-081 @SC-007 @contract
  Scenario Outline: The synthetic corpus output validates against the contract
    Given the synthetic VB project "<project>"
    When the project is analyzed
    Then the serialized output validates against the dependency-graph contract "1.0.0"

    Examples:
      | project              |
      | SyntheticDesktop     |
      | SyntheticWebServices |

  @TS-084 @FR-071 @validation
  Scenario: Real-corpus tests stay opt-in and documented as external
    Then the test class "VbCorpusSmokeTests" belongs to the test category "Corpus"
    And the documentation of "VbCorpusSmokeTests" states that the corpus is external, not redistributable and opt-in
