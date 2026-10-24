# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-002
Feature: The agent reads an analysis by parts and the history
  As an agent
  I want the summary, proposals, findings, plan and documents of an analysis separately
  So that I only bring what I need into context

  Background:
    Given a dev-arch web server with a completed analysis of the demo project "java-standar"
    And an MCP client connected to the agent endpoint of that server

  @TS-010 @FR-001 @FR-022 @US-002 @P1 @contract
  Scenario: The agent endpoint lists the agent tools
    When the client lists the tools
    Then the tools are exactly "analyze_project", "get_analysis", "list_analyses", "get_summary", "get_proposals", "get_findings", "get_plan", "get_document", "get_inference_parameters" and "reinfer_proposals"
    And every tool declares an input schema

  @TS-011 @FR-009 @FR-010 @SC-002 @US-002 @P1 @acceptance
  Scenario: The summary equals the one of the web
    When the client calls "get_summary" for that analysis
    Then the result equals the summary computed by the web modernization logic for the same documents

  @TS-012 @FR-009 @FR-010 @SC-002 @US-002 @P1 @acceptance
  Scenario: The proposals keep the order and figures of the web
    When the client calls "get_proposals" for that analysis
    Then the proposals are in the order of the web proposals step
    And each proposal has its viability, cohesion, external coupling, tables and components

  @TS-013 @FR-009 @FR-010 @US-002 @P1 @acceptance
  Scenario: The findings are grouped and filtered by minimum severity
    When the client calls "get_findings" for that analysis with the minimum severity "ERROR"
    Then every finding returned has the severity "CRITICAL" or "ERROR"
    And the total equals the number of findings of severity "CRITICAL" or "ERROR" in the web findings step

  @TS-014 @FR-009 @FR-010 @FR-012 @US-002 @P1 @acceptance
  Scenario: The plan comes as readable text and as structured data
    When the client calls "get_plan" for that analysis
    Then the result has the markdown of the plan exported by the web
    And the result has the structured plan with its stages

  @TS-015 @FR-009 @US-002 @P1 @acceptance
  Scenario Outline: A full document equals the one of the web API
    When the client calls "get_document" for that analysis with the document "<document>"
    Then the result equals the body of the web API document "<document>" of that analysis

    Examples:
      | document     |
      | graph        |
      | architecture |
      | contracts    |

  @TS-016 @FR-011 @US-002 @P1 @acceptance
  Scenario: The history equals the one of the web
    When the client calls "list_analyses"
    Then the analyses are the ones of the web history in the same order
    And every analysis has its id, name, technology, status and link

  @TS-017 @FR-014 @US-002 @P1 @validation
  Scenario Outline: Parts of unknown, unfinished or failed analyses are specific errors
    Given <state>
    When the client calls "get_summary" for that analysis
    Then the result is an error with the code "<code>"

    Examples:
      | state                                  | code            |
      | an analysis id that does not exist     | NOT_FOUND       |
      | an analysis that is still running      | NOT_READY       |
      | an analysis that failed                | ANALYSIS_FAILED |
      | a malformed analysis id                | INVALID_INPUT   |

  @TS-018 @FR-013 @SC-004 @US-002 @P1 @validation
  Scenario: The same request twice returns identical bytes
    When the client calls each read tool twice for that analysis
    Then each pair of results is byte-identical
