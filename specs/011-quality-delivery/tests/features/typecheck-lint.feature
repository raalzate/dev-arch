# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-001
Feature: Type and lint errors block the web build
  As a maintainer
  I want the web to fail its build and its tests on type or lint errors
  So that typing defects never reach production unnoticed

  @TS-001 @FR-001 @SC-001 @P1 @contract
  Scenario: The web build configuration tolerates no type or lint errors
    Given the web build configuration
    Then it contains no option that ignores type errors during the build
    And it contains no option that ignores lint errors during the build

  @TS-002 @FR-002 @FR-003 @SC-001 @P1 @acceptance
  Scenario: The whole web type-checks without errors
    When the web type check is executed
    Then it exits with code 0
    And it reports 0 type errors
    And the type check configuration excludes no web source or test file

  @TS-003 @FR-004 @SC-001 @P1 @acceptance
  Scenario: The web passes the framework recommended lint rules
    Given the web lint configuration
    Then it extends the framework rule set "next/core-web-vitals"
    And it disables no rule globally
    When the web lint is executed
    Then it exits with code 0
    And it reports 0 lint errors

  @TS-004 @FR-001 @FR-002 @P1 @validation
  Scenario: A type error fails the type check naming the file
    Given a temporary web source file with a type error
    When the web type check is executed
    Then it exits with a non-zero code
    And the output names the temporary web source file

  @TS-005 @FR-005 @P1 @contract
  Scenario: The web test command and the web CI job run type check and lint without tolerating failure
    Given the product test script
    Then its web subset runs the web type check, the web lint and the web unit tests
    Given the product continuous integration definition
    Then the web job runs the web type check and the web lint without tolerating failure
