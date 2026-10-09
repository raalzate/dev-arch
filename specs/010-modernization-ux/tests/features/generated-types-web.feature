# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-010
Feature: Generated contract types for everything the web shows
  As a developer of the product
  I want the web to use only types and validators generated from the contract
  So that the interface never drifts from the engine

  @TS-051 @FR-041 @SC-006 @P3 @acceptance
  Scenario: The generated package covers the inference configuration and the 008 responses
    Given the generated contract package
    Then it declares the types "InferenceConfig", "ReinferArchitectureResponse" and "ScoreProposalResponse"
    And it registers runtime validators for the kinds "inference-config", "mcp/reinfer_architecture" and "mcp/score_proposal"

  @TS-052 @FR-042 @SC-005 @P3 @validation
  Scenario: The web declares no hand-written contract types
    Given the web source tree
    When every type declaration named after a contract type is located
    Then none resides in the web source tree

  @TS-053 @FR-042 @P3 @validation
  Scenario: An engine response that violates the contract is not shown
    Given the web runs with the stub engine
    And a completed analysis of the stub engine
    And the stub engine answers score_proposal with a body that violates the contract
    When the client scores the components "a.A" of that analysis
    Then the response status is 502 with the error code "ENGINE_ERROR"
