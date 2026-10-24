# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-002
Feature: Continuous integration lives in the repository
  As a maintainer
  I want the workflow in this repository, filtered by the areas at the root
  So that the same jobs and gates protect every change

  @TS-004 @FR-003 @US-002 @P1 @contract
  Scenario: The workflow filters by the root areas and keeps every job
    Given the product continuous integration definition
    Then its path filters refer to the areas at the repository root without "apps/dev-arch"
    And it declares the jobs "engine-java", "engine-dotnet", "schema", "web", "acceptance", "docker" and "release"
    And every job runs from the repository root
