# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-006
Feature: The engine reports progress and warnings, accepts a language and reuses analyses
  As a consumer of the engine (the web, an AI agent or a command-line user)
  I want phase progress, explicit warnings, a language choice for ambiguous projects and reuse of unchanged analyses
  So that analyses are transparent and fast without changing any result

  @TS-048 @FR-023 @P2 @contract @engine
  Scenario: A client that requests progress receives the four phases in order
    Given the engine server mode is started
    When a full analysis of the demo project "java-standar" is requested with a progress token
    Then exactly 4 progress notifications arrive before the result
    And their messages are "detection", "extraction", "inference" and "writing" in that order
    And their progress values are 1, 2, 3 and 4 out of a total of 4

  @TS-049 @FR-023 @FR-027 @P2 @contract @engine
  Scenario: Without a progress token no notification is sent and the result is unchanged
    Given the engine server mode is started
    When a full analysis of the demo project "java-standar" is requested without a progress token
    Then no progress notification arrives
    And the result and the three output documents are byte-identical to those of a request with a progress token

  @TS-050 @FR-024 @SC-007 @P2 @acceptance @engine
  Scenario Outline: An ambiguous project is analyzed identically in both modes with an explicit language
    Given a copy of the demo project "<project>" with an extra "<marker>" marker file
    When it is analyzed in server mode with the language "<language>"
    And it is analyzed in command-line mode with the option "--language=<language>"
    Then both modes produce byte-identical output documents
    And the graph declares a "<source>" source

    Examples:
      | project          | marker      | language | source |
      | java-standar     | App.csproj  | java     | Java   |
      | dotnet-ecommerce | pom.xml     | dotnet   | .NET   |

  @TS-051 @FR-024 @P2 @contract @engine
  Scenario: An ambiguous project with automatic detection fails asking for the language
    Given a copy of the demo project "java-standar" with an extra "App.csproj" marker file
    When it is analyzed in server mode with the language "auto"
    Then the tool result is an error whose message contains "Ambiguous project type" and "language=java|dotnet"

  @TS-052 @FR-024 @FR-027 @P2 @contract @engine
  Scenario Outline: Automatic or absent language keeps the previous outputs
    When the demo project "<project>" is analyzed in command-line mode <option>
    Then the output documents are byte-identical to those produced by the command-line mode without the option

    Examples:
      | project          | option                      |
      | java-standar     | with "--language=auto"      |
      | dotnet-ecommerce | with "--language=auto"      |

  @TS-053 @FR-024 @P2 @contract @engine
  Scenario: An unrecognized language is rejected in both modes
    When the demo project "java-standar" is analyzed in server mode with the language "cobol"
    Then the tool result is an error whose message is "Invalid language 'cobol'. Allowed: java, dotnet, auto"
    When the demo project "java-standar" is analyzed in command-line mode with the option "--language=cobol"
    Then the command exits with code 1 and its error output contains "Invalid language 'cobol'. Allowed: java, dotnet, auto"
    And no output document is written

  @TS-054 @FR-024 @P2 @contract @engine
  Scenario: Every tool declares the optional language input
    Given the engine server mode is started
    When the tools are listed
    Then the tools "analyze_project", "get_dependency_graph", "get_architecture_proposal", "get_api_contracts" and "get_component_metrics" declare an optional "language" input with values "java", "dotnet" and "auto"
    And their required inputs are unchanged

  @TS-055 @FR-025 @SC-007 @SC-008 @P2 @acceptance @engine
  Scenario: A second query on an unchanged project reuses the analysis
    Given the engine server mode is started
    And the demo project "java-standar" has been fully analyzed once in this session
    When the same project is fully analyzed again
    Then the analysis is served from the reuse cache
    And the result and the output documents are byte-identical to the first ones
    And the second query takes less than 20% of the time of the first

  @TS-056 @FR-025 @P2 @acceptance @engine
  Scenario Outline: Any change in the project files invalidates the reuse
    Given the engine server mode is started
    And a copy of the demo project "java-standar" has been fully analyzed once in this session
    When <change> in that copy
    And the copy is fully analyzed again
    Then the analysis is recomputed instead of reused
    And the result reflects the change

    Examples:
      | change                                                           |
      | a new Java class is added                                        |
      | an existing Java class is deleted                                |
      | an existing Java class is modified with a newer modification time |

  @TS-057 @FR-025 @P2 @validation @engine
  Scenario: The reuse cache is bounded and keyed by language
    Given the engine server mode is started with a reuse capacity of 2 projects
    When three different projects are fully analyzed in turn
    And the first project is fully analyzed again
    Then the first project is recomputed instead of reused
    When an analyzed project is analyzed again with a different language choice
    Then it is recomputed instead of reused

  @TS-058 @FR-025 @FR-027 @P2 @validation @engine
  Scenario: Derived queries do not alter the reused analysis
    Given the engine server mode is started
    And the demo project "java-standar" has been fully analyzed once in this session
    When its architecture proposal is requested with the minimum viability "Alta"
    And the same project is fully analyzed again
    Then the output documents are byte-identical to the first ones

  @TS-059 @FR-026 @P2 @contract @engine
  Scenario: Analysis warnings are exposed in both modes without changing the outputs
    Given a copy of the demo project "java-standar" with a Java source file that cannot be parsed
    When it is analyzed in server mode
    Then the tool result metadata lists a warning naming that file by its path relative to the project
    And the tool result content validates against the analyze_project response contract "1.0.0"
    When it is analyzed in command-line mode
    Then the command error output contains a line starting with "[warning]" naming that file
    And both modes produce byte-identical output documents declaring the contract version "1.0.0"

  @TS-060 @FR-026 @FR-027 @P2 @contract @engine
  Scenario: A result without warnings carries no warning metadata
    Given the engine server mode is started
    When a full analysis of the demo project "java-standar" is requested
    Then the tool result has no warning metadata

  @TS-061 @FR-026 @P2 @acceptance @engine
  Scenario: A project without analyzable files completes with a warning
    Given an empty project folder containing only a "README.md" file
    When it is analyzed in server mode
    Then the analysis succeeds with 0 components
    And the tool result metadata lists the warning "No analyzable source files found"

  @TS-062 @FR-026 @FR-007 @P2 @acceptance
  Scenario: The web shows the warnings of an analysis
    Given the web server is running with a stub engine that reports the warning "Skipped src/Broken.java: parse error"
    When an analysis is submitted and completes
    Then the analysis status lists the warning "Skipped src/Broken.java: parse error"

  @TS-063 @FR-026 @FR-007 @P2 @acceptance @e2e @slow
  Scenario: The user sees the warnings next to the results
    Given the product is built
    And the web is running
    And a browser session is open on the web
    When the user uploads a ZIP of the demo project "java-standar" with an extra Java file that cannot be parsed
    Then the page shows the results together with a warning naming that file

  @TS-064 @SC-007 @P2 @validation @engine
  Scenario: Concurrent full analyses produce the same outputs as sequential ones
    Given the engine server mode is started
    When the demo projects "java-standar" and "dotnet-ecommerce" are fully analyzed at the same time
    Then the output documents of each project are byte-identical to those of a sequential analysis
    And two consecutive sequential analyses of each project are byte-identical

  @TS-065 @SC-007 @P2 @validation @slow
  Scenario: The web and the command line produce identical documents for the same folder
    Given the product is built
    And the web server runs with local folder analysis "enabled" and the built engine
    When the local folder of the demo project "java-standar" is analyzed through the web
    And the same folder is analyzed with the command line
    Then the three documents of the web analysis are byte-identical to the command-line documents
