# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-005
Feature: Live inference parameters and re-scoring of edited proposals
  As an architect
  I want to tune the inference and re-score my edited proposals without analyzing the code again
  So that I can explore extraction alternatives with the engine's own formulas

  @TS-023 @FR-022 @FR-043 @P2 @acceptance
  Scenario: The inference defaults expose the panel parameters with engine defaults and contract ranges
    Given the web runs with the stub engine
    When the client requests the inference defaults
    Then the response lists the parameters "viability.thresholds.high", "viability.thresholds.medium", "viability.weights.cohesion", "viability.weights.coupling", "viability.weights.data", "evidence.evidenceThreshold" and "clustering.largeClusterRatio"
    And each parameter has the default value published by the engine and the minimum and maximum of the inference configuration contract

  @TS-024 @FR-023 @FR-027 @FR-042 @P2 @acceptance
  Scenario: Re-inference is delegated to the engine for the stored analysis
    Given the web runs with the stub engine
    And a completed analysis of the stub engine
    When the client re-infers that analysis with the configuration {"viability":{"thresholds":{"high":0.9}}} and the minimum viability "Media"
    Then the response status is 200 and the body is a valid consolidated architecture
    And the engine received "reinfer_architecture" with the analysis identifier, that configuration and that minimum viability
    And the stored architecture document of the analysis is unchanged

  @TS-025 @FR-024 @P2 @validation
  Scenario: An engine configuration error is reported with its message
    Given the web runs with the stub engine
    And a completed analysis of the stub engine
    And the stub engine rejects configurations with "Invalid inference configuration: viability.thresholds.medium: must be <= viability.thresholds.high"
    When the client re-infers that analysis with the configuration {"viability":{"thresholds":{"high":0.5,"medium":0.6}}}
    Then the response status is 422 with the error code "INFERENCE_CONFIG_INVALID" and the engine message

  @TS-026 @FR-026 @FR-042 @P2 @acceptance
  Scenario: An edited proposal is scored by the engine
    Given the web runs with the stub engine
    And a completed analysis of the stub engine
    When the client scores the components "a.A" and "a.B" of that analysis
    Then the response status is 200 and the body is a valid proposal score
    And the engine received "score_proposal" with the analysis identifier and those components

  @TS-027 @FR-026 @P2 @validation
  Scenario: Scoring unknown components is rejected with the engine message
    Given the web runs with the stub engine
    And a completed analysis of the stub engine
    And the stub engine rejects components with "Unknown components: x.Missing"
    When the client scores the components "x.Missing" of that analysis
    Then the response status is 422 with the error code "UNKNOWN_COMPONENTS" and the engine message

  @TS-028 @FR-022 @FR-023 @P2 @acceptance
  Scenario: Only changed parameters are sent, clamped to the contract range
    Given the panel parameters with their defaults and ranges
    When the user sets "viability.thresholds.high" to 1.7 and leaves the others at their defaults
    Then the configuration sent is {"viability":{"thresholds":{"high":1}}}

  @TS-029 @FR-022 @FR-023 @FR-025 @FR-027 @SC-004 @SC-003 @P2 @acceptance @e2e @slow
  Scenario: Raising the viability thresholds recalculates the proposals without analyzing again, and reset restores them
    Given the product is built
    And the web is running
    And a browser session is open on the web
    When the user uploads the ZIP of the demo project "java-standar" and the analysis completes
    And the user opens the step "proposals"
    Then the inference panel shows every parameter with its engine default
    When the user sets "viability.thresholds.high" to 0.99 and "viability.thresholds.medium" to 0.95
    Then within 3 seconds of each change the page shows recalculated proposals
    And after the last change every proposal has viability "Baja"
    And the page sent no new analysis after the upload
    And the stored architecture document of the analysis is unchanged
    When the user resets the inference parameters
    Then the proposals show again their original viabilities

  @TS-030 @FR-024 @P2 @validation @e2e @slow
  Scenario: Incoherent thresholds show the engine message and keep the previous proposals
    Given the product is built
    And the web is running
    And a browser session is open on the web
    When the user uploads the ZIP of the demo project "java-standar" and the analysis completes
    And the user opens the step "proposals"
    And the user sets "viability.thresholds.medium" to 0.9
    Then the inference panel shows an error containing "must be <= viability.thresholds.high"
    And the proposals keep their previous viabilities

  @TS-031 @FR-026 @P2 @acceptance @e2e @slow
  Scenario: Moving a component between proposals re-scores both with the engine
    Given the product is built with the .NET analyzer staged next to the engine
    And the web is running
    And a browser session is open on the web
    When the user uploads the ZIP of the demo project "dotnet-ecommerce" and the analysis completes
    And the user opens the step "proposals"
    And the user moves a component of the first proposal to the second proposal
    Then both proposals are marked as edited and show a viability and a score returned by the engine

  @TS-032 @FR-023 @P2 @validation @e2e @slow
  Scenario: Re-inferring twice with the same parameters gives identical proposals
    Given the product is built
    And the web is running
    And a browser session is open on the web
    When the user uploads the ZIP of the demo project "java-standar" and the analysis completes
    And the analysis is re-inferred twice with the configuration {"evidence":{"evidenceThreshold":0.5}}
    Then both re-inferred architectures are byte-identical
