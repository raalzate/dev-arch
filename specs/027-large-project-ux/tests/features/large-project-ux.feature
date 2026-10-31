# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-3 @US-4 @P1
Feature: Lexical search and large-project ergonomics of the modernization flow
  As an analyst reviewing a project with hundreds of components
  I want a lexical search over every datum of the analysis and lists that stay readable
  So that I can find and navigate to what matters without scrolling thousands of rows

  Background:
    Given the analysis view of the fixture "search-sample"

  @TS-001 @FR-001 @FR-002 @acceptance
  Scenario: Words are matched without case or accents across every kind of datum
    When the lexical search runs for "pago politica"
    Then the results include a "component" titled "Acme.Pagos.PolíticaPagoAdapter"
    And the results include a "procedure" titled "sp:usp_Politica_PagoRead"
    And the result kinds with their counts are "component 1, procedure 1"

  @TS-002 @FR-001 @acceptance
  Scenario: Every word must match and results are deterministic
    When the lexical search runs for "adapter inexistente"
    Then there are no results
    When the lexical search runs for "adapter"
    Then the result titles in order are "Acme.Pagos.PolíticaPagoAdapter, Acme.Ventas.ClienteAdapter, LATE_BINDING en Acme.Ventas.ClienteAdapter, sp:usp_Politica_PagoRead, sp:usp_Cliente_Read"

  @TS-003 @FR-002 @acceptance
  Scenario Outline: Each result carries its navigation target
    When the lexical search runs for "<query>"
    Then the first result is a "<kind>" targeting step "<step>" and component "<component>"

    Examples:
      | query               | kind       | step      | component                      |
      | ClienteAdapter      | component  | map       | Acme.Ventas.ClienteAdapter     |
      | LATE_BINDING        | issue      | findings  | Acme.Ventas.ClienteAdapter     |
      | Componente de Ventas | proposal  | proposals |                                |
      | usp_Cliente_Read    | procedure  | map       | Acme.Ventas.ClienteAdapter     |
      | reduced fidelity    | warning    | summary   |                                |

  @TS-004 @FR-001 @acceptance
  Scenario: An empty query yields nothing and the limit caps the list
    When the lexical search runs for "   "
    Then there are no results
    When the lexical search runs for "a" with limit 2
    Then there are 2 results

  @TS-005 @FR-030 @validation
  Scenario Outline: Issue groups are paginated
    When 4984 rows are paginated with page size 150 showing <pages> pages
    Then <shown> rows are shown and <remaining> remain

    Examples:
      | pages | shown | remaining |
      | 1     | 150   | 4834      |
      | 34    | 4984  | 0         |

  @TS-006 @FR-010 @validation
  Scenario Outline: Hover dimming only for small maps
    Then hover dimming for <n> components is <enabled>

    Examples:
      | n    | enabled |
      | 40   | true    |
      | 300  | true    |
      | 301  | false   |
      | 1110 | false   |
