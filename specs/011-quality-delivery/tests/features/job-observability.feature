# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify
@US-006
Feature: Minimal observability of web analyses
  As an operator of the web
  I want a structured log per analysis and the duration of every phase
  So that I can diagnose slow or failed analyses without reading the raw engine output

  Background:
    Given a web job runner with a simulated engine and a controllable clock

  @TS-023 @FR-023 @SC-006 @P2 @acceptance
  Scenario: A completed analysis has its ordered structured events with durations
    When an analysis runs through the phases "detection, extraction, inference, writing" and completes
    Then its structured log has one JSON event per line
    And the events are "queued, started, phase-start, phase-end, phase-start, phase-end, phase-start, phase-end, phase-start, phase-end, completed" in this order
    And every phase-end event names its phase and a duration in milliseconds
    And the completed event has the status "completed" and the total duration

  @TS-024 @FR-024 @SC-006 @P2 @acceptance
  Scenario: The analysis status exposes coherent time metrics
    When an analysis runs through the phases "detection, extraction, inference, writing" and completes
    And its status is read through the analyses API view
    Then the metrics contain the duration of each of the 4 phases, the queue time and the total duration
    And no duration is negative and the sum of the phases does not exceed the total

  @TS-025 @FR-024 @P2 @validation
  Scenario: Durations are never negative when the clock goes backwards
    When an analysis runs through the phases "detection, extraction" while the clock goes backwards and completes
    And its status is read through the analyses API view
    Then no duration is negative and the sum of the phases does not exceed the total

  @TS-026 @FR-025 @P2 @acceptance
  Scenario: A failed analysis records its error code and the phase where it failed
    When an analysis runs through the phases "detection, extraction" and the engine fails with a tool error
    Then the last structured event is "failed" with the code "ENGINE_ERROR" and the phase "extraction"
    And the metrics contain the duration of each of the 2 phases, the queue time and the total duration

  @TS-027 @FR-026 @P2 @validation
  Scenario: Events contain no absolute server path and no secret
    Given the engine error message contains the analysis folder path and the API token
    When an analysis runs through the phases "detection" and the engine fails with a tool error
    Then no structured event contains an absolute path of the server or the API token

  @TS-028 @FR-027 @P2 @validation
  Scenario: A failure writing the structured log does not change the analysis result
    Given writing the structured log fails
    When an analysis runs through the phases "detection, extraction, inference, writing" and completes
    Then the analysis status is "completed"
    And the metrics contain the duration of each of the 4 phases, the queue time and the total duration

  @TS-029 @FR-028 @P2 @acceptance
  Scenario: The server console receives one structured line per finished analysis
    When an analysis runs through the phases "detection" and the engine fails with a tool error
    Then the server console received one JSON line with the analysis id, the status "failed", the code "ENGINE_ERROR" and the total duration
