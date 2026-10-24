# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-005
Feature: The documentation explains the thesis with real screenshots
  As a reader of the repository
  I want a front page that explains why dev-arch relies on deterministic inference
  So that I understand how it guides AI refactoring and guards continuous modernization

  @TS-005 @FR-009 @SC-005 @US-005 @P1 @contract
  Scenario: The front page explains the thesis
    Given the repository front page
    Then it explains that the analysis is deterministic and reproducible
    And it explains that AI models refactor while the deterministic analysis states how the project is without inventing
    And it explains that repeated analysis acts as a guardrail of principles and good practices
    And it explains continuous modernization

  @TS-006 @FR-010 @SC-005 @US-005 @P1 @contract
  Scenario: Real screenshots of the five steps are versioned and referenced
    Given the repository front page and the documentation
    Then they reference screenshots of the summary, system map, proposals, findings and plan steps
    And they reference a screenshot of the agent connection
    And every referenced image exists in the repository and is a PNG of at least 20 KB

  @TS-007 @FR-007 @US-004 @P1 @contract
  Scenario: The quick start points at this repository
    Given the repository front page
    Then the quick start clones "raalzate/dev-arch"
    And it builds from the root, starts the web or the container and links the agent connection guide

  @TS-008 @FR-011 @US-005 @P2 @contract
  Scenario: The agent and deterministic analysis loop is documented
    Given the continuous modernization guide
    Then it describes the loop analyze, refactor with AI, analyze again and compare
    And it names the indicators findings by severity, coupling, cohesion and viability
