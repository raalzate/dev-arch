# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-003
Feature: The agent recomputes proposals with other inference parameters
  As an agent
  I want to know the inference parameters and recompute proposals without reanalyzing
  So that I can explore alternative decompositions

  Background:
    Given a dev-arch web server with a completed analysis of the demo project "java-standar"
    And an MCP client connected to the agent endpoint of that server

  @TS-019 @FR-015 @US-003 @P2 @acceptance
  Scenario: The parameters are the ones of the web panel
    When the client calls "get_inference_parameters"
    Then the parameters equal the ones of the web inference defaults with name, description, default and range

  @TS-020 @FR-016 @US-003 @P2 @acceptance
  Scenario: Recomputing returns the proposals the web shows for the same values
    When the client calls "reinfer_proposals" for that analysis with a different high viability threshold
    Then the result is not an error
    And the proposals equal the web reinference of that analysis with the same values in the web order
    And the engine did not analyze the project again

  @TS-021 @FR-017 @US-003 @P2 @validation
  Scenario: Out of range values are rejected naming the parameter
    When the client calls "reinfer_proposals" for that analysis with a high viability threshold of 7
    Then the result is an error with the code "INVALID_INPUT"
    And the error names the parameter
