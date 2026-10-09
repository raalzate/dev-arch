# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-007
Feature: Exportable modernization plan
  As an architect
  I want an ordered modernization plan exportable as JSON, Markdown and PDF
  So that I can share it with the team and management

  @TS-037 @FR-033 @P2 @acceptance
  Scenario: The plan orders proposals by viability, coupling and name in stages
    Given the analysis output fixture "dotnet-ecommerce"
    When the modernization plan is built
    Then the plan proposals are ordered by viability "Alta", "Media", "Baja", then by ascending external coupling, then by name
    And each stage contains only proposals of one viability and no stage is empty

  @TS-038 @FR-034 @FR-035 @P2 @acceptance
  Scenario: The Markdown export is complete and deterministic
    Given the analysis output fixture "vb-synthetic" with the analysis warning "VB project analyzed with reduced fidelity"
    When the plan is exported to Markdown twice
    Then both documents are byte-identical
    And the document contains the technology label "VB.NET", an executive summary, every proposal name in plan order, the code issues per severity and the analysis warning

  @TS-039 @FR-034 @P2 @acceptance
  Scenario: The JSON export carries the current architecture and the parameters used
    Given the analysis output fixture "java-standar"
    And the inference configuration {"viability":{"thresholds":{"high":0.9}}} with minimum viability "Media"
    When the plan is exported to JSON
    Then the export contains the architecture document and that configuration and minimum viability

  @TS-040 @FR-034 @SC-003 @P2 @acceptance @e2e @slow
  Scenario: The user exports the plan as Markdown and as a printable PDF view
    Given the product is built
    And the web is running
    And a browser session is open on the web
    When the user uploads the ZIP of the demo project "java-standar" and the analysis completes
    And the user opens the step "plan"
    Then the plan shows its stages ordered by viability
    When the user exports the plan as Markdown
    Then a Markdown file is downloaded containing "Java" and the name of every proposal of the analysis
    When the user exports the plan as PDF
    Then the browser print is requested and the printable report contains the name of every proposal of the analysis
