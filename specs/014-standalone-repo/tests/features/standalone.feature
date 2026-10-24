# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-001
Feature: dev-arch is its own repository with the product at the root
  As a person who wants to use or contribute to dev-arch
  I want a repository that only contains dev-arch, with the product at the root
  So that I can clone, build and test it with the usual commands

  @TS-001 @FR-001 @FR-002 @SC-002 @US-001 @P1 @contract
  Scenario: The product lives at the repository root
    Given the repository checkout
    Then the repository root is the product root
    And there is no "apps" directory
    And no code, script, container or test file refers to "apps/dev-arch"

  @TS-002 @FR-001 @US-001 @P1 @validation
  Scenario: The history of the product features is preserved
    Given the repository history
    Then it contains commits of every feature from "006-devarch-monorepo" to "013-agent-mcp-bridge"
    And the tag "dev-arch-006-baseline" points to a commit of feature "006-devarch-monorepo"

  @TS-003 @FR-002 @FR-008 @SC-001 @US-001 @P1 @acceptance @slow
  Scenario: A clean clone builds and tests green from the root
    Given a clean clone of the repository on the feature branch
    When "make build" is executed from the product root
    And "make test" is executed from the product root
    Then both commands exit with code 0
    And the working tree has no changed or untracked files
