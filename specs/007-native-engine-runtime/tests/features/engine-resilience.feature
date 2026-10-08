# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-007
Feature: Resilient engine service in the web
  As the operator of a dev-arch instance
  I want a single long-lived engine process that recovers by itself
  So that an engine crash or hang fails only the affected analysis with a clear reason

  @TS-066 @FR-029 @P2 @acceptance
  Scenario: Successive analyses reuse one engine process
    Given the web server is running with a stub engine that counts its launches
    When three analyses are submitted one after another and all complete
    Then the engine was launched exactly once

  @TS-067 @FR-029 @SC-009 @P2 @acceptance
  Scenario: An engine crash fails the running analysis and the next one succeeds
    Given the web server is running with a stub engine that takes 30 seconds per analysis
    And an analysis is running
    When the engine process is killed
    Then within 10 seconds that analysis has status "failed" with error code "ENGINE_CRASHED"
    When another analysis is submitted with a stub engine that answers immediately
    Then that analysis completes without restarting the web server

  @TS-068 @FR-029 @P2 @validation
  Scenario: Repeated crashes make the engine temporarily unavailable
    Given the web server is running with a stub engine that crashes on every analysis
    When four analyses are submitted one after another within 60 seconds
    Then the first three fail with error code "ENGINE_CRASHED"
    And the fourth fails with error code "ENGINE_UNAVAILABLE"

  @TS-069 @FR-029 @P2 @validation
  Scenario: An analysis submitted while the engine restarts waits for it
    Given the web server is running with a stub engine
    And the engine process has just been killed
    When an analysis is submitted
    Then that analysis completes

  @TS-070 @FR-030 @P2 @acceptance
  Scenario: An analysis exceeding the time limit fails without blocking the next ones
    Given the web server is running with an analysis time limit of 2 seconds and a stub engine that takes 10 seconds per analysis
    When an analysis is submitted
    Then that analysis ends with status "failed" and error code "TIMEOUT"
    When another analysis is submitted with a stub engine that answers immediately
    Then that analysis completes

  @TS-071 @FR-031 @P2 @validation
  Scenario: Engine diagnostics are logged per analysis and summarized for the user
    Given the web server is running with a stub engine that writes "java.lang.IllegalStateException: boom" to its error output and then fails
    When an analysis is submitted
    Then the server log contains the line "[engine] java.lang.IllegalStateException: boom"
    And the engine log of that analysis contains "java.lang.IllegalStateException: boom"
    And the failure message shown in the analysis status does not contain "java.lang.IllegalStateException"

  @TS-072 @FR-029 @FR-032 @P2 @contract
  Scenario Outline: The engine is launched in server mode with the configured runtime
    Given the environment <environment>
    And the web working directory is "/p/web"
    When the engine launch command is resolved
    Then the command is "<command>" with arguments "<arguments>"

    Examples:
      | environment                                   | command          | arguments                                    |
      | has no ENGINE_JAR_PATH and no JAVA_HOME       | java             | -jar /p/web/engine-dist/engine.jar --mcp     |
      | has JAVA_HOME "/jdk17"                        | /jdk17/bin/java  | -jar /p/web/engine-dist/engine.jar --mcp     |
      | has ENGINE_JAVA_OPTS "-Xmx2g -Dfoo=bar"       | java             | -Xmx2g -Dfoo=bar -jar /p/web/engine-dist/engine.jar --mcp |
      | has ENGINE_JAR_PATH "/opt/engine.jar"         | java             | -jar /opt/engine.jar --mcp                   |
