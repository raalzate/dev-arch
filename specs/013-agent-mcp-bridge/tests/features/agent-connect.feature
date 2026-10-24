# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-004
Feature: The agent connects to dev-arch in one step and safely
  As a person installing dev-arch
  I want documented one-command registration and token protection
  So that the agent connection works without manual debugging

  @TS-022 @FR-019 @SC-006 @US-004 @P1 @validation
  Scenario Outline: With an API token, calls without a valid token are rejected without data
    Given a dev-arch web server with the API token "secret" and a completed analysis
    When an MCP client calls "<tool>" on the agent endpoint with <token>
    Then the response is unauthorized
    And the response contains no analysis id

    Examples:
      | tool          | token              |
      | list_analyses | no token           |
      | get_summary   | the token "wrong"  |

  @TS-023 @FR-019 @US-004 @P1 @acceptance
  Scenario: The bridge forwards the token
    Given a dev-arch web server with the API token "secret" and a completed analysis
    And the agent bridge connected to that server with the token "secret"
    When the agent calls "list_analyses"
    Then the result is not an error

  @TS-024 @FR-019 @US-004 @P1 @acceptance
  Scenario: Without a configured token the agent endpoint works as the web
    Given a dev-arch web server with a completed analysis of the demo project "java-standar"
    And an MCP client connected to the agent endpoint of that server
    When the client calls "list_analyses"
    Then the result is not an error

  @TS-025 @FR-014 @US-004 @P1 @validation
  Scenario: An unreachable server is reported with the address and how to start it
    Given the agent bridge connected to a server address where nothing listens
    When the agent calls "list_analyses"
    Then the result is an error with the code "UNREACHABLE"
    And the error names that address and how to start dev-arch

  @TS-026 @FR-020 @US-004 @P2 @acceptance
  Scenario: The health endpoint reports the agent endpoint
    Given the health endpoint with a doctor that reports "OK"
    When the health endpoint is requested
    Then the body reports the agent endpoint "/api/mcp", the bridge "/dev-arch-mcp.mjs" and 10 tools

  @TS-027 @FR-018 @FR-021 @US-004 @P1 @contract
  Scenario: The guide documents the registration and the tools
    Given the agent connection guide
    Then it contains a "claude mcp add" command for a local instance
    And it contains a "claude mcp add" command for a remote instance with a token
    And it documents every agent tool and the upload limit
    And the install guide links to it

  @TS-028 @FR-002 @US-004 @P1 @contract
  Scenario: The bridge is a single dependency-free file served by the web
    Given the agent bridge source
    Then it imports only built-in "node:" modules
    And it is served by the web at "/dev-arch-mcp.mjs"
    And running it with "--version" prints the product version
