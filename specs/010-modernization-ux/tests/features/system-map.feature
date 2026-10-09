# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-004
Feature: Explorable system map
  As an architect
  I want to color, filter and group the dependency map by type, weight, layer, proposal and severity
  So that I see where the real coupling of the system is

  @TS-017 @FR-017 @P2 @acceptance
  Scenario: The legend counts each type of a compound dependency
    Given the dependencies "A->B" of type "call,use" and weight 1 and "B->C" of type "use" and weight 2
    When the map legend is computed
    Then the legend lists "call" with 1 dependency and "use" with 2 dependencies

  @TS-018 @FR-018 @P2 @acceptance
  Scenario: A dependency is hidden only when all its types are disabled
    Given the dependencies "A->B" of type "call,use" and weight 1 and "B->C" of type "use" and weight 2
    When the type "use" is disabled on the map
    Then the visible dependencies are "A->B"

  @TS-019 @FR-019 @P2 @acceptance
  Scenario: Heavier dependencies are drawn thicker
    Given the dependencies "A->B" of type "call" and weight 1 and "B->C" of type "call" and weight 4
    When the map stroke widths are computed
    Then the stroke of "B->C" is wider than the stroke of "A->B"

  @TS-020 @FR-020 @P2 @acceptance
  Scenario: Components are grouped by proposal or by layer
    Given the analysis output fixture "dotnet-ecommerce"
    When the map groups components by proposal
    Then every component listed in a proposal belongs to the group named after that proposal and every other component to the group "Sin propuesta"
    When the map groups components by layer
    Then every component belongs to the group named with the technology label of its layer

  @TS-021 @FR-021 @P2 @acceptance
  Scenario: Only components with an issue of at least the chosen severity are highlighted
    Given the analysis output fixture "dotnet-ecommerce"
    When the minimum severity "ERROR" is chosen on the map
    Then exactly the components having at least one code issue of severity "ERROR" or "CRITICAL" are highlighted

  @TS-022 @FR-017 @FR-018 @FR-020 @FR-021a @P2 @acceptance @e2e @slow
  Scenario: The user filters the map of a C# analysis by dependency type and groups it by proposal
    Given the product is built with the .NET analyzer staged next to the engine
    And the web is running
    And a browser session is open on the web
    When the user uploads the ZIP of the demo project "dotnet-ecommerce" and the analysis completes
    And the user opens the step "map"
    Then the map legend lists every dependency type of the analysis with its count
    And the map draws one line per dependency of the analysis
    When the user disables the dependency type "injection" in the legend
    Then the map draws exactly the dependencies having a type other than "injection"
    And the textual dependency table lists exactly the drawn dependencies
    When the user groups the map by proposal
    Then the map legend names the group of every proposal of the analysis
