# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-001
Feature: An agent sends a local project to dev-arch and receives the analysis
  As a person working with a coding agent
  I want the agent to send my project folder to dev-arch and get the analysis back
  So that I can decide what to modernize without leaving the agent

  @TS-001 @FR-001 @FR-002 @FR-005 @FR-006 @SC-003 @US-001 @P1 @acceptance
  Scenario: The bridge sends a local folder to a server that cannot see it and returns the summary
    Given a dev-arch web server whose local folder analysis is disabled
    And the agent bridge connected to that server
    When the agent calls "analyze_project" with the folder of the demo project "java-standar"
    Then the result is not an error
    And the result contains an analysis id, the status "completed", a summary with at least 1 component and a link ending in "?analysis=<id>"
    And the analysis history of the web lists that analysis id

  @TS-002 @FR-003 @US-001 @P1 @acceptance
  Scenario: Dependency, build and version-control directories are not sent
    Given a project folder with source files and the directories ".git", "node_modules", "target", "bin" and "obj"
    When the agent bridge packages the folder
    Then the package contains the source files
    And the package contains no entry under ".git", "node_modules", "target", "bin" or "obj"

  @TS-003 @FR-003 @US-001 @P1 @validation
  Scenario: Symbolic links are not followed when packaging
    Given a project folder with a symbolic link to a file outside the folder
    When the agent bridge packages the folder
    Then the package contains no entry for the symbolic link

  @TS-004 @FR-003 @SC-004 @US-001 @P2 @validation
  Scenario: Packaging the same folder twice produces identical bytes
    Given a project folder with source files
    When the agent bridge packages the folder twice
    Then both packages are byte-identical

  @TS-005 @FR-006 @FR-007 @US-001 @P1 @acceptance
  Scenario: A wait shorter than the analysis returns the id and the current status
    Given a dev-arch web server whose engine takes longer than the wait
    And the agent bridge connected to that server
    When the agent calls "analyze_project" with the folder of the demo project "java-standar" and a wait of 0 seconds
    Then the result is not an error
    And the result contains an analysis id and the status "queued" or "running"
    When the agent calls "get_analysis" with that analysis id and a wait of 30 seconds
    Then the result contains the status "completed" and a summary

  @TS-006 @FR-004 @FR-014 @US-001 @P1 @validation
  Scenario Outline: Invalid folders are rejected without creating an analysis
    Given a dev-arch web server whose local folder analysis is disabled
    And the agent bridge connected to that server
    When the agent calls "analyze_project" with <path>
    Then the result is an error with the code "<code>"
    And the analysis history of the web is unchanged

    Examples:
      | path                                   | code          |
      | a folder that does not exist           | INVALID_INPUT |
      | a regular file                         | INVALID_INPUT |
      | a folder larger than the upload limit  | TOO_LARGE     |

  @TS-007 @FR-014 @US-001 @P1 @acceptance
  Scenario: A failed analysis is returned as failed with its reason
    Given a dev-arch web server whose engine fails every analysis
    And the agent bridge connected to that server
    When the agent calls "analyze_project" with the folder of the demo project "java-standar"
    Then the result is an error with the code "ANALYSIS_FAILED"
    And the error names the analysis id and the reason

  @TS-008 @FR-008 @US-001 @P2 @acceptance
  Scenario: The agent can choose the language
    Given a dev-arch web server whose local folder analysis is disabled
    And the agent bridge connected to that server
    When the agent calls "analyze_project" with the folder of the demo project "java-standar" and the language "java"
    Then the analysis was registered with the language "java"

  @TS-009 @FR-001 @FR-002 @FR-005 @SC-001 @SC-002 @SC-003 @US-001 @P1 @acceptance @slow
  Scenario: End to end with the built product and the real engine
    Given the built web running with the real engine and local folder analysis disabled
    And the agent bridge downloaded from that web
    When the agent calls "analyze_project" with the folder of the demo project "java-standar"
    Then the result contains the status "completed" and a summary with at least 1 component
    And the summary equals the summary the web computes for the same analysis
    And the link of the result opens the web
