# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-1 @US-3 @P1 @engine
Feature: Extended analysis configuration, maintainability in the debt index and documentation
  As a maintainer
  I want the analysis section validated and forwarded, the maintainability term in the debt index and the guide updated
  So that the engine stays the single configuration entry point

  @TS-020 @FR-001 @validation
  Scenario Outline: Invalid analysis values are rejected
    When the engine loads the configuration:
      """
      <json>
      """
    Then the configuration is rejected naming the parameter "<parameter>"

    Examples:
      | json                                                      | parameter                       |
      | { "analysis": { "extended": "maybe" } }                   | analysis.extended               |
      | { "analysis": { "duplicateMinTokens": 5 } }               | analysis.duplicateMinTokens     |
      | { "analysis": { "layerSuppressions": ["NoColon"] } }      | analysis.layerSuppressions      |
      | { "viability": { "maintainabilityWeight": 1.5 } }         | viability.maintainabilityWeight |

  @TS-021 @FR-001 @acceptance
  Scenario: The analysis section is forwarded to the .NET analyzer only when it differs from the defaults
    Given a copy of the demo project "dotnet-ecommerce"
    When it is analyzed in command-line mode with the configuration:
      """
      { "analysis": { "extended": "on", "sarif": ["reports/a.sarif"] } }
      """
    Then the .NET analyzer was invoked with the arguments "<project>" and "--config=<file>"
    And that configuration file contained the section "analysis" with "extended" equal to "on"
    And that configuration file no longer exists after the analysis

  @TS-022 @FR-041 @validation
  Scenario Outline: Maintainability term of the debt index
    When the debt index is computed for a component with loc <loc>, issues "<issues>", <eol> end-of-life dependencies and complexity max <cc> and maintainability <mi> with weight <w>
    Then the debt index is <score>

    Examples:
      | loc | issues           | eol | cc | mi | w    | score |
      | 100 | WARNING, WARNING | 0   | 5  | 40 | 0.0  | 0.286 |
      | 100 | WARNING, WARNING | 0   | 5  | 40 | 0.10 | 0.346 |
      | 100 |                  | 0   | 5  | 100 | 0.10 | 0.000 |
      | 100 |                  | 0   | 5  | -1 | 0.10 | 0.000 |

  @TS-023 @FR-070 @SC-003 @acceptance
  Scenario Outline: Demo projects keep their baseline outputs without configuration
    Given a copy of the demo project "<demo>"
    When it is analyzed in command-line mode
    Then the output documents are byte-identical to the versioned baseline of "<demo>"

    Examples:
      | demo             |
      | java-standar     |
      | dotnet-ecommerce |

  @TS-024 @FR-080 @acceptance
  Scenario: The configuration guide documents the analysis section
    Then the product document "engine/CONFIGURATION.md" mentions each of:
      | text                            |
      | analysis.extended               |
      | analysis.rules                  |
      | analysis.duplicateMinTokens     |
      | analysis.sarif                  |
      | analysis.layerSuppressions      |
      | viability.maintainabilityWeight |
      | extended-rules.json             |
    And the product document "docs/VB-LEGACY.md" mentions each of:
      | text                  |
      | UNUSED_PUBLIC_MEMBER  |
      | DUPLICATED_CODE       |
      | Maintainability:      |
      | SARIF                 |
