# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify
@US-005
Feature: Unified release consistent with the product version
  As a release manager
  I want a dev-arch tag to publish the engine bundles and the skills in one release, only for the product version
  So that no artifact is published with an inconsistent version

  @TS-020 @FR-019 @FR-022 @SC-005 @P2 @acceptance
  Scenario Outline: The release version check accepts only the tag of the product version
    When the release version check is executed for the tag "<tag>"
    Then its exit code is <code>
    And its output contains "<message>"

    Examples:
      | tag                       | code | message                                   |
      | dev-arch-v{VERSION}       | 0    | matches VERSION                           |
      | dev-arch-v9.9.9           | 1    | tag version 9.9.9 != VERSION              |
      | dev-arch-vlatest          | 1    | malformed tag                             |
      | v{VERSION}                | 1    | malformed tag                             |

  @TS-021 @FR-019 @FR-020 @P2 @contract
  Scenario: Tag releases check the version before building and keep the platform matrix
    Given the product continuous integration definition
    Then a release version check job runs only for "dev-arch-v*" tags and runs the release version check script
    And the release job depends on the release version check job
    When the release job is inspected
    Then it depends on the Java and .NET engine jobs
    And it builds the platforms "linux-x64", "osx-arm64", "osx-x64" and "win-x64" as framework-dependent

  @TS-022 @FR-021 @P2 @contract
  Scenario: Tag releases publish the packaged skills with a checksum in the same release
    Given the product continuous integration definition
    Then a skills release job runs only for "dev-arch-v*" tags after the release version check
    And it packages the product skills folder as an archive named after the tag with a checksum file
    And it publishes both files to the release of the same tag
