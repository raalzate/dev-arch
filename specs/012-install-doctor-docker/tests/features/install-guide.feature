# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-005
Feature: The install guide never diverges from the doctor
  As a person installing dev-arch
  I want a guide with the local and Docker routes whose requirements table is the doctor definition
  So that the documentation never contradicts the command

  @TS-033 @FR-026 @P2 @acceptance
  Scenario: The guide describes the local and the Docker routes
    Given the product install guide
    Then it has a section "Local installation" mentioning "npm run doctor", "make check-env" and "make build"
    And it has a section "Docker installation" mentioning "docker compose -f docker/compose.yaml up -d", "--profile dev" and "/api/health"

  @TS-034 @FR-002 @FR-026 @SC-005 @P2 @acceptance
  Scenario: The requirements table of the guide is the generated one
    Given the product install guide
    When the requirements table is generated from the doctor definition
    Then the table between the guide markers is identical to it

  @TS-035 @FR-002 @P2 @contract
  Scenario: Every requirement of the definition is complete
    Given the doctor requirements definition
    Then it has the requirements "jdk, maven, dotnet-sdk, dotnet-runtime, node, engine-jar, dotnet-analyzer, vs-build-tools, docker, env, port, resources"
    And every requirement has a name, a usage, a minimum, a detection and at least one mode
    And every requirement has an install hint for each package manager of the platforms it applies to
