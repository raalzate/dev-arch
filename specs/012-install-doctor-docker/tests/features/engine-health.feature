# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-004
Feature: Live health of the web and engine self-diagnosis
  As an operator
  I want a health endpoint and an engine self-check built on the same doctor
  So that I detect a broken installation without running an analysis

  @TS-019 @FR-014 @P1 @acceptance @slow
  Scenario: The engine describes itself in one JSON line
    Given the engine archive of the build
    When the engine is run with "--doctor"
    Then it prints exactly one JSON line with "engine", "version", "schema_version", "java_version" and "dotnet_analyzer"
    And the version is the product version and the schema version is "1.0.0"
    And the exit code is 0

  @TS-020 @FR-015 @SC-006 @P1 @validation @slow
  Scenario: The self-diagnosis option changes neither analysis outputs nor MCP tools
    Given the engine archive of the build
    When the engine analyzes "engine/test-for-demo/java-standar" before and after a run with "--doctor"
    Then both command line outputs are byte-identical
    And the MCP server lists exactly the tools that have a response schema in the contract

  @TS-021 @FR-014 @FR-015 @P1 @contract
  Scenario: The engine self-diagnosis reuses the analysis locator and keeps the existing modes first-class
    Given the engine command line sources
    Then the "--doctor" option is handled before the usage check and delegates to the engine self-diagnosis
    And the engine self-diagnosis locates the analyzer with the same locator as the analysis
    And an engine unit test covers the found and not found analyzer cases

  @TS-022 @FR-017 @P1 @acceptance
  Scenario: The health endpoint answers 200 with the engine state when nothing fails
    Given the health endpoint with a doctor that reports "WARN"
    When the health endpoint is requested
    Then the response status is 200 and it is not cached
    And the body has the service "dev-arch", the status, the version, the engine archive, the .NET analyzer and the engine process state
    And the doctor was asked only for the checks "jdk, dotnet-runtime, engine-jar, dotnet-analyzer, env, resources"

  @TS-023 @FR-017 @P1 @acceptance
  Scenario: The health endpoint answers 503 when a runtime check fails
    Given the health endpoint with a doctor that reports "FAIL"
    When the health endpoint is requested
    Then the response status is 503 and it is not cached

  @TS-024 @FR-018 @P2 @acceptance
  Scenario: The doctor result is reused for 30 seconds while the engine process state stays live
    Given the health endpoint with a doctor that reports "OK"
    When the health endpoint is requested twice within 30 seconds with the engine process starting in between
    Then the doctor ran once
    And the engine process state is "idle" in the first answer and "running" in the second
    When the health endpoint is requested again after 30 seconds
    Then the doctor ran twice

  @TS-025 @FR-019 @P2 @acceptance
  Scenario: A broken doctor turns the health into 503 with the reason
    Given the health endpoint with a doctor that prints no report
    When the health endpoint is requested
    Then the response status is 503 and it is not cached
    And the body has a failed check "doctor" explaining that no report was produced

  @TS-026 @FR-017 @SC-001 @P2 @acceptance @slow
  Scenario: The health endpoint of the built product runs the real doctor
    Given the built product
    When the health route of the web is requested from the web folder
    Then the response status is 200
    And the engine archive and the .NET analyzer are reported as found
