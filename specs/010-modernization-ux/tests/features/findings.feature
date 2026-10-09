# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-006
Feature: Complete findings for modernization
  As an architect
  I want every finding the engine produces in one step
  So that I do not lose information the engine already computed

  @TS-033 @FR-028 @P2 @acceptance
  Scenario Outline: Only findings tabs with content are offered
    Given the analysis output fixture "<fixture>"
    When the findings tabs are resolved
    Then the tabs offered are exactly those of "tab-issues", "tab-secrets", "tab-contracts" and "tab-entrypoints" with at least one item
    And the other tabs are named in the "Sin hallazgos" entries of the findings step

    Examples:
      | fixture          |
      | java-standar     |
      | dotnet-ecommerce |
      | vb-synthetic     |

  @TS-034 @FR-029 @P2 @acceptance
  Scenario: Code issues can be grouped by severity or pattern and filtered by severity
    Given the analysis output fixture "dotnet-ecommerce"
    When the code issues are grouped by severity
    Then the group totals add up to the number of code issues of the analysis
    When the code issues are grouped by pattern and filtered to severity "WARNING" or higher
    Then every listed issue has severity "WARNING", "ERROR" or "CRITICAL" and the group totals add up to the number of such issues

  @TS-035 @FR-030 @P2 @acceptance @e2e @slow
  Scenario: The contracts tab lists every endpoint with method, path and owner
    Given the product is built
    And the web is running
    And a browser session is open on the web
    When the user uploads the ZIP of the demo project "java-standar" and the analysis completes
    And the user opens the step "findings" and the tab "tab-contracts"
    Then the contracts tab shows one row per endpoint of the analysis contracts with its method, path and owner component

  @TS-036 @FR-031 @FR-032 @P2 @acceptance @e2e @slow
  Scenario: Proposal and component details show entrypoint, signals, callers and omit empty attributes
    Given the product is built
    And the web is running
    And a browser session is open on the web
    When the user uploads the ZIP of the demo project "java-standar" and the analysis completes
    And the user opens the step "proposals" and the details of the first proposal
    Then the details show the legacy entrypoint type and the signals cluster count of that proposal
    When the user opens the details of a component that has incoming calls
    Then the details list its incoming calls
    And the details show no attribute label whose value is empty for that component
